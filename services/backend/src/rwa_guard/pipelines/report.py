from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime

from rwa_guard.domain.contracts import (
    CodeFinding,
    ControlSpec,
    EvidenceKind,
    EvidenceReport,
    FindingStatus,
    ImplementationStatus,
    MismatchFinding,
    OnchainEvidence,
    ReportLineage,
    ScanRun,
    Severity,
)

REPORT_PIPELINE_VERSION = "1.0.0"


def validate_report_integrity(report: EvidenceReport) -> None:
    if report.lineage.input_hashes != report.scan_run.input_hashes:
        raise ValueError("lineage input hashes do not match scan inputs")
    if report.lineage.rule_versions != report.scan_run.rule_versions:
        raise ValueError("lineage rule versions do not match scan rule versions")
    if report.lineage.generated_at != report.generated_at:
        raise ValueError("lineage timestamp does not match report timestamp")
    expected_models = (
        {report.lineage.ai_model} if report.lineage.ai_model is not None else set()
    )
    if set(report.lineage.model_versions) != expected_models:
        raise ValueError("lineage AI model does not match model versions")
    if any(not version.strip() for version in report.lineage.model_versions.values()):
        raise ValueError("lineage AI model version cannot be empty")
    controls = {item.constraint_id: item for item in report.controls}
    findings = {item.finding_id: item for item in report.code_findings}
    chain_refs = {
        f"{item.tx_hash}:{item.log_index}"
        for item in report.onchain_evidence
        if item.asset_id == report.scan_run.asset_id
    }
    if len(controls) != len(report.controls) or len(findings) != len(report.code_findings):
        raise ValueError("report contains duplicate evidence identifiers")
    input_hashes = set(report.scan_run.input_hashes.values())
    if any(item.asset_id != report.scan_run.asset_id for item in report.onchain_evidence):
        raise ValueError("onchain evidence belongs to another asset")
    for control in report.controls:
        if control.asset_id != report.scan_run.asset_id:
            raise ValueError("control belongs to another asset")
        if control.evidence_span.document_id != control.document_id:
            raise ValueError("control evidence belongs to another document")
    for finding in report.code_findings:
        if finding.scan_id != report.scan_run.scan_id:
            raise ValueError("finding belongs to another scan")
        if finding.source_hash not in input_hashes:
            raise ValueError("finding source hash is absent from scan inputs")
        if finding.rule_id not in report.scan_run.rule_versions:
            raise ValueError("finding rule version is absent from scan lineage")
        finding_rule_version = finding.tool_versions.get("rule")
        if (
            finding_rule_version is not None
            and finding_rule_version != report.scan_run.rule_versions[finding.rule_id]
        ):
            raise ValueError("finding rule version disagrees with scan lineage")
        for key, value in finding.tool_versions.items():
            lineage_key = f"finding:{finding.finding_id}:{key}"
            if report.lineage.tool_versions.get(lineage_key) != value:
                raise ValueError("finding tool version is absent from report lineage")
    for mismatch in report.mismatches:
        linked_control = controls.get(mismatch.constraint_id)
        linked_finding = findings.get(mismatch.finding_id)
        if linked_control is None or linked_finding is None:
            raise ValueError("mismatch references missing evidence")
        refs = {(link.kind, link.ref) for link in mismatch.evidence_links}
        if (EvidenceKind.DOCUMENT, linked_control.constraint_id) not in refs:
            raise ValueError("mismatch document reference does not resolve")
        if (EvidenceKind.CODE, linked_finding.finding_id) not in refs:
            raise ValueError("mismatch code reference does not resolve")
        for link in mismatch.evidence_links:
            if link.kind is EvidenceKind.DOCUMENT and link.ref not in controls:
                raise ValueError("mismatch document reference does not resolve")
            if link.kind is EvidenceKind.CODE and link.ref not in findings:
                raise ValueError("mismatch code reference does not resolve")
            if link.kind is EvidenceKind.CHAIN and link.ref not in chain_refs:
                raise ValueError("mismatch chain reference does not resolve")
    validate_confirmed_evidence(
        list(report.controls),
        list(report.code_findings),
        list(report.mismatches),
    )


def validate_confirmed_evidence(
    controls: list[ControlSpec],
    findings: list[CodeFinding],
    mismatches: list[MismatchFinding],
) -> None:
    control_ids = {item.constraint_id for item in controls}
    finding_ids = {item.finding_id for item in findings}
    linked_finding_ids: set[str] = set()
    for mismatch in mismatches:
        if mismatch.constraint_id not in control_ids:
            raise ValueError(f"Unknown control evidence: {mismatch.constraint_id}")
        if mismatch.finding_id not in finding_ids:
            raise ValueError(f"Unknown code evidence: {mismatch.finding_id}")
        document_refs = {
            link.ref for link in mismatch.evidence_links if link.kind is EvidenceKind.DOCUMENT
        }
        code_refs = {link.ref for link in mismatch.evidence_links if link.kind is EvidenceKind.CODE}
        if mismatch.constraint_id not in document_refs:
            raise ValueError(f"Mismatch does not link its control: {mismatch.constraint_id}")
        if mismatch.finding_id not in code_refs:
            raise ValueError(f"Mismatch does not link its finding: {mismatch.finding_id}")
        linked_finding_ids.add(mismatch.finding_id)
        if (
            mismatch.implementation_status is ImplementationStatus.MISSING
            and mismatch.severity in {Severity.CRITICAL, Severity.HIGH}
        ):
            control = next(
                item for item in controls if item.constraint_id == mismatch.constraint_id
            )
            finding = next(item for item in findings if item.finding_id == mismatch.finding_id)
            if not control.confirmed:
                raise ValueError("Critical/High MISSING mismatch requires confirmed ControlSpec")
            if finding.status is not FindingStatus.CONFIRMED:
                raise ValueError("Critical/High MISSING mismatch requires CONFIRMED CodeFinding")
    orphan_ids = sorted(
        finding.finding_id
        for finding in findings
        if finding.status is FindingStatus.CONFIRMED
        and finding.severity in {Severity.CRITICAL, Severity.HIGH}
        and finding.finding_id not in linked_finding_ids
    )
    if orphan_ids:
        raise ValueError(
            "orphan CONFIRMED Critical/High CodeFinding: " + ", ".join(orphan_ids)
        )


def build_evidence_report(
    *,
    report_id: str,
    scan_run: ScanRun,
    controls: list[ControlSpec],
    findings: list[CodeFinding],
    mismatches: list[MismatchFinding],
    onchain_evidence: list[OnchainEvidence],
    tool_versions: dict[str, str],
    model_versions: dict[str, str],
    limitations: list[str],
    generated_at: datetime | None = None,
    document_extractor: str = "unknown",
    ai_model: str | None = None,
) -> EvidenceReport:
    validate_confirmed_evidence(controls, findings, mismatches)
    if any(control.asset_id != scan_run.asset_id for control in controls):
        raise ValueError("Control evidence belongs to another asset")
    if any(finding.scan_id != scan_run.scan_id for finding in findings):
        raise ValueError("Code finding belongs to another scan")
    if any(item.asset_id != scan_run.asset_id for item in onchain_evidence):
        raise ValueError("Onchain evidence belongs to another asset")
    timestamp = generated_at or datetime.now(UTC)
    snapshot_scan = ScanRun.model_validate(scan_run.model_dump(mode="json"))
    snapshot_controls = [
        ControlSpec.model_validate(item.model_dump(mode="json")) for item in controls
    ]
    snapshot_findings = [
        CodeFinding.model_validate(item.model_dump(mode="json")) for item in findings
    ]
    snapshot_mismatches = [
        MismatchFinding.model_validate(item.model_dump(mode="json")) for item in mismatches
    ]
    snapshot_onchain = [
        OnchainEvidence.model_validate(item.model_dump(mode="json"))
        for item in onchain_evidence
    ]
    lineage = ReportLineage(
        input_hashes=dict(snapshot_scan.input_hashes),
        document_extractor=document_extractor,
        ai_model=ai_model or next(iter(model_versions.values()), None),
        model_versions=dict(model_versions),
        rule_versions=dict(snapshot_scan.rule_versions),
        tool_versions={
            "report_pipeline": REPORT_PIPELINE_VERSION,
            **tool_versions,
            **{
                f"finding:{finding.finding_id}:{key}": value
                for finding in snapshot_findings
                for key, value in finding.tool_versions.items()
            },
        },
        generated_at=timestamp,
        limitations=tuple(limitations),
    )
    unverified = EvidenceReport.model_construct(
        report_id=report_id,
        report_hash="",
        scan_run=snapshot_scan,
        controls=snapshot_controls,
        code_findings=snapshot_findings,
        mismatches=snapshot_mismatches,
        onchain_evidence=snapshot_onchain,
        lineage=lineage,
        generated_at=timestamp,
        is_synthetic=True,
    )
    snapshot_payload = unverified.snapshot_payload()
    canonical = json.dumps(
        snapshot_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    report_hash = f"sha256:{hashlib.sha256(canonical).hexdigest()}"
    report = EvidenceReport.model_validate(
        {
            **snapshot_payload,
            "report_hash": report_hash,
        }
    )
    validate_report_integrity(report)
    return report
