from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from rwa_guard.config import Settings
from rwa_guard.db.models import JobRecord, PolicyConstraintRecord, ScanRunRecord
from rwa_guard.db.repositories import (
    AssetRepository,
    ContractRepository,
    DocumentRepository,
    PolicyRepository,
    ReportRepository,
    ScanRepository,
)
from rwa_guard.domain.contracts import (
    CodeFinding,
    ControlSpec,
    EvidenceSpan,
    FailedStage,
    FindingDiff,
    FindingStatus,
    ScanRun,
    ScanStatus,
)
from rwa_guard.pipelines.contract import (
    ANALYZER_VERSION,
    RULES,
    SolidityCompiler,
    analyze_contract_sources,
    compare_rescan,
)
from rwa_guard.pipelines.document import (
    DOCUMENT_PIPELINE_VERSION,
    P0_FIELDS,
    AnthropicControlExtractor,
    ControlExtractor,
    DocumentExtractionError,
    document_contains_suspicious_instructions,
    extract_controls,
    extract_document_pages,
)
from rwa_guard.pipelines.mismatch import assemble_mismatches
from rwa_guard.pipelines.report import build_evidence_report
from rwa_guard.worker.core import JobHandler


def build_document_handler(
    settings: Settings,
    *,
    anthropic_extractor: ControlExtractor | None = None,
) -> JobHandler:
    def handle(job: JobRecord, session: Session) -> None:
        document_id = _payload_string(job, "document_id")
        document = DocumentRepository(session).get(document_id)
        if document is None:
            raise ValueError(f"document not found: {document_id}")
        document.status = "PROCESSING"
        document.error_code = None
        try:
            if document.storage_path is None:
                raise DocumentExtractionError("STORAGE_MISSING", "document storage path is absent")
            payload = Path(document.storage_path).read_bytes()
            pages = extract_document_pages(
                payload,
                media_type=document.media_type,
                max_bytes=settings.max_upload_bytes,
            )
            suspicious = document_contains_suspicious_instructions(pages)
            active_ai = anthropic_extractor
            if active_ai is None and settings.anthropic_api_key:
                active_ai = AnthropicControlExtractor(
                    settings.anthropic_api_key,
                    settings.anthropic_document_model,
                )
            extraction = extract_controls(
                asset_id=document.asset_id,
                document_id=document.id,
                pages=pages,
                mode=settings.document_extractor,
                anthropic_extractor=active_ai,
            )
            controls = list(extraction.controls)
            repository = PolicyRepository(session)
            for control in _deduplicate_controls(controls):
                repository.upsert(
                    PolicyConstraintRecord(
                        id=control.constraint_id,
                        asset_id=control.asset_id,
                        document_id=control.document_id,
                        field_name=control.field,
                        normalized_value={"value": control.value, "unit": control.unit},
                        evidence_span=control.evidence_span.model_dump(mode="json"),
                        confirmed=control.confirmed,
                    )
                )
            extracted_fields = {item.field for item in controls}
            document.page_count = len(pages)
            document.failed_pages = []
            document.processed_at = datetime.now(UTC)
            document.extraction_metadata = {
                "extractor_kind": extraction.extractor_kind,
                "extractor_version": extraction.extractor_version,
                "ai_model": extraction.ai_model,
                "limitations": list(extraction.limitations),
            }
            if suspicious:
                document.status = "PARTIAL"
                document.error_code = "SUSPICIOUS_INSTRUCTIONS"
            elif extracted_fields == P0_FIELDS:
                document.status = "READY"
            else:
                document.status = "PARTIAL"
                document.error_code = "MISSING_FIELDS"
        except DocumentExtractionError as error:
            document.status = "FAILED"
            document.error_code = error.code
            document.processed_at = datetime.now(UTC)
        except OSError:
            document.status = "FAILED"
            document.error_code = "STORAGE_READ_FAILED"
            document.processed_at = datetime.now(UTC)
        session.flush()

    return handle


def build_contract_scan_handler(
    settings: Settings,
    *,
    compiler: SolidityCompiler | None = None,
) -> JobHandler:
    def handle(job: JobRecord, session: Session) -> None:
        scan_id = _payload_string(job, "scan_id")
        report_id = _payload_string(job, "report_id")
        scan = ScanRepository(session).get(scan_id)
        report = ReportRepository(session).get(report_id)
        if scan is None or report is None:
            raise ValueError(f"scan/report not found: {scan_id}/{report_id}")
        scan.status = ScanStatus.RUNNING.value
        try:
            contract_id = _payload_string(job, "contract_id")
            contract = ContractRepository(session).get(contract_id)
            if contract is None or contract.asset_id != scan.asset_id:
                raise ValueError(f"contract not found for scan: {contract_id}")
            if not contract.source_code:
                raise ValueError("stored Solidity source is required for P0 contract analysis")
            findings = list(
                analyze_contract_sources(
                    scan_id=scan.id,
                    sources={"submitted.sol": contract.source_code},
                    compiler=compiler,
                )
            )
            controls = _asset_controls(session, scan.asset_id)
            assembly = assemble_mismatches(controls, findings)
            now = datetime.now(UTC)
            uncertain = [
                finding
                for finding in findings
                if finding.status in {FindingStatus.UNKNOWN, FindingStatus.NEEDS_REVIEW}
            ]
            failed_stages = (
                [
                    {
                        "stage": "contract_analysis",
                        "reason": "one or more deterministic rules could not be confirmed",
                    }
                ]
                if uncertain
                else []
            )
            scan.status = (
                ScanStatus.PARTIAL.value if failed_stages else ScanStatus.COMPLETED.value
            )
            scan.input_hashes = {
                **scan.input_hashes,
                "source": contract.source_hash,
                **(
                    {"analyzed_source": findings[0].source_hash}
                    if findings and findings[0].source_hash != contract.source_hash
                    else {}
                ),
                **_document_hashes(session, scan.asset_id),
            }
            scan.rule_versions = {rule.rule_id: rule.version for rule in RULES}
            scan.failed_stages = failed_stages
            scan.completed_at = now
            scan_contract = _scan_contract(scan)
            limitations = ["합성 fixture 전용이며 자동 금융행위를 수행하지 않습니다."]
            (
                document_extractor,
                ai_model,
                model_versions,
                extraction_limitations,
            ) = _document_provenance(
                session, scan.asset_id
            )
            limitations.extend(extraction_limitations)
            if assembly.unresolved_constraint_ids:
                limitations.append(
                    "코드 finding과 연결되지 않은 통제: "
                    + ", ".join(assembly.unresolved_constraint_ids)
                )
            if uncertain:
                limitations.append("일부 코드 규칙은 UNKNOWN/NEEDS_REVIEW 상태입니다.")
            evidence = build_evidence_report(
                report_id=report.id,
                scan_run=scan_contract,
                controls=controls,
                findings=findings,
                mismatches=list(assembly.mismatches),
                onchain_evidence=[],
                tool_versions={"contract_analyzer": ANALYZER_VERSION},
                model_versions=model_versions,
                limitations=limitations,
                generated_at=now,
                document_extractor=document_extractor,
                ai_model=ai_model,
            )
            diff = _build_diff(session, job, findings, scan.id)
            scan.result_payload = {
                "code_findings": [item.model_dump(mode="json") for item in findings],
                "mismatches": [
                    item.model_dump(mode="json") for item in assembly.mismatches
                ],
                "onchain_evidence": [],
                "diff": [item.model_dump(mode="json") for item in diff],
                "report_id": report.id,
            }
            report.status = "READY"
            report.evidence = evidence.model_dump(mode="json")
            report.report_hash = evidence.report_hash
            report.limitations = limitations
            report.error_code = None
            report.generated_at = now
            asset = AssetRepository(session).get(scan.asset_id)
            if asset is not None and assembly.confirmed_critical_high_count:
                asset.status = "REVIEW_REQUIRED"
        except Exception:
            now = datetime.now(UTC)
            scan.status = ScanStatus.FAILED.value
            scan.failed_stages = [
                {
                    "stage": "contract_scan",
                    "reason": "contract scan could not complete; retry after checking the source",
                }
            ]
            scan.completed_at = now
            scan.result_payload = {}
            report.status = "FAILED"
            report.report_hash = None
            report.error_code = "CONTRACT_SCAN_FAILED"
            report.limitations = [
                "계약 분석을 완료하지 못했습니다. Source와 검사 환경을 확인한 뒤 재시도하세요."
            ]
            report.generated_at = now
        session.flush()

    return handle


def _payload_string(job: JobRecord, key: str) -> str:
    value = job.payload.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"job payload requires {key}")
    return value


def _deduplicate_controls(controls: list[ControlSpec]) -> list[ControlSpec]:
    by_field: dict[str, ControlSpec] = {}
    for control in controls:
        existing = by_field.get(control.field)
        if existing is None or (control.confirmed and not existing.confirmed):
            by_field[control.field] = control
    return [by_field[field] for field in sorted(by_field)]


def _asset_controls(session: Session, asset_id: str) -> list[ControlSpec]:
    controls: list[ControlSpec] = []
    policies = PolicyRepository(session)
    document = DocumentRepository(session).latest_by_asset(asset_id)
    if document is None:
        return controls
    for record in policies.list_by_document(document.id):
        normalized = record.normalized_value
        value = normalized.get("value") if isinstance(normalized, dict) else normalized
        unit = normalized.get("unit") if isinstance(normalized, dict) else None
        if not isinstance(value, (str, int, float, bool)):
            raise ValueError(f"invalid stored control value: {record.id}")
        if unit is not None and not isinstance(unit, str):
            raise ValueError(f"invalid stored control unit: {record.id}")
        controls.append(
            ControlSpec(
                asset_id=record.asset_id,
                document_id=record.document_id,
                constraint_id=record.id,
                field=record.field_name,
                value=value,
                unit=unit,
                evidence_span=EvidenceSpan.model_validate(record.evidence_span),
                confirmed=record.confirmed,
            )
        )
    return controls


def _document_hashes(session: Session, asset_id: str) -> dict[str, str]:
    document = DocumentRepository(session).latest_by_asset(asset_id)
    if document is None:
        return {}
    return {"document": document.file_hash}


def _document_provenance(
    session: Session, asset_id: str
) -> tuple[str, str | None, dict[str, str], list[str]]:
    document = DocumentRepository(session).latest_by_asset(asset_id)
    metadata = document.extraction_metadata if document is not None else {}
    if not metadata:
        return (
            f"deterministic-synthetic-parser@{DOCUMENT_PIPELINE_VERSION}",
            None,
            {},
            ["Document extraction provenance was unavailable"],
        )
    extractors: list[str] = []
    ai_models: list[str] = []
    model_versions: dict[str, str] = {}
    limitations: list[str] = []
    kind = str(metadata.get("extractor_kind", "UNKNOWN"))
    version = str(metadata.get("extractor_version", "unknown"))
    label = (
        f"deterministic-synthetic-parser@{version}"
        if kind == "DETERMINISTIC"
        else f"{kind.lower()}@{version}"
    )
    extractors.append(label)
    model = metadata.get("ai_model")
    if isinstance(model, str):
        ai_models.append(model)
        model_versions[model] = version
    raw_limitations = metadata.get("limitations", [])
    if isinstance(raw_limitations, list):
        limitations.extend(str(value) for value in raw_limitations)
    return (
        ",".join(dict.fromkeys(extractors)),
        ",".join(dict.fromkeys(ai_models)) or None,
        model_versions,
        list(dict.fromkeys(limitations)),
    )


def _scan_contract(record: ScanRunRecord) -> ScanRun:
    return ScanRun(
        scan_id=record.id,
        asset_id=record.asset_id,
        status=ScanStatus(record.status),
        input_hashes=record.input_hashes,
        rule_versions=record.rule_versions,
        failed_stages=[FailedStage.model_validate(item) for item in record.failed_stages],
        started_at=_utc_required(record.started_at),
        completed_at=_utc(record.completed_at),
    )


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _utc_required(value: datetime) -> datetime:
    normalized = _utc(value)
    if normalized is None:
        raise ValueError("required datetime cannot be None")
    return normalized


def _build_diff(
    session: Session,
    job: JobRecord,
    findings: list[CodeFinding],
    head_scan_id: str,
) -> tuple[FindingDiff, ...]:
    base_scan_id = job.payload.get("base_scan_id")
    if not isinstance(base_scan_id, str):
        return ()
    base = ScanRepository(session).get(base_scan_id)
    if base is None:
        return ()
    previous = [
        CodeFinding.model_validate(item)
        for item in base.result_payload.get("code_findings", [])
    ]
    return compare_rescan(
        previous,
        findings,
        base_scan_id=base_scan_id,
        head_scan_id=head_scan_id,
    )
