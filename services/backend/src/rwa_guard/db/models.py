from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    DDL,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    false,
    func,
    inspect,
    text,
    true,
)
from sqlalchemy.orm import Mapped, Session, mapped_column

from .base import PORTABLE_JSON, Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ReportImmutableError(RuntimeError):
    """Raised before ORM code attempts to mutate a persisted READY report."""


class AssetRecord(Base):
    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
        CheckConstraint(
            "total_planned_supply > 0",
            name="total_planned_supply_positive",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    asset_type: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Text, default="UNVERIFIED", server_default=text("'UNVERIFIED'")
    )
    underlying_description: Mapped[str] = mapped_column(
        Text, server_default=text("'synthetic fixture'")
    )
    total_planned_supply: Mapped[int] = mapped_column(BigInteger, server_default=text("1"))
    network: Mapped[str] = mapped_column(Text, server_default=text("'KAIA_KAIROS'"))
    currency: Mapped[str] = mapped_column(Text)
    token_unit: Mapped[str] = mapped_column(Text)
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class IssuanceDocumentRecord(Base):
    __tablename__ = "issuance_documents"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
        CheckConstraint(
            "status in ('UPLOADED', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED')",
            name="status_allowed",
        ),
        CheckConstraint("size_bytes >= 0", name="size_bytes_non_negative"),
        CheckConstraint("page_count > 0", name="page_count_positive"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    file_hash: Mapped[str] = mapped_column(Text)
    version: Mapped[str] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Text, default="UPLOADED", server_default=text("'UPLOADED'")
    )
    media_type: Mapped[str] = mapped_column(
        Text, server_default=text("'application/pdf'")
    )
    size_bytes: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    page_count: Mapped[int | None] = mapped_column(Integer)
    failed_pages: Mapped[list[int]] = mapped_column(
        PORTABLE_JSON, default=list, server_default=text("'[]'")
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    extraction_metadata: Mapped[dict[str, Any]] = mapped_column(
        PORTABLE_JSON, default=dict, server_default=text("'{}'")
    )
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PolicyConstraintRecord(Base):
    __tablename__ = "policy_constraints"
    __table_args__ = (CheckConstraint("is_synthetic = true", name="is_synthetic_true"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("issuance_documents.id"), index=True)
    field_name: Mapped[str] = mapped_column(Text)
    normalized_value: Mapped[Any] = mapped_column(PORTABLE_JSON)
    evidence_span: Mapped[dict[str, Any]] = mapped_column(PORTABLE_JSON)
    confirmed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class ContractRecord(Base):
    __tablename__ = "contracts"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
        CheckConstraint(
            "source_kind in ('SOURCE', 'ADDRESS', 'SOURCE_AND_ADDRESS')",
            name="source_kind_allowed",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    chain_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    address: Mapped[str | None] = mapped_column(Text)
    source_kind: Mapped[str] = mapped_column(
        Text, default="ADDRESS", server_default=text("'ADDRESS'")
    )
    source_code: Mapped[str | None] = mapped_column(Text)
    source_hash: Mapped[str] = mapped_column(Text)
    proxy_status: Mapped[str] = mapped_column(
        Text, default="NOT_CHECKED", server_default=text("'NOT_CHECKED'")
    )
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class ScanRunRecord(Base):
    __tablename__ = "scan_runs"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    contract_id: Mapped[str | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    status: Mapped[str] = mapped_column(Text)
    input_hashes: Mapped[dict[str, str]] = mapped_column(PORTABLE_JSON)
    rule_versions: Mapped[dict[str, str]] = mapped_column(PORTABLE_JSON)
    failed_stages: Mapped[list[dict[str, Any]]] = mapped_column(
        PORTABLE_JSON, default=list, server_default=text("'[]'")
    )
    result_payload: Mapped[dict[str, Any]] = mapped_column(
        PORTABLE_JSON, default=dict, server_default=text("'{}'")
    )
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReportRecord(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
        CheckConstraint(
            "status in ('QUEUED', 'READY', 'FAILED')",
            name="status_allowed",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_runs.id"), unique=True)
    status: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict[str, Any] | None] = mapped_column(PORTABLE_JSON)
    report_hash: Mapped[str | None] = mapped_column(Text)
    downloads: Mapped[dict[str, str]] = mapped_column(
        PORTABLE_JSON, default=dict, server_default=text("'{}'")
    )
    limitations: Mapped[list[str]] = mapped_column(
        PORTABLE_JSON, default=list, server_default=text("'[]'")
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


event.listen(
    ReportRecord.__table__,
    "after_create",
    DDL(  # type: ignore[no-untyped-call]
        """
        CREATE TRIGGER reports_ready_immutable_update
        BEFORE UPDATE ON reports
        FOR EACH ROW
        WHEN OLD.status = 'READY'
        BEGIN
          SELECT RAISE(ABORT, 'READY report is immutable');
        END
        """
    ).execute_if(dialect="sqlite"),
)
event.listen(
    ReportRecord.__table__,
    "after_create",
    DDL(  # type: ignore[no-untyped-call]
        """
        CREATE TRIGGER reports_ready_immutable_delete
        BEFORE DELETE ON reports
        FOR EACH ROW
        WHEN OLD.status = 'READY'
        BEGIN
          SELECT RAISE(ABORT, 'READY report is immutable');
        END
        """
    ).execute_if(dialect="sqlite"),
)


@event.listens_for(Session, "before_flush")
def _reject_ready_report_orm_mutation(
    session: Session, _flush_context: object, _instances: object
) -> None:
    for report in session.dirty.union(session.deleted):
        if not isinstance(report, ReportRecord):
            continue
        status_history = inspect(report).attrs.status.history
        original_status = (
            status_history.deleted[0] if status_history.deleted else report.status
        )
        if original_status == "READY":
            raise ReportImmutableError(f"READY report is immutable: {report.id}")


class AlertRecord(Base):
    __tablename__ = "alerts"
    __table_args__ = (CheckConstraint("is_synthetic = true", name="is_synthetic_true"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("assets.id"), index=True)
    alert_type: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="NEW", server_default=text("'NEW'"))
    memo: Mapped[str | None] = mapped_column(Text)
    cause: Mapped[dict[str, Any]] = mapped_column(PORTABLE_JSON)
    evidence_links: Mapped[list[dict[str, Any]]] = mapped_column(PORTABLE_JSON)
    dedupe_key: Mapped[str] = mapped_column(Text, unique=True)
    evidence_mode: Mapped[str] = mapped_column(Text, server_default=text("'REPLAY'"))
    fixture_version: Mapped[str | None] = mapped_column(Text)
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class AuditLogRecord(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        CheckConstraint(
            "actor_type in ('SYSTEM', 'OPERATOR', 'INSECURE_DEMO')",
            name="audit_logs_actor_type_check",
        ),
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
    )

    id: Mapped[int] = mapped_column(
        Integer().with_variant(BigInteger(), "postgresql"), primary_key=True, autoincrement=True
    )
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("assets.id"), index=True)
    actor_type: Mapped[str] = mapped_column(Text)
    actor_id: Mapped[str] = mapped_column(Text)
    action: Mapped[str] = mapped_column(Text)
    target_type: Mapped[str] = mapped_column(Text)
    target_id: Mapped[str] = mapped_column(Text)
    before_state: Mapped[dict[str, Any] | None] = mapped_column(PORTABLE_JSON)
    after_state: Mapped[dict[str, Any] | None] = mapped_column(PORTABLE_JSON)
    auth_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", PORTABLE_JSON, default=dict, server_default=text("'{}'")
    )
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class OperatorLoginAttemptRecord(Base):
    __tablename__ = "operator_login_attempts"

    fingerprint: Mapped[str] = mapped_column(Text, primary_key=True)
    window_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    failures: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class JobRecord(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
        CheckConstraint("max_attempts > 0", name="max_attempts_positive"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    job_type: Mapped[str] = mapped_column(Text, index=True)
    status: Mapped[str] = mapped_column(Text, default="QUEUED", server_default=text("'QUEUED'"))
    payload: Mapped[dict[str, Any]] = mapped_column(PORTABLE_JSON)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, server_default=text("3"))
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_by: Mapped[str | None] = mapped_column(Text)
    lease_token: Mapped[str | None] = mapped_column(Text)
    last_error: Mapped[str | None] = mapped_column(Text)
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )


class WorkerHeartbeatRecord(Base):
    __tablename__ = "worker_heartbeats"
    __table_args__ = (
        CheckConstraint(
            "status in ('STARTING', 'READY', 'DEGRADED', 'STOPPING')",
            name="worker_heartbeats_status_check",
        ),
        CheckConstraint("is_synthetic = true", name="is_synthetic_true"),
    )

    worker_name: Mapped[str] = mapped_column(Text, primary_key=True)
    status: Mapped[str] = mapped_column(Text)
    capabilities: Mapped[list[str]] = mapped_column(PORTABLE_JSON, default=list)
    worker_version: Mapped[str] = mapped_column(
        Text, default="unknown", server_default=text("'unknown'")
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_synthetic: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False
    )
