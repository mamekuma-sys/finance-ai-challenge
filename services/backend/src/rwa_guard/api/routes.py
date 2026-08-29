from __future__ import annotations

import base64
import hashlib
import html
import json
import logging
import math
import secrets
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal, cast
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from rwa_guard.api.dependencies import (
    OperatorContext,
    get_app_settings,
    get_session,
    mutation_auth_ready,
    require_operator,
)
from rwa_guard.api.errors import APIError
from rwa_guard.config import Settings, get_settings, is_strong_operator_access_code
from rwa_guard.db.models import (
    AlertRecord,
    AssetRecord,
    AuditLogRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    PolicyConstraintRecord,
    ReportImmutableError,
    ReportRecord,
    ScanRunRecord,
)
from rwa_guard.db.repositories import (
    AlertRepository,
    AssetRepository,
    AuditLogRepository,
    ContractRepository,
    DocumentRepository,
    JobRepository,
    OperatorLoginAttemptRepository,
    PolicyDocumentConflict,
    PolicyOwnershipConflict,
    PolicyRepository,
    PolicyVersionConflict,
    ReportRepository,
    ScanRepository,
    WorkerHeartbeatRepository,
)
from rwa_guard.domain.contracts import (
    AlertPatchRequest,
    AlertStatus,
    AlertSummary,
    AssetDetail,
    AssetStatus,
    AssetSummary,
    CodeFinding,
    ContractCreateRequest,
    ContractCreateResponse,
    ContractSourceKind,
    ControlSpec,
    CreateAssetRequest,
    CreateAssetResponse,
    DashboardResponse,
    DataFreshness,
    DemoBootstrapResponse,
    DocumentContentResponse,
    DocumentResponse,
    DocumentStatus,
    EvidenceLink,
    EvidenceMode,
    EvidenceReport,
    EvidenceSpan,
    FailedStage,
    FindingDiff,
    FindingStatus,
    ImplementationStatus,
    LatestScanRef,
    MismatchFinding,
    OnchainEvidence,
    PolicyPatchRequest,
    ReportDownloadMetadata,
    ReportFormat,
    ReportResponse,
    ReportStatus,
    ScanCreateRequest,
    ScanCreateResponse,
    ScanResultResponse,
    ScanRun,
    ScanStatus,
    Severity,
)
from rwa_guard.fixture_store import (
    FixtureStore,
    FixtureUnavailable,
    fixture_store_for_settings,
)
from rwa_guard.fixtures import build_demo_report, merge_solidity_sources
from rwa_guard.pipelines.contract import compare_rescan
from rwa_guard.pipelines.document import (
    DocumentExtractionError,
    extract_document_pages,
    stable_constraint_id,
)
from rwa_guard.pipelines.report import validate_report_integrity

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_ORACLE_MAX_AGE_MINUTES = 24 * 60
P0_CONTROL_FIELDS = frozenset(
    {
        "max_supply",
        "collateral_verified",
        "issuer_role",
        "oracle_max_age",
        "price_band_breach",
        "pauser_role",
    }
)
ALERT_TRANSITIONS: dict[AlertStatus, frozenset[AlertStatus]] = {
    AlertStatus.NEW: frozenset({AlertStatus.ACKNOWLEDGED}),
    AlertStatus.ACKNOWLEDGED: frozenset({AlertStatus.INVESTIGATING}),
    AlertStatus.INVESTIGATING: frozenset(
        {AlertStatus.RESOLVED, AlertStatus.FALSE_POSITIVE}
    ),
    AlertStatus.RESOLVED: frozenset(),
    AlertStatus.FALSE_POSITIVE: frozenset(),
}


def _integrity_sqlstate(error: IntegrityError) -> str | None:
    return cast(
        str | None,
        getattr(error.orig, "sqlstate", None) or getattr(error.orig, "pgcode", None),
    )


def _is_unique_integrity_error(error: IntegrityError, dialect_name: str) -> bool:
    if dialect_name == "postgresql":
        return _integrity_sqlstate(error) == "23505"
    if dialect_name == "sqlite":
        return "unique constraint failed" in str(error.orig).lower()
    return False


def _is_report_immutable_integrity_error(error: IntegrityError) -> bool:
    return "ready report is immutable" in str(error.orig).lower()


def _integrity_kind(error: IntegrityError, dialect_name: str) -> str:
    sqlstate = _integrity_sqlstate(error)
    if dialect_name == "postgresql":
        return {
            "23502": "NOT_NULL",
            "23503": "FOREIGN_KEY",
            "23505": "UNIQUE",
            "23514": "CHECK",
        }.get(sqlstate or "", "OTHER")
    if dialect_name == "sqlite":
        message = str(error.orig).lower()
        for marker, kind in (
            ("foreign key constraint failed", "FOREIGN_KEY"),
            ("check constraint failed", "CHECK"),
            ("not null constraint failed", "NOT_NULL"),
            ("unique constraint failed", "UNIQUE"),
        ):
            if marker in message:
                return kind
    return "OTHER"


def _log_bootstrap_integrity_error(
    error: IntegrityError, dialect_name: str
) -> None:
    diagnostic = getattr(error.orig, "diag", None)
    logger.error(
        "demo bootstrap integrity failure: dialect=%s kind=%s "
        "sqlstate=%s constraint=%s driver=%s",
        dialect_name,
        _integrity_kind(error, dialect_name),
        _integrity_sqlstate(error),
        getattr(diagnostic, "constraint_name", None),
        type(error.orig).__name__,
    )


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["rwa-guard-api"]
    p0_ready: bool
    p1_chain: Literal["configured", "disabled"]


class ReadyResponse(BaseModel):
    status: Literal["ready"]
    database: Literal["ready"]


class OperatorReadyResponse(BaseModel):
    ready: Literal[True]


class OperatorVerifyResponse(BaseModel):
    verified: Literal[True]


OPERATOR_LOGIN_WINDOW = timedelta(minutes=15)
OPERATOR_LOGIN_MAX_FAILURES = 5
OPERATOR_VERIFY_MAX_BODY_BYTES = 1024


def _operator_now() -> datetime:
    return datetime.now(UTC)


def _readiness_now() -> datetime:
    return datetime.now(UTC)


def _fixture_store_or_503(settings: Settings) -> FixtureStore:
    try:
        return fixture_store_for_settings(settings)
    except FixtureUnavailable as error:
        raise APIError(
            503,
            "FIXTURE_UNAVAILABLE",
            f"{error}; configure RWA_GUARD_FIXTURE_ROOT with the packaged P0 fixtures",
        ) from error


def _not_found(kind: str, resource_id: str) -> APIError:
    return APIError(404, f"{kind.upper()}_NOT_FOUND", f"{kind} not found: {resource_id}")


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _utc_required(value: datetime) -> datetime:
    normalized = _utc(value)
    if normalized is None:
        raise ValueError("required datetime cannot be None")
    return normalized


def derive_scan_freshness(
    *,
    status: str,
    completed_at: datetime | None,
    now: datetime | None = None,
    max_age_minutes: int | float | None = None,
) -> DataFreshness | None:
    if status in {ScanStatus.FAILED.value, ScanStatus.PARTIAL.value}:
        return DataFreshness.INVALID
    if status != ScanStatus.COMPLETED.value or completed_at is None:
        return None
    observed_at = _utc_required(completed_at)
    current = now or datetime.now(UTC)
    threshold = float(max_age_minutes) if max_age_minutes and max_age_minutes > 0 else 60.0
    age_minutes = max(0.0, (current - observed_at).total_seconds() / 60)
    if age_minutes <= threshold / 2:
        return DataFreshness.FRESH
    if age_minutes <= threshold:
        return DataFreshness.AGING
    return DataFreshness.STALE


def _oracle_max_age_minutes(session: Session, asset_id: str) -> float | None:
    policies = PolicyRepository(session)
    document = DocumentRepository(session).latest_by_asset(asset_id)
    if document is None:
        return None
    for policy in policies.list_by_document(document.id):
        if policy.field_name != "oracle_max_age":
            continue
        if not policy.confirmed:
            return None
        normalized = policy.normalized_value
        if not isinstance(normalized, dict):
            return None
        unit = normalized.get("unit")
        if not isinstance(unit, str) or unit.strip().upper() != "MINUTE":
            return None
        value = normalized.get("value")
        if (
            isinstance(value, (int, float))
            and not isinstance(value, bool)
            and math.isfinite(value)
            and 0 < value <= MAX_ORACLE_MAX_AGE_MINUTES
        ):
            return float(value)
        return None
    return None


def _policy_contract(record: PolicyConstraintRecord) -> ControlSpec:
    value = record.normalized_value
    if isinstance(value, dict) and "value" in value:
        normalized_value = value["value"]
        unit = value.get("unit")
    else:
        normalized_value = value
        unit = None
    return ControlSpec(
        asset_id=record.asset_id,
        document_id=record.document_id,
        constraint_id=record.id,
        field=record.field_name,
        value=normalized_value,
        unit=unit,
        evidence_span=EvidenceSpan.model_validate(record.evidence_span),
        confirmed=record.confirmed,
        version=record.version,
    )


def _policy_audit_state(record: PolicyConstraintRecord | None) -> dict[str, object] | None:
    if record is None:
        return None
    control = _policy_contract(record)
    return {
        "value": control.value,
        "unit": control.unit,
        "confirmed": control.confirmed,
        "version": control.version,
        "evidence_span": control.evidence_span.model_dump(mode="json"),
    }


def _document_contract(session: Session, record: IssuanceDocumentRecord) -> DocumentResponse:
    policies = PolicyRepository(session).list_by_document(record.id)
    controls = [_policy_contract(item) for item in policies]
    return DocumentResponse(
        document_id=record.id,
        asset_id=record.asset_id,
        status=DocumentStatus(record.status),
        file_hash=record.file_hash,
        version=record.version,
        media_type=record.media_type,
        size_bytes=record.size_bytes,
        page_count=record.page_count,
        failed_pages=record.failed_pages,
        controls=controls,
        uploaded_at=_utc_required(record.uploaded_at),
        processed_at=_utc(record.processed_at),
        error_code=record.error_code,
    )


def _contract_response(record: ContractRecord) -> ContractCreateResponse:
    if record.chain_id is None:
        raise ValueError("contract chain_id is required by the API contract")
    return ContractCreateResponse(
        contract_id=record.id,
        asset_id=record.asset_id,
        source_kind=ContractSourceKind(record.source_kind),
        chain_id=record.chain_id,
        address=record.address,
        source_hash=record.source_hash,
        proxy_status=record.proxy_status,
        created_at=_utc_required(record.created_at),
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


def _asset_detail(session: Session, record: AssetRecord) -> AssetDetail:
    return AssetDetail(
        asset_id=record.id,
        name=record.name,
        asset_type=cast(
            Literal["SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE"], record.asset_type
        ),
        status=AssetStatus(record.status),
        underlying_description=record.underlying_description,
        total_planned_supply=record.total_planned_supply,
        network=cast(Literal["KAIA_KAIROS"], record.network),
        currency=record.currency,
        token_unit=record.token_unit,
        documents=[
            _document_contract(session, item)
            for item in DocumentRepository(session).list_by_asset(record.id)
        ],
        contracts=[
            _contract_response(item)
            for item in ContractRepository(session).list_by_asset(record.id)
        ],
        scans=[_scan_contract(item) for item in ScanRepository(session).list_by_asset(record.id)],
        created_at=_utc_required(record.created_at),
    )


def _alert_contract(session: Session, record: AlertRecord) -> AlertSummary:
    asset = AssetRepository(session).get(record.asset_id)
    if asset is None:
        raise _not_found("asset", record.asset_id)
    return AlertSummary(
        alert_id=record.id,
        asset_id=record.asset_id,
        asset_name=asset.name,
        alert_type=record.alert_type,
        severity=Severity(record.severity),
        status=AlertStatus(record.status),
        memo=record.memo,
        cause=record.cause,
        evidence_links=[EvidenceLink.model_validate(item) for item in record.evidence_links],
        evidence_mode=EvidenceMode(record.evidence_mode),
        fixture_version=record.fixture_version,
        created_at=_utc_required(record.created_at),
        updated_at=_utc_required(record.updated_at),
    )


def _download_metadata(record: ReportRecord) -> list[ReportDownloadMetadata]:
    if record.evidence is None:
        return []
    report = _validated_report(record)
    serialized = _serialize_report(report)
    rendered_html = _render_report_html(report)
    return [
        ReportDownloadMetadata(
            format=ReportFormat.JSON,
            media_type="application/json",
            url=f"/v1/reports/{record.id}/download?format=json",
            sha256=f"sha256:{hashlib.sha256(serialized.encode()).hexdigest()}",
        ),
        ReportDownloadMetadata(
            format=ReportFormat.HTML,
            media_type="text/html",
            url=f"/v1/reports/{record.id}/download?format=html",
            sha256=f"sha256:{hashlib.sha256(rendered_html.encode()).hexdigest()}",
        ),
    ]


def _serialize_report(evidence: EvidenceReport) -> str:
    return json.dumps(
        evidence.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _render_report_html(report: EvidenceReport) -> str:
    controls = {item.constraint_id: item for item in report.controls}
    findings = {item.finding_id: item for item in report.code_findings}

    def escape(value: object) -> str:
        return html.escape(str(value), quote=True)

    def json_pre(value: object) -> str:
        serialized = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)
        return f"<pre>{escape(serialized)}</pre>"

    evidence_sections: list[str] = []
    for mismatch in report.mismatches:
        control = controls[mismatch.constraint_id]
        finding = findings[mismatch.finding_id]
        evidence_sections.append(
            "<article>"
            f"<h3>{escape(mismatch.severity.value)} · "
            f"{escape(mismatch.implementation_status.value)}</h3>"
            f"<p><strong>문서:</strong> {escape(control.field)} "
            f"(p.{control.evidence_span.page}, "
            f"span {control.evidence_span.start}–{control.evidence_span.end})</p>"
            f"<blockquote>{escape(control.evidence_span.quote)}</blockquote>"
            f"<p><strong>코드:</strong> {escape(finding.rule_id)} · "
            f"{escape(finding.code_location.file)}:"
            f"{finding.code_location.start_line}–{finding.code_location.end_line}</p>"
            f"<pre>{escape(finding.code_location.excerpt)}</pre>"
            "</article>"
        )

    onchain_items = "".join(
        "<li>"
        f"{escape(item.mode.value)} · block {item.block_number} · "
        f"{escape(item.event_name)} · {escape(item.tx_hash)}:{item.log_index}"
        "</li>"
        for item in report.onchain_evidence
    )
    limitations = "".join(f"<li>{escape(item)}</li>" for item in report.lineage.limitations)
    confirmed = [
        finding
        for finding in report.code_findings
        if finding.status is FindingStatus.CONFIRMED
        and finding.severity in {Severity.CRITICAL, Severity.HIGH}
    ]
    replay_label = (
        "<p><strong>REPLAY · 재현 데이터</strong></p>"
        if any(item.mode is EvidenceMode.REPLAY for item in report.onchain_evidence)
        else "<p>연결된 온체인 증거 없음</p>"
    )
    return (
        "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        "<title>RWA Guard Evidence Report</title>"
        "<style>body{font-family:sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem}"
        "section,article{margin:1.5rem 0}pre,blockquote{white-space:pre-wrap;"
        "overflow-wrap:anywhere;background:#f4f5f7;padding:1rem}</style></head><body>"
        "<header><h1>RWA Guard Evidence Report</h1>"
        "<p><strong>합성 데이터 기반 기술적 통제 보조 자료</strong></p>"
        f"<p>report_hash: <code>{escape(report.report_hash)}</code></p></header>"
        "<main>"
        "<section aria-labelledby=\"verdict\"><h2 id=\"verdict\">판정</h2>"
        f"<p>확정 Critical/High 코드 발견사항 {len(confirmed)}건, "
        f"문서–코드 불일치 {len(report.mismatches)}건</p></section>"
        "<section aria-labelledby=\"evidence\"><h2 id=\"evidence\">문서·코드 증거</h2>"
        f"{''.join(evidence_sections) or '<p>연결된 불일치 증거 없음</p>'}</section>"
        "<section aria-labelledby=\"onchain\"><h2 id=\"onchain\">온체인 증거</h2>"
        f"{replay_label}<ul>{onchain_items}</ul></section>"
        "<section aria-labelledby=\"lineage\"><h2 id=\"lineage\">계보</h2>"
        f"<h3>문서 추출기</h3><p>{escape(report.lineage.document_extractor)}</p>"
        "<h3>AI 모델 버전</h3>"
        + (
            json_pre(report.lineage.model_versions)
            if report.lineage.model_versions
            else "<p>AI 모델 없음</p>"
        )
        +
        "<h3>입력 해시</h3>"
        f"{json_pre(report.lineage.input_hashes)}<h3>룰 버전</h3>"
        f"{json_pre(report.lineage.rule_versions)}<h3>도구 버전</h3>"
        f"{json_pre(report.lineage.tool_versions)}</section>"
        "<section aria-labelledby=\"limitations\"><h2 id=\"limitations\">제한사항</h2>"
        f"<ul>{limitations}</ul></section>"
        "<section aria-labelledby=\"review\"><h2 id=\"review\">담당자 검토 필요</h2>"
        "<p>이 리포트는 투자 권유나 법률 의견이 아니며 자동 발행 승인 또는 "
        "거래정지를 수행하지 않습니다.</p></section>"
        "</main></body></html>"
    )


def _report_contract(record: ReportRecord) -> ReportResponse:
    report = _validated_report(record) if record.evidence is not None else None
    return ReportResponse(
        report_id=record.id,
        scan_id=record.scan_id,
        status=ReportStatus(record.status),
        report=report,
        downloads=_download_metadata(record),
        limitations=record.limitations,
        error_code=record.error_code,
        generated_at=_utc(record.generated_at),
    )


def _validated_report(record: ReportRecord) -> EvidenceReport:
    try:
        report = EvidenceReport.model_validate(record.evidence)
        validate_report_integrity(report)
        if record.id != report.report_id:
            raise ValueError("report envelope id does not match snapshot")
        if record.asset_id != report.scan_run.asset_id:
            raise ValueError("report envelope asset does not match snapshot")
        if record.scan_id != report.scan_run.scan_id:
            raise ValueError("report envelope scan does not match snapshot")
        if _utc(record.generated_at) != report.generated_at:
            raise ValueError("report envelope timestamp does not match snapshot")
        if record.report_hash != report.report_hash:
            raise ValueError("report envelope hash does not match snapshot")
        return report
    except (ValueError, TypeError) as error:
        raise APIError(
            409,
            "REPORT_INTEGRITY_FAILED",
            "persisted report failed immutable snapshot verification",
        ) from error


def _health(settings: Settings) -> HealthResponse:
    try:
        fixture_store_for_settings(settings)
        fixtures_ready = True
    except FixtureUnavailable:
        fixtures_ready = False
    return HealthResponse(
        status="ok",
        service="rwa-guard-api",
        p0_ready=mutation_auth_ready(settings) and fixtures_ready,
        p1_chain="configured" if settings.kaia_rpc_url else "disabled",
    )


def health() -> HealthResponse:
    """Import-compatible health helper retained from the original main module."""
    return _health(get_settings())


@router.get("/health", response_model=HealthResponse, tags=["operations"])
def health_route(
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> HealthResponse:
    return _health(settings)


@router.get("/health/operator", response_model=OperatorReadyResponse, tags=["operations"])
def operator_health(
    _operator: Annotated[OperatorContext, Depends(require_operator)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    session: Annotated[Session, Depends(get_session)],
) -> OperatorReadyResponse:
    """Verify the configured operator bearer context without mutating state."""
    if not is_strong_operator_access_code(settings.operator_access_code):
        raise APIError(
            503,
            "OPERATOR_ACCESS_CODE_WEAK",
            "operator access code is not production ready",
        )
    try:
        OperatorLoginAttemptRepository(session).check_ready()
    except SQLAlchemyError as error:
        session.rollback()
        raise APIError(
            503,
            "OPERATOR_LOGIN_STORE_NOT_READY",
            "operator login protection is not ready",
        ) from error
    return OperatorReadyResponse(ready=True)


@router.post(
    "/v1/operator/session/verify",
    response_model=OperatorVerifyResponse,
    tags=["operations"],
)
async def verify_operator_session(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
) -> OperatorVerifyResponse:
    if not is_strong_operator_access_code(settings.operator_access_code):
        raise APIError(
            503,
            "OPERATOR_ACCESS_CODE_WEAK",
            "operator access code is not production ready",
        )
    declared_length = request.headers.get("content-length")
    if declared_length is not None:
        try:
            if int(declared_length) > OPERATOR_VERIFY_MAX_BODY_BYTES:
                raise APIError(413, "OPERATOR_VERIFY_TOO_LARGE", "request body is too large")
        except ValueError as error:
            raise APIError(
                400,
                "OPERATOR_VERIFY_INVALID",
                "invalid verification request",
            ) from error
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > OPERATOR_VERIFY_MAX_BODY_BYTES:
            raise APIError(413, "OPERATOR_VERIFY_TOO_LARGE", "request body is too large")
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as error:
        raise APIError(400, "OPERATOR_VERIFY_INVALID", "invalid verification request") from error
    if not isinstance(payload, dict):
        raise APIError(400, "OPERATOR_VERIFY_INVALID", "invalid verification request")
    fingerprint = payload.get("fingerprint")
    access_code = payload.get("access_code")
    if (
        not isinstance(fingerprint, str)
        or len(fingerprint) != 67
        or not fingerprint.startswith("fp_")
        or any(character not in "0123456789abcdef" for character in fingerprint[3:])
        or not isinstance(access_code, str)
        or len(access_code) > 256
    ):
        raise APIError(400, "OPERATOR_VERIFY_INVALID", "invalid verification request")

    repository = OperatorLoginAttemptRepository(session)
    now = _operator_now()
    attempt = repository.lock_or_create(fingerprint, now)
    if repository.is_locked(attempt, now):
        session.rollback()
        raise APIError(429, "OPERATOR_VERIFY_RATE_LIMITED", "verification temporarily unavailable")

    expected_code = settings.operator_access_code
    assert expected_code is not None
    supplied = hashlib.sha256(access_code.encode("utf-8")).digest()
    expected = hashlib.sha256(expected_code.encode("utf-8")).digest()
    if secrets.compare_digest(supplied, expected):
        repository.clear(attempt)
        session.commit()
        return OperatorVerifyResponse(verified=True)

    repository.register_failure(
        attempt,
        now,
        window=OPERATOR_LOGIN_WINDOW,
        max_failures=OPERATOR_LOGIN_MAX_FAILURES,
    )
    session.commit()
    raise APIError(401, "OPERATOR_VERIFY_FAILED", "verification failed")


@router.get("/health/ready", response_model=ReadyResponse, tags=["operations"])
def ready(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ReadyResponse:
    if not mutation_auth_ready(settings):
        raise APIError(
            503,
            "OPERATOR_AUTH_NOT_CONFIGURED",
            "mutation authentication is not configured",
        )
    _fixture_store_or_503(settings)
    try:
        session.execute(text("select 1"))
    except Exception as error:
        raise APIError(503, "DATABASE_NOT_READY", "database connection is unavailable") from error
    heartbeat = WorkerHeartbeatRepository(session).latest()
    if heartbeat is None:
        raise APIError(
            503,
            "WORKER_HEARTBEAT_MISSING",
            "worker heartbeat is missing; start or inspect the worker",
        )
    last_seen = heartbeat.last_seen_at
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=UTC)
    cutoff = _readiness_now() - timedelta(
        seconds=settings.worker_heartbeat_freshness_seconds
    )
    if heartbeat.status != "READY" or last_seen < cutoff:
        raise APIError(
            503,
            "WORKER_HEARTBEAT_STALE",
            "worker heartbeat is stale or not ready; inspect the worker",
        )
    return ReadyResponse(status="ready", database="ready")


@router.get("/v1/demo/evidence-report", response_model=EvidenceReport, tags=["demo"])
def demo_evidence_report(
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> EvidenceReport:
    return build_demo_report(_fixture_store_or_503(settings))


@router.post(
    "/v1/demo/bootstrap",
    response_model=DemoBootstrapResponse,
    status_code=201,
    tags=["demo"],
)
def demo_bootstrap(
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
) -> DemoBootstrapResponse:
    """Persist the deterministic REPLAY fixture without AI, RPC, or a worker."""

    fixture_store = _fixture_store_or_503(settings)
    report = build_demo_report(fixture_store)
    fixture_version = (
        report.onchain_evidence[0].fixture_version
        if report.onchain_evidence
        else "0.1.0"
    ) or "0.1.0"
    asset_id = report.scan_run.asset_id
    document_id = report.controls[0].document_id
    contract_id = "contract_demo_vulnerable_01"

    result = DemoBootstrapResponse(
        asset_id=asset_id,
        document_id=document_id,
        contract_id=contract_id,
        scan_id=report.scan_run.scan_id,
        report_id=report.report_id,
        evidence_mode=EvidenceMode.REPLAY,
        fixture_version=fixture_version,
    )
    document_path = fixture_store.path("data/synthetic/documents/issuance-terms-01.txt")
    document_bytes = fixture_store.read_bytes(
        "data/synthetic/documents/issuance-terms-01.txt"
    )
    source_code = merge_solidity_sources(
        fixture_store.read_text("chain/src/fixtures/VulnerableRwaToken.sol"),
        fixture_store.read_text("chain/src/fixtures/VulnerableOracle.sol"),
    )
    started_at = report.scan_run.started_at
    completed_at = report.scan_run.completed_at or report.generated_at

    asset = AssetRecord(
        id=asset_id,
        name="합성 한강 오피스 수익증권",
        asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        status=AssetStatus.REVIEW_REQUIRED.value,
        underlying_description="서울 소재 합성 상업용 부동산 수익증권 fixture",
        total_planned_supply=100_000,
        network="KAIA_KAIROS",
        currency="KRW",
        token_unit="TOKEN",
        created_at=started_at,
    )
    document = IssuanceDocumentRecord(
        id=document_id,
        asset_id=asset_id,
        file_hash=report.scan_run.input_hashes["document"],
        version=fixture_version,
        storage_path=str(document_path),
        status=DocumentStatus.READY.value,
        media_type="text/plain",
        size_bytes=len(document_bytes),
        page_count=max(control.evidence_span.page for control in report.controls),
        failed_pages=[],
        extraction_metadata={"fixture_version": fixture_version, "source": "data/synthetic"},
        uploaded_at=started_at,
        processed_at=completed_at,
    )
    contract = ContractRecord(
        id=contract_id,
        asset_id=asset_id,
        chain_id=1001,
        source_kind=ContractSourceKind.SOURCE.value,
        source_code=source_code,
        source_hash=report.scan_run.input_hashes["contract_source"],
        proxy_status="NOT_CHECKED",
        created_at=started_at,
    )
    scan = ScanRunRecord(
        id=report.scan_run.scan_id,
        asset_id=asset_id,
        contract_id=contract_id,
        status=ScanStatus.COMPLETED.value,
        input_hashes=report.scan_run.input_hashes,
        rule_versions=report.scan_run.rule_versions,
        failed_stages=[],
        result_payload={
            "code_findings": [item.model_dump(mode="json") for item in report.code_findings],
            "mismatches": [item.model_dump(mode="json") for item in report.mismatches],
            "onchain_evidence": [
                item.model_dump(mode="json") for item in report.onchain_evidence
            ],
            "diff": [],
        },
        started_at=started_at,
        completed_at=completed_at,
    )
    stored_report = ReportRecord(
        id=report.report_id,
        asset_id=asset_id,
        scan_id=scan.id,
        status=ReportStatus.READY.value,
        evidence=report.model_dump(mode="json"),
        report_hash=report.report_hash,
        downloads={},
        limitations=list(report.lineage.limitations),
        generated_at=report.generated_at,
    )
    lead = report.mismatches[0]
    alert = AlertRecord(
        id="alert_demo_critical_01",
        asset_id=asset_id,
        alert_type="CRITICAL_CONTROL_MISMATCH",
        severity=Severity.CRITICAL.value,
        status=AlertStatus.NEW.value,
        cause={"mismatch_id": lead.mismatch_id},
        evidence_links=[item.model_dump(mode="json") for item in lead.evidence_links],
        dedupe_key=f"demo:{fixture_version}:{lead.mismatch_id}",
        evidence_mode=EvidenceMode.REPLAY.value,
        fixture_version=fixture_version,
        created_at=completed_at,
        updated_at=completed_at,
    )
    created = False
    for attempt in range(2):
        dialect_name = session.get_bind().dialect.name
        if dialect_name == "postgresql":
            session.execute(
                text("select pg_advisory_xact_lock(hashtext(:lock_name))"),
                {"lock_name": "rwa_guard_demo_bootstrap_v1"},
            )
        existed = AssetRepository(session).get(asset_id) is not None
        owned_records = [
            session.get(IssuanceDocumentRecord, document_id),
            session.get(ContractRecord, contract_id),
            session.get(ScanRunRecord, scan.id),
            session.get(ReportRecord, stored_report.id),
            session.get(AlertRecord, alert.id),
        ]
        if any(
            record is not None and record.asset_id != asset_id
            for record in owned_records
        ):
            raise APIError(
                409,
                "DEMO_FIXTURE_ID_CONFLICT",
                "a fixed demo identifier belongs to another asset",
            )
        for control in report.controls:
            existing_policy = session.get(PolicyConstraintRecord, control.constraint_id)
            if existing_policy is not None and existing_policy.asset_id != asset_id:
                raise APIError(
                    409,
                    "DEMO_FIXTURE_ID_CONFLICT",
                    "a fixed demo control identifier belongs to another asset",
                )
        try:
            if existed:
                session.merge(asset)
            else:
                session.add(asset)
            session.flush()

            for record in (document, contract):
                session.merge(record)
            session.flush()

            session.merge(scan)
            session.flush()

            existing_report = session.get(ReportRecord, stored_report.id)
            if existing_report is None:
                session.add(stored_report)
            elif existing_report.status == ReportStatus.READY.value:
                try:
                    existing_snapshot = _validated_report(existing_report)
                except APIError as error:
                    raise APIError(
                        409,
                        "DEMO_REPORT_INTEGRITY_CONFLICT",
                        "existing READY demo report failed immutable snapshot verification",
                    ) from error
                if existing_snapshot.report_hash != report.report_hash:
                    raise APIError(
                        409,
                        "DEMO_REPORT_CANONICAL_CONFLICT",
                        "existing READY demo report differs from the canonical fixture",
                    )
            else:
                session.merge(stored_report)
            session.flush()

            session.merge(alert)
            for control in report.controls:
                session.merge(
                    PolicyConstraintRecord(
                        id=control.constraint_id,
                        asset_id=asset_id,
                        document_id=document_id,
                        field_name=control.field,
                        normalized_value={"value": control.value, "unit": control.unit},
                        evidence_span=control.evidence_span.model_dump(mode="json"),
                        confirmed=control.confirmed,
                    )
                )
            session.flush()
            session.commit()
            created = not existed
            break
        except IntegrityError as error:
            session.rollback()
            if _is_report_immutable_integrity_error(error):
                raise APIError(
                    409,
                    "REPORT_IMMUTABLE_CONFLICT",
                    "READY report cannot be updated or deleted",
                ) from error
            if _is_unique_integrity_error(error, dialect_name):
                if attempt == 0:
                    continue
                raise APIError(
                    409,
                    "DEMO_BOOTSTRAP_RETRY",
                    "demo fixture was created concurrently; retry the request",
                ) from error
            _log_bootstrap_integrity_error(error, dialect_name)
            raise APIError(
                500,
                "DEMO_BOOTSTRAP_INTEGRITY_ERROR",
                "demo fixture persistence failed; inspect server logs",
            ) from error
        except ReportImmutableError as error:
            session.rollback()
            raise APIError(
                409,
                "REPORT_IMMUTABLE_CONFLICT",
                "READY report cannot be updated or deleted",
            ) from error
        except Exception:
            session.rollback()
            raise
    if not created:
        response.status_code = 200
    return result


@router.post(
    "/v1/assets", response_model=CreateAssetResponse, status_code=201, tags=["assets"]
)
def create_asset(
    request: CreateAssetRequest,
    session: Annotated[Session, Depends(get_session)],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
) -> CreateAssetResponse:
    now = datetime.now(UTC)
    asset = AssetRecord(
        id=f"asset_{uuid4().hex}",
        name=request.name,
        asset_type=request.asset_type,
        status=AssetStatus.UNVERIFIED.value,
        underlying_description=request.underlying_description,
        total_planned_supply=request.total_planned_supply,
        network=request.network,
        currency=request.currency,
        token_unit=request.token_unit,
        created_at=now,
    )
    with session.begin():
        AssetRepository(session).add(asset)
    return CreateAssetResponse(
        asset_id=asset.id,
        status=AssetStatus.UNVERIFIED,
        created_at=asset.created_at,
    )


@router.get("/v1/assets", response_model=list[AssetDetail], tags=["assets"])
def list_assets(session: Annotated[Session, Depends(get_session)]) -> list[AssetDetail]:
    return [_asset_detail(session, item) for item in AssetRepository(session).list_all()]


@router.get("/v1/assets/{asset_id}", response_model=AssetDetail, tags=["assets"])
def get_asset(
    asset_id: str, session: Annotated[Session, Depends(get_session)]
) -> AssetDetail:
    asset = AssetRepository(session).get(asset_id)
    if asset is None:
        raise _not_found("asset", asset_id)
    return _asset_detail(session, asset)


@router.post(
    "/v1/assets/{asset_id}/documents",
    response_model=DocumentResponse,
    status_code=201,
    tags=["documents"],
)
async def upload_document(
    asset_id: str,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    file: Annotated[UploadFile, File()],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
    is_synthetic: Annotated[bool, Form()] = True,
) -> DocumentResponse:
    if AssetRepository(session).get(asset_id) is None:
        raise _not_found("asset", asset_id)
    if not is_synthetic:
        raise APIError(422, "SYNTHETIC_ONLY", "only synthetic fixture uploads are accepted")

    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()
    allowed = {".pdf": "application/pdf", ".txt": "text/plain"}
    if extension not in allowed or file.content_type != allowed[extension]:
        raise APIError(415, "UNSUPPORTED_DOCUMENT", "only matching PDF or TXT uploads are accepted")

    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(64 * 1024):
        size += len(chunk)
        if size > settings.max_upload_bytes:
            raise APIError(413, "UPLOAD_TOO_LARGE", "document exceeds the configured size limit")
        chunks.append(chunk)
    content = b"".join(chunks)
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise APIError(415, "INVALID_PDF", "PDF signature is missing")
    if extension == ".txt" and b"\x00" in content:
        raise APIError(415, "INVALID_TEXT", "TXT upload contains binary data")

    document_id = f"doc_{uuid4().hex}"
    settings.storage_directory.mkdir(parents=True, exist_ok=True)
    storage_path = settings.storage_directory / f"{document_id}{extension}"
    storage_path.write_bytes(content)
    document = IssuanceDocumentRecord(
        id=document_id,
        asset_id=asset_id,
        file_hash=f"sha256:{hashlib.sha256(content).hexdigest()}",
        version="1",
        storage_path=str(storage_path.resolve()),
        status="UPLOADED",
        media_type=allowed[extension],
        size_bytes=size,
    )
    try:
        DocumentRepository(session).add(document)
        JobRepository(session).enqueue(
            "DOCUMENT_EXTRACT",
            {"asset_id": asset_id, "document_id": document_id},
        )
        session.commit()
    except Exception:
        session.rollback()
        storage_path.unlink(missing_ok=True)
        raise
    return _document_contract(session, document)


@router.get("/v1/documents/{document_id}", response_model=DocumentResponse, tags=["documents"])
def get_document(
    document_id: str, session: Annotated[Session, Depends(get_session)]
) -> DocumentResponse:
    document = DocumentRepository(session).get(document_id)
    if document is None:
        raise _not_found("document", document_id)
    return _document_contract(session, document)


@router.get(
    "/v1/documents/{document_id}/content",
    response_model=DocumentContentResponse,
    tags=["documents"],
)
def get_document_content(
    document_id: str, session: Annotated[Session, Depends(get_session)]
) -> DocumentContentResponse:
    document = DocumentRepository(session).get(document_id)
    if document is None:
        raise _not_found("document", document_id)
    if document.storage_path is None:
        raise APIError(409, "DOCUMENT_CONTENT_UNAVAILABLE", "document content is unavailable")
    path = Path(document.storage_path)
    if not path.is_file():
        raise APIError(409, "DOCUMENT_CONTENT_UNAVAILABLE", "document content is missing")
    content = path.read_bytes()
    if document.media_type == "text/plain":
        return DocumentContentResponse(
            document_id=document.id,
            media_type="text/plain",
            text=content.decode("utf-8"),
        )
    return DocumentContentResponse(
        document_id=document.id,
        media_type="application/pdf",
        content_base64=base64.b64encode(content).decode("ascii"),
    )


@router.patch(
    "/v1/assets/{asset_id}/policies",
    response_model=list[ControlSpec],
    tags=["assets"],
)
def patch_policies(
    asset_id: str,
    request: PolicyPatchRequest,
    session: Annotated[Session, Depends(get_session)],
    operator: Annotated[OperatorContext, Depends(require_operator)],
) -> list[ControlSpec]:
    asset = AssetRepository(session).get(asset_id)
    if asset is None:
        raise _not_found("asset", asset_id)
    document = DocumentRepository(session).get(request.document_id)
    if document is None or document.asset_id != asset_id:
        raise _not_found("document", request.document_id)
    if any(
        policy.evidence_span is not None
        and policy.evidence_span.document_id != request.document_id
        for policy in request.policies
    ):
        raise APIError(422, "EVIDENCE_DOCUMENT_MISMATCH", "evidence must reference the document")
    if document.storage_path is None:
        raise APIError(
            422,
            "EVIDENCE_SOURCE_UNAVAILABLE",
            "stored document content is unavailable",
        )
    try:
        document_content = Path(document.storage_path).read_bytes()
        document_pages = extract_document_pages(
            document_content,
            media_type=document.media_type,
            max_bytes=max(len(document_content), 1),
        )
    except (OSError, DocumentExtractionError) as error:
        raise APIError(
            422,
            "EVIDENCE_SOURCE_UNAVAILABLE",
            "stored document page text could not be verified",
        ) from error

    stored: list[PolicyConstraintRecord] = []
    try:
        repository = PolicyRepository(session)
        for policy in request.policies:
            evidence_span = policy.evidence_span
            if evidence_span is None:
                page = next(
                    (item for item in document_pages if item.number == policy.page),
                    None,
                )
                quote = policy.quote or ""
                start = page.text.find(quote) if page is not None else -1
                if start < 0:
                    raise APIError(
                        422,
                        "MANUAL_EVIDENCE_QUOTE_NOT_FOUND",
                        "exact quote was not found on the requested document page",
                    )
                assert page is not None
                evidence_span = EvidenceSpan(
                    document_id=request.document_id,
                    page=page.number,
                    start=start,
                    end=start + len(quote),
                    quote=quote,
                )
            else:
                page = next(
                    (
                        item
                        for item in document_pages
                        if item.number == evidence_span.page
                    ),
                    None,
                )
                if (
                    page is None
                    or evidence_span.end != evidence_span.start + len(evidence_span.quote)
                    or page.text[evidence_span.start : evidence_span.end]
                    != evidence_span.quote
                ):
                    raise APIError(
                        422,
                        "EVIDENCE_SPAN_INVALID",
                        "evidence page and character offsets must match the stored exact quote",
                    )
            existing = repository.get_for_update(asset_id, policy.constraint_id)
            field_name = (
                policy.field
                or (existing.field_name if existing is not None else None)
                or policy.constraint_id.removeprefix("control_")
            )
            generated_id = stable_constraint_id(asset_id, request.document_id, field_name)
            if existing is None:
                existing = repository.get_for_update(asset_id, generated_id)
            constraint_id = existing.id if existing is not None else generated_id
            before = _policy_audit_state(existing)
            normalized_value = {"value": policy.value, "unit": policy.unit}
            serialized_span = evidence_span.model_dump(mode="json")
            if existing is None:
                if policy.expected_version != 0:
                    raise APIError(
                        409,
                        "POLICY_CONCURRENT_UPDATE",
                        "policy version changed; reload before saving",
                    )
                stored_policy = repository.insert_new(
                    PolicyConstraintRecord(
                        id=constraint_id,
                        asset_id=asset_id,
                        document_id=request.document_id,
                        field_name=field_name,
                        normalized_value=normalized_value,
                        evidence_span=serialized_span,
                        confirmed=policy.confirmed,
                        version=1,
                    )
                )
            else:
                if existing.document_id != request.document_id:
                    raise PolicyDocumentConflict(
                        f"constraint {existing.id} belongs to document {existing.document_id}"
                    )
                if not repository.update_if_version(
                    existing.id,
                    policy.expected_version,
                    field_name=field_name,
                    normalized_value=normalized_value,
                    evidence_span=serialized_span,
                    confirmed=policy.confirmed,
                    updated_at=datetime.now(UTC),
                ):
                    raise APIError(
                        409,
                        "POLICY_CONCURRENT_UPDATE",
                        "policy version changed; reload before saving",
                    )
                session.refresh(existing)
                stored_policy = existing
            stored.append(stored_policy)
            after = _policy_audit_state(stored_policy)
            if before != after:
                AuditLogRepository(session).add(
                    AuditLogRecord(
                        asset_id=asset_id,
                        actor_type=operator.actor_type.value,
                        actor_id=operator.actor_id,
                        action="POLICY_CHANGED",
                        target_type="POLICY_CONSTRAINT",
                        target_id=constraint_id,
                        before_state=before,
                        after_state=after,
                        auth_metadata={
                            "authentication_mode": operator.authentication_mode
                        },
                    )
                )
        session.commit()
    except PolicyDocumentConflict as error:
        session.rollback()
        raise APIError(
            409,
            "POLICY_DOCUMENT_CONFLICT",
            "constraint_id cannot be moved to another document",
        ) from error
    except PolicyOwnershipConflict as error:
        session.rollback()
        raise APIError(
            409,
            "POLICY_OWNERSHIP_CONFLICT",
            "constraint_id already belongs to another asset",
        ) from error
    except PolicyVersionConflict as error:
        session.rollback()
        raise APIError(
            409,
            "POLICY_VERSION_CONFLICT",
            "policy was created concurrently; reload before saving",
        ) from error
    except Exception:
        session.rollback()
        raise
    return [_policy_contract(item) for item in stored]


@router.post(
    "/v1/assets/{asset_id}/contracts",
    response_model=ContractCreateResponse,
    status_code=201,
    tags=["contracts"],
)
def create_contract(
    asset_id: str,
    request: ContractCreateRequest,
    session: Annotated[Session, Depends(get_session)],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
) -> ContractCreateResponse:
    if AssetRepository(session).get(asset_id) is None:
        raise _not_found("asset", asset_id)
    source_kind = (
        ContractSourceKind.SOURCE_AND_ADDRESS
        if request.source_code is not None and request.address is not None
        else ContractSourceKind.SOURCE
        if request.source_code is not None
        else ContractSourceKind.ADDRESS
    )
    hash_input = request.source_code or request.address
    if hash_input is None:
        raise APIError(422, "CONTRACT_INPUT_REQUIRED", "contract source or address is required")
    contract = ContractRecord(
        id=f"contract_{uuid4().hex}",
        asset_id=asset_id,
        chain_id=request.chain_id,
        address=request.address,
        source_kind=source_kind.value,
        source_code=request.source_code,
        source_hash=f"sha256:{hashlib.sha256(hash_input.encode()).hexdigest()}",
        proxy_status="NOT_CHECKED",
    )
    try:
        ContractRepository(session).add(contract)
        session.commit()
    except Exception:
        session.rollback()
        raise
    return _contract_response(contract)


@router.post(
    "/v1/assets/{asset_id}/scans",
    response_model=ScanCreateResponse,
    status_code=202,
    tags=["scans"],
)
def create_scan(
    asset_id: str,
    request: ScanCreateRequest,
    session: Annotated[Session, Depends(get_session)],
    _operator: Annotated[OperatorContext, Depends(require_operator)],
) -> ScanCreateResponse:
    if AssetRepository(session).get(asset_id) is None:
        raise _not_found("asset", asset_id)
    contract = ContractRepository(session).get(request.contract_id)
    if contract is None or contract.asset_id != asset_id:
        raise _not_found("contract", request.contract_id)
    if request.base_scan_id is not None:
        base = ScanRepository(session).get(request.base_scan_id)
        if base is None or base.asset_id != asset_id:
            raise _not_found("scan", request.base_scan_id)
    latest_document = DocumentRepository(session).latest_by_asset(asset_id)
    controls = (
        PolicyRepository(session).list_by_document(latest_document.id)
        if latest_document is not None
        else []
    )
    confirmed_fields = {
        control.field_name for control in controls if control.confirmed
    }
    missing_or_unconfirmed = sorted(P0_CONTROL_FIELDS - confirmed_fields)
    if missing_or_unconfirmed:
        raise APIError(
            409,
            "CONTROL_REVIEW_REQUIRED",
            "confirm all six mandatory P0 controls before starting a scan: "
            + ", ".join(missing_or_unconfirmed),
        )

    now = datetime.now(UTC)
    scan = ScanRunRecord(
        id=f"scan_{uuid4().hex}",
        asset_id=asset_id,
        contract_id=contract.id,
        status=ScanStatus.QUEUED.value,
        input_hashes={"source": contract.source_hash},
        rule_versions={},
        failed_stages=[],
        started_at=now,
    )
    report = ReportRecord(
        id=f"report_{uuid4().hex}",
        asset_id=asset_id,
        scan_id=scan.id,
        status=ReportStatus.QUEUED.value,
        downloads={},
        limitations=["분석 및 리포트 조립은 아직 처리 대기 중입니다."],
    )
    try:
        ScanRepository(session).add(scan)
        ReportRepository(session).add(report)
        JobRepository(session).enqueue(
            "CONTRACT_SCAN",
            {
                "asset_id": asset_id,
                "contract_id": contract.id,
                "scan_id": scan.id,
                "report_id": report.id,
                "base_scan_id": request.base_scan_id,
            },
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
    return ScanCreateResponse(
        scan_id=scan.id,
        asset_id=asset_id,
        status=ScanStatus.QUEUED,
        created_at=now,
    )


@router.get("/v1/scans/{scan_id}", response_model=ScanResultResponse, tags=["scans"])
def get_scan(
    scan_id: str,
    session: Annotated[Session, Depends(get_session)],
    base: Annotated[str | None, Query()] = None,
) -> ScanResultResponse:
    scan = ScanRepository(session).get(scan_id)
    if scan is None:
        raise _not_found("scan", scan_id)
    if base is not None:
        base_scan = ScanRepository(session).get(base)
        if base_scan is None or base_scan.asset_id != scan.asset_id:
            raise _not_found("scan", base)
    report = ReportRepository(session).get_by_scan(scan_id)
    payload = scan.result_payload
    code_findings = [
        CodeFinding.model_validate(item) for item in payload.get("code_findings", [])
    ]
    stored_diff = [FindingDiff.model_validate(item) for item in payload.get("diff", [])]
    if base is not None:
        base_scan = ScanRepository(session).get(base)
        assert base_scan is not None
        base_findings = [
            CodeFinding.model_validate(item)
            for item in base_scan.result_payload.get("code_findings", [])
        ]
        stored_diff = list(
            compare_rescan(
                base_findings,
                code_findings,
                base_scan_id=base,
                head_scan_id=scan.id,
            )
        )
    return ScanResultResponse(
        scan_run=_scan_contract(scan),
        code_findings=code_findings,
        mismatches=[
            MismatchFinding.model_validate(item) for item in payload.get("mismatches", [])
        ],
        onchain_evidence=[
            OnchainEvidence.model_validate(item)
            for item in payload.get("onchain_evidence", [])
        ],
        diff=stored_diff,
        report_id=report.id if report is not None else None,
    )


@router.get("/v1/alerts", response_model=list[AlertSummary], tags=["alerts"])
def list_alerts(
    session: Annotated[Session, Depends(get_session)],
    asset_id: Annotated[str | None, Query()] = None,
    status: Annotated[AlertStatus | None, Query()] = None,
) -> list[AlertSummary]:
    records = AlertRepository(session).list_all(
        asset_id=asset_id, status=status.value if status is not None else None
    )
    return [_alert_contract(session, item) for item in records]


@router.patch("/v1/alerts/{alert_id}", response_model=AlertSummary, tags=["alerts"])
def patch_alert(
    alert_id: str,
    request: AlertPatchRequest,
    session: Annotated[Session, Depends(get_session)],
    operator: Annotated[OperatorContext, Depends(require_operator)],
) -> AlertSummary:
    repository = AlertRepository(session)
    alert = repository.get_for_update(alert_id)
    if alert is None:
        raise _not_found("alert", alert_id)
    now = datetime.now(UTC)
    before = {"status": alert.status, "memo": alert.memo}
    expected_updated_at = request.expected_updated_at
    if _utc_required(alert.updated_at) != _utc_required(expected_updated_at):
        raise APIError(
            409,
            "ALERT_CONCURRENT_UPDATE",
            "alert changed while the patch was being applied",
        )
    status = request.status.value if request.status is not None else alert.status
    current_status = AlertStatus(alert.status)
    if (
        request.status is not None
        and request.status is not current_status
        and request.status not in ALERT_TRANSITIONS[current_status]
    ):
        raise APIError(
            409,
            "ALERT_INVALID_TRANSITION",
            f"transition from {current_status.value} to {request.status.value} is not allowed",
        )
    memo = request.memo if "memo" in request.model_fields_set else alert.memo
    try:
        if not repository.update_if_current(
            alert.id,
            expected_updated_at,
            status=status,
            memo=memo,
            updated_at=now,
        ):
            raise APIError(
                409,
                "ALERT_CONCURRENT_UPDATE",
                "alert changed while the patch was being applied",
            )
        AuditLogRepository(session).add(
            AuditLogRecord(
                asset_id=alert.asset_id,
                actor_type=operator.actor_type.value,
                actor_id=operator.actor_id,
                action=(
                    "ALERT_STATUS_CHANGED"
                    if request.status is not None
                    else "ALERT_MEMO_CHANGED"
                ),
                target_type="ALERT",
                target_id=alert.id,
                before_state=before,
                after_state={"status": status, "memo": memo},
                auth_metadata={"authentication_mode": operator.authentication_mode},
            )
        )
        session.commit()
        session.refresh(alert)
    except Exception:
        session.rollback()
        raise
    return _alert_contract(session, alert)


@router.get("/v1/dashboard", response_model=DashboardResponse, tags=["dashboard"])
def dashboard(session: Annotated[Session, Depends(get_session)]) -> DashboardResponse:
    assets = AssetRepository(session).list_all()
    alerts = AlertRepository(session).list_all()
    summaries: list[AssetSummary] = []
    for asset in assets:
        scans = ScanRepository(session).list_by_asset(asset.id)
        latest = scans[0] if scans else None
        result = latest.result_payload if latest is not None else {}
        mismatches = [
            MismatchFinding.model_validate(item) for item in result.get("mismatches", [])
        ]
        findings = [
            CodeFinding.model_validate(item) for item in result.get("code_findings", [])
        ]
        confirmed_finding_ids = {
            item.finding_id for item in findings if item.status is FindingStatus.CONFIRMED
        }
        confirmed = [
            item
            for item in mismatches
            if item.finding_id in confirmed_finding_ids
            and item.implementation_status is ImplementationStatus.MISSING
            and item.severity in {Severity.CRITICAL, Severity.HIGH}
        ]
        severities = {item.severity for item in confirmed}
        chain = [
            OnchainEvidence.model_validate(item)
            for item in result.get("onchain_evidence", [])
        ]
        highest = (
            Severity.CRITICAL
            if Severity.CRITICAL in severities
            else Severity.HIGH
            if Severity.HIGH in severities
            else None
        )
        summaries.append(
            AssetSummary(
                asset_id=asset.id,
                name=asset.name,
                highest_severity=highest,
                critical_count=sum(item.severity is Severity.CRITICAL for item in confirmed),
                high_count=sum(item.severity is Severity.HIGH for item in confirmed),
                latest_scan=LatestScanRef(
                    scan_id=latest.id,
                    status=ScanStatus(latest.status),
                    completed_at=_utc(latest.completed_at),
                )
                if latest
                else None,
                evidence_mode=chain[0].mode if chain else None,
                fixture_version=chain[0].fixture_version if chain else None,
                freshness=derive_scan_freshness(
                    status=latest.status,
                    completed_at=latest.completed_at,
                    max_age_minutes=_oracle_max_age_minutes(session, asset.id),
                )
                if latest is not None
                else None,
            )
        )
    return DashboardResponse(
        total_assets=len(assets),
        critical_assets=sum(item.highest_severity is Severity.CRITICAL for item in summaries),
        high_assets=sum(item.highest_severity is Severity.HIGH for item in summaries),
        assets=summaries,
        recent_alerts=[_alert_contract(session, item) for item in alerts[:10]],
    )


@router.get("/v1/reports/{report_id}", response_model=ReportResponse, tags=["reports"])
def get_report(
    report_id: str, session: Annotated[Session, Depends(get_session)]
) -> ReportResponse:
    report = ReportRepository(session).get(report_id)
    if report is None:
        raise _not_found("report", report_id)
    return _report_contract(report)


@router.get("/v1/reports/{report_id}/download", tags=["reports"])
def download_report(
    report_id: str,
    session: Annotated[Session, Depends(get_session)],
    format: Annotated[ReportFormat, Query()] = ReportFormat.JSON,
) -> Response:
    report = ReportRepository(session).get(report_id)
    if report is None:
        raise _not_found("report", report_id)
    if report.status != ReportStatus.READY.value or report.evidence is None:
        raise APIError(409, "REPORT_NOT_READY", "report download is not ready")
    validated = _validated_report(report)
    serialized = _serialize_report(validated)
    if format is ReportFormat.HTML:
        body = _render_report_html(validated)
        media_type = "text/html"
        suffix = "html"
    else:
        body = serialized
        media_type = "application/json"
        suffix = "json"
    safe_report_id = "".join(
        character if character.isalnum() or character in {"-", "_"} else "_"
        for character in report.id
    )[:100] or "report"
    return Response(
        content=body.encode(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_report_id}.{suffix}"',
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; "
                "frame-ancestors 'none'; form-action 'none'"
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )
