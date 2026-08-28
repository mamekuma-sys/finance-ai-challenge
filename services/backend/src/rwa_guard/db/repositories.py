from collections.abc import Collection
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from .models import (
    AlertRecord,
    AssetRecord,
    AuditLogRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    JobRecord,
    OperatorLoginAttemptRecord,
    PolicyConstraintRecord,
    ReportRecord,
    ScanRunRecord,
    WorkerHeartbeatRecord,
)


class PolicyOwnershipConflict(ValueError):
    pass


class PolicyDocumentConflict(ValueError):
    pass


class PolicyVersionConflict(RuntimeError):
    pass


def _utc_datetime(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class LeaseLost(RuntimeError):
    pass


@dataclass(frozen=True)
class JobLease:
    job_id: str
    locked_by: str
    lease_token: str
    attempt_count: int
    max_attempts: int

    @classmethod
    def from_record(cls, job: JobRecord) -> "JobLease":
        if job.status != "RUNNING" or job.locked_by is None or job.lease_token is None:
            raise LeaseLost(f"job {job.id} does not have an active lease")
        return cls(
            job_id=job.id,
            locked_by=job.locked_by,
            lease_token=job.lease_token,
            attempt_count=job.attempt_count,
            max_attempts=job.max_attempts,
        )


def _add_synthetic(session: Session, record: object) -> None:
    """Stage and flush a synthetic record without owning the transaction."""

    if getattr(record, "is_synthetic", None) is False:
        raise ValueError("RWA Guard repositories only accept synthetic data")
    session.add(record)
    session.flush()


class AssetRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, asset: AssetRecord) -> AssetRecord:
        _add_synthetic(self.session, asset)
        return asset

    def get(self, asset_id: str) -> AssetRecord | None:
        return self.session.get(AssetRecord, asset_id)

    def list_all(self) -> list[AssetRecord]:
        return list(self.session.scalars(select(AssetRecord).order_by(AssetRecord.created_at)))


class DocumentRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, document: IssuanceDocumentRecord) -> IssuanceDocumentRecord:
        _add_synthetic(self.session, document)
        return document

    def get(self, document_id: str) -> IssuanceDocumentRecord | None:
        return self.session.get(IssuanceDocumentRecord, document_id)

    def list_by_asset(self, asset_id: str) -> list[IssuanceDocumentRecord]:
        statement = (
            select(IssuanceDocumentRecord)
            .where(IssuanceDocumentRecord.asset_id == asset_id)
            .order_by(IssuanceDocumentRecord.uploaded_at, IssuanceDocumentRecord.id)
        )
        return list(self.session.scalars(statement))

    def latest_by_asset(self, asset_id: str) -> IssuanceDocumentRecord | None:
        statement = (
            select(IssuanceDocumentRecord)
            .where(IssuanceDocumentRecord.asset_id == asset_id)
            .order_by(
                IssuanceDocumentRecord.uploaded_at.desc(),
                IssuanceDocumentRecord.id.desc(),
            )
            .limit(1)
        )
        return self.session.scalar(statement)


class PolicyRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(self, policy: PolicyConstraintRecord) -> PolicyConstraintRecord:
        existing = self.get(policy.asset_id, policy.id)
        if existing is None:
            owner = self.session.scalar(
                select(PolicyConstraintRecord.asset_id).where(
                    PolicyConstraintRecord.id == policy.id
                )
            )
            if owner is not None and owner != policy.asset_id:
                raise PolicyOwnershipConflict(
                    f"constraint {policy.id} already belongs to asset {owner}"
                )
            _add_synthetic(self.session, policy)
            return policy
        if existing.document_id != policy.document_id:
            raise PolicyDocumentConflict(
                f"constraint {policy.id} belongs to document {existing.document_id}"
            )
        existing.document_id = policy.document_id
        existing.field_name = policy.field_name
        existing.normalized_value = policy.normalized_value
        existing.evidence_span = policy.evidence_span
        existing.confirmed = policy.confirmed
        self.session.flush()
        return existing

    def insert_new(self, policy: PolicyConstraintRecord) -> PolicyConstraintRecord:
        """Atomically insert version 1 and normalize a stale-observer race."""
        try:
            with self.session.begin_nested():
                _add_synthetic(self.session, policy)
        except IntegrityError as error:
            raise PolicyVersionConflict(
                f"constraint {policy.id} was inserted concurrently"
            ) from error
        return policy

    def get(self, asset_id: str, constraint_id: str) -> PolicyConstraintRecord | None:
        return self.session.scalar(
            select(PolicyConstraintRecord).where(
                PolicyConstraintRecord.asset_id == asset_id,
                PolicyConstraintRecord.id == constraint_id,
            )
        )

    def get_for_update(
        self, asset_id: str, constraint_id: str
    ) -> PolicyConstraintRecord | None:
        return self.session.scalar(
            select(PolicyConstraintRecord)
            .where(
                PolicyConstraintRecord.asset_id == asset_id,
                PolicyConstraintRecord.id == constraint_id,
            )
            .with_for_update()
        )

    def update_if_version(
        self,
        policy_id: str,
        expected_version: int,
        *,
        field_name: str,
        normalized_value: object,
        evidence_span: dict[str, object],
        confirmed: bool,
        updated_at: datetime,
    ) -> bool:
        updated_id = self.session.execute(
            update(PolicyConstraintRecord)
            .where(
                PolicyConstraintRecord.id == policy_id,
                PolicyConstraintRecord.version == expected_version,
            )
            .values(
                field_name=field_name,
                normalized_value=normalized_value,
                evidence_span=evidence_span,
                confirmed=confirmed,
                version=PolicyConstraintRecord.version + 1,
                updated_at=updated_at,
            )
            .returning(PolicyConstraintRecord.id)
        ).scalar_one_or_none()
        return updated_id is not None

    def list_by_document(self, document_id: str) -> list[PolicyConstraintRecord]:
        statement = (
            select(PolicyConstraintRecord)
            .where(PolicyConstraintRecord.document_id == document_id)
            .order_by(PolicyConstraintRecord.created_at)
        )
        return list(self.session.scalars(statement))


class ContractRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, contract: ContractRecord) -> ContractRecord:
        _add_synthetic(self.session, contract)
        return contract

    def get(self, contract_id: str) -> ContractRecord | None:
        return self.session.get(ContractRecord, contract_id)

    def list_by_asset(self, asset_id: str) -> list[ContractRecord]:
        statement = (
            select(ContractRecord)
            .where(ContractRecord.asset_id == asset_id)
            .order_by(ContractRecord.created_at)
        )
        return list(self.session.scalars(statement))


class ScanRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, scan: ScanRunRecord) -> ScanRunRecord:
        _add_synthetic(self.session, scan)
        return scan

    def get(self, scan_id: str) -> ScanRunRecord | None:
        return self.session.get(ScanRunRecord, scan_id)

    def list_by_asset(self, asset_id: str) -> list[ScanRunRecord]:
        statement = (
            select(ScanRunRecord)
            .where(ScanRunRecord.asset_id == asset_id)
            .order_by(ScanRunRecord.started_at.desc())
        )
        return list(self.session.scalars(statement))


class ReportRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, report: ReportRecord) -> ReportRecord:
        _add_synthetic(self.session, report)
        return report

    def get(self, report_id: str) -> ReportRecord | None:
        return self.session.get(ReportRecord, report_id)

    def get_by_scan(self, scan_id: str) -> ReportRecord | None:
        return self.session.scalar(select(ReportRecord).where(ReportRecord.scan_id == scan_id))


class AlertRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, alert_id: str) -> AlertRecord | None:
        return self.session.get(AlertRecord, alert_id)

    def get_for_update(self, alert_id: str) -> AlertRecord | None:
        return self.session.scalar(
            select(AlertRecord)
            .where(AlertRecord.id == alert_id)
            .with_for_update()
        )

    def update_status_if_current(
        self,
        alert_id: str,
        expected_updated_at: datetime,
        status: str,
        updated_at: datetime,
    ) -> bool:
        updated_id = self.session.execute(
            update(AlertRecord)
            .where(
                AlertRecord.id == alert_id,
                AlertRecord.updated_at == expected_updated_at,
            )
            .values(status=status, updated_at=updated_at)
            .returning(AlertRecord.id)
        ).scalar_one_or_none()
        return updated_id is not None

    def update_if_current(
        self,
        alert_id: str,
        expected_updated_at: datetime,
        *,
        status: str,
        memo: str | None,
        updated_at: datetime,
    ) -> bool:
        updated_id = self.session.execute(
            update(AlertRecord)
            .where(
                AlertRecord.id == alert_id,
                AlertRecord.updated_at == expected_updated_at,
            )
            .values(status=status, memo=memo, updated_at=updated_at)
            .returning(AlertRecord.id)
        ).scalar_one_or_none()
        return updated_id is not None

    def list_all(
        self, *, asset_id: str | None = None, status: str | None = None
    ) -> list[AlertRecord]:
        statement = select(AlertRecord)
        if asset_id is not None:
            statement = statement.where(AlertRecord.asset_id == asset_id)
        if status is not None:
            statement = statement.where(AlertRecord.status == status)
        return list(self.session.scalars(statement.order_by(AlertRecord.created_at.desc())))


class AuditLogRepository:
    """Persistence operations; commit and rollback always belong to the caller."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, audit: AuditLogRecord) -> AuditLogRecord:
        _add_synthetic(self.session, audit)
        return audit


class OperatorLoginAttemptRepository:
    """Database-serialized rate limit state keyed only by an opaque fingerprint."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def check_ready(self) -> None:
        self.session.execute(
            select(
                OperatorLoginAttemptRecord.fingerprint,
                OperatorLoginAttemptRecord.window_started_at,
                OperatorLoginAttemptRecord.failures,
                OperatorLoginAttemptRecord.locked_until,
                OperatorLoginAttemptRecord.updated_at,
            ).limit(1)
        ).all()

    def lock_or_create(
        self,
        fingerprint: str,
        now: datetime,
    ) -> OperatorLoginAttemptRecord:
        values = {
            "fingerprint": fingerprint,
            "window_started_at": now,
            "failures": 0,
            "locked_until": None,
            "updated_at": now,
        }
        dialect = self.session.get_bind().dialect.name
        if dialect == "postgresql":
            postgresql_statement = postgresql_insert(
                OperatorLoginAttemptRecord
            ).values(**values)
            self.session.execute(
                postgresql_statement.on_conflict_do_nothing(index_elements=["fingerprint"])
            )
        elif dialect == "sqlite":
            sqlite_statement = sqlite_insert(OperatorLoginAttemptRecord).values(**values)
            self.session.execute(
                sqlite_statement.on_conflict_do_nothing(index_elements=["fingerprint"])
            )
        else:
            existing = self.session.get(OperatorLoginAttemptRecord, fingerprint)
            if existing is None:
                _add_synthetic(
                    self.session,
                    OperatorLoginAttemptRecord(**values),
                )
        record = self.session.scalar(
            select(OperatorLoginAttemptRecord)
            .where(OperatorLoginAttemptRecord.fingerprint == fingerprint)
            .with_for_update()
        )
        if record is None:
            raise RuntimeError("operator attempt row could not be locked")
        return record

    @staticmethod
    def is_locked(record: OperatorLoginAttemptRecord, now: datetime) -> bool:
        return (
            record.locked_until is not None
            and _utc_datetime(record.locked_until) > _utc_datetime(now)
        )

    def register_failure(
        self,
        record: OperatorLoginAttemptRecord,
        now: datetime,
        *,
        window: timedelta,
        max_failures: int,
    ) -> bool:
        if self.is_locked(record, now):
            return True
        if _utc_datetime(record.window_started_at) + window <= _utc_datetime(now):
            record.window_started_at = now
            record.failures = 0
            record.locked_until = None
        record.failures = min(record.failures + 1, max_failures)
        record.updated_at = now
        if record.failures >= max_failures:
            record.locked_until = now + window
        self.session.flush()
        return False

    def clear(self, record: OperatorLoginAttemptRecord) -> None:
        self.session.delete(record)
        self.session.flush()


class JobRepository:
    """Atomic job queue operations for SQLite tests and PostgreSQL workers."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def enqueue(
        self,
        job_type: str,
        payload: dict[str, object],
        *,
        max_attempts: int = 3,
        available_at: datetime | None = None,
    ) -> JobRecord:
        if max_attempts <= 0:
            raise ValueError("max_attempts must be greater than zero")
        job = JobRecord(
            id=f"job_{uuid4().hex}",
            job_type=job_type,
            payload=payload,
            max_attempts=max_attempts,
            available_at=available_at or datetime.now(UTC),
        )
        _add_synthetic(self.session, job)
        return job

    def get(self, job_id: str) -> JobRecord | None:
        return self.session.get(JobRecord, job_id)

    def claim_next(
        self,
        worker_name: str,
        *,
        now: datetime | None = None,
        job_types: Collection[str] | None = None,
    ) -> JobRecord | None:
        if job_types is not None and not job_types:
            return None
        claimed_at = now or datetime.now(UTC)
        lease_token = uuid4().hex
        dialect = self.session.get_bind().dialect.name
        eligible = (
            select(JobRecord)
            .where(JobRecord.status == "QUEUED", JobRecord.available_at <= claimed_at)
            .order_by(JobRecord.available_at, JobRecord.created_at)
            .limit(1)
        )
        if job_types is not None:
            eligible = eligible.where(JobRecord.job_type.in_(job_types))
        if dialect == "postgresql":
            job = self.session.scalar(eligible.with_for_update(skip_locked=True))
            if job is None:
                return None
            job.status = "RUNNING"
            job.locked_at = claimed_at
            job.locked_by = worker_name
            job.lease_token = lease_token
            job.attempt_count += 1
            job.updated_at = claimed_at
            self.session.flush()
            return job

        job_id = eligible.with_only_columns(JobRecord.id).scalar_subquery()
        statement = (
            update(JobRecord)
            .where(
                JobRecord.id == job_id,
                JobRecord.status == "QUEUED",
                JobRecord.available_at <= claimed_at,
            )
            .values(
                status="RUNNING",
                locked_at=claimed_at,
                locked_by=worker_name,
                lease_token=lease_token,
                attempt_count=JobRecord.attempt_count + 1,
                updated_at=claimed_at,
            )
            .returning(JobRecord)
        )
        return self.session.execute(statement).scalar_one_or_none()

    def recover_stale(
        self,
        *,
        now: datetime | None = None,
        lock_timeout: timedelta,
    ) -> int:
        recovered_at = now or datetime.now(UTC)
        threshold = recovered_at - lock_timeout
        statement = (
            select(JobRecord)
            .where(
                JobRecord.status == "RUNNING",
                JobRecord.locked_at.is_not(None),
                JobRecord.locked_at <= threshold,
            )
            .order_by(JobRecord.locked_at)
        )
        if self.session.get_bind().dialect.name == "postgresql":
            statement = statement.with_for_update(skip_locked=True)
        stale_jobs = list(self.session.scalars(statement))
        for job in stale_jobs:
            job.locked_at = None
            job.locked_by = None
            job.lease_token = None
            job.updated_at = recovered_at
            job.last_error = "stale worker lock recovered"
            if job.attempt_count >= job.max_attempts:
                job.status = "FAILED"
            else:
                job.status = "QUEUED"
                job.available_at = recovered_at
        self.session.flush()
        return len(stale_jobs)

    def get_for_lease(self, lease: JobLease) -> JobRecord | None:
        return self.session.scalar(
            select(JobRecord).where(*self._lease_conditions(lease))
        )

    def complete(self, lease: JobLease, *, now: datetime | None = None) -> None:
        finalized_id = self.session.execute(
            update(JobRecord)
            .where(*self._lease_conditions(lease))
            .values(
                status="COMPLETED",
                locked_at=None,
                locked_by=None,
                lease_token=None,
                updated_at=now or datetime.now(UTC),
            )
            .returning(JobRecord.id)
        ).scalar_one_or_none()
        if finalized_id is None:
            raise LeaseLost(f"job lease lost before completion: {lease.job_id}")

    def fail(
        self,
        lease: JobLease,
        error: str,
        *,
        now: datetime | None = None,
        retry_base_seconds: int = 5,
    ) -> None:
        failed_at = now or datetime.now(UTC)
        if lease.attempt_count >= lease.max_attempts:
            values: dict[str, object] = {
                "status": "FAILED",
                "last_error": error,
                "locked_at": None,
                "locked_by": None,
                "lease_token": None,
                "updated_at": failed_at,
            }
        else:
            delay = retry_base_seconds * (2 ** max(lease.attempt_count - 1, 0))
            values = {
                "status": "QUEUED",
                "last_error": error,
                "locked_at": None,
                "locked_by": None,
                "lease_token": None,
                "updated_at": failed_at,
                "available_at": failed_at + timedelta(seconds=delay),
            }
        finalized_id = self.session.execute(
            update(JobRecord)
            .where(*self._lease_conditions(lease))
            .values(**values)
            .returning(JobRecord.id)
        ).scalar_one_or_none()
        if finalized_id is None:
            raise LeaseLost(f"job lease lost before failure handling: {lease.job_id}")

    @staticmethod
    def _lease_conditions(lease: JobLease) -> tuple[ColumnElement[bool], ...]:
        return (
            JobRecord.id == lease.job_id,
            JobRecord.status == "RUNNING",
            JobRecord.locked_by == lease.locked_by,
            JobRecord.lease_token == lease.lease_token,
            JobRecord.attempt_count == lease.attempt_count,
        )


class WorkerHeartbeatRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def record(
        self,
        worker_name: str,
        status: str,
        capabilities: list[str],
        worker_version: str,
        *,
        now: datetime | None = None,
    ) -> WorkerHeartbeatRecord:
        seen_at = now or datetime.now(UTC)
        heartbeat = self.session.get(WorkerHeartbeatRecord, worker_name)
        if heartbeat is None:
            heartbeat = WorkerHeartbeatRecord(
                worker_name=worker_name,
                status=status,
                capabilities=capabilities,
                worker_version=worker_version,
                last_seen_at=seen_at,
                updated_at=seen_at,
            )
            _add_synthetic(self.session, heartbeat)
        else:
            heartbeat.status = status
            heartbeat.capabilities = capabilities
            heartbeat.worker_version = worker_version
            heartbeat.last_seen_at = seen_at
            heartbeat.updated_at = seen_at
            self.session.flush()
        return heartbeat

    def latest(self) -> WorkerHeartbeatRecord | None:
        return self.session.scalar(
            select(WorkerHeartbeatRecord).order_by(
                WorkerHeartbeatRecord.last_seen_at.desc()
            ).limit(1)
        )
