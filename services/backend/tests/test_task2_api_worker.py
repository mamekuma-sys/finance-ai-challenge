from __future__ import annotations

import hashlib
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Thread

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import CheckConstraint, create_engine, insert, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.api import routes
from rwa_guard.api.main import app, create_app
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import (
    AlertRecord,
    AssetRecord,
    AuditLogRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    JobRecord,
    PolicyConstraintRecord,
    ReportImmutableError,
    ReportRecord,
    ScanRunRecord,
    WorkerHeartbeatRecord,
)
from rwa_guard.db.repositories import AlertRepository, JobRepository
from rwa_guard.fixtures import build_demo_report
from rwa_guard.worker import HandlerRegistry, JobLease, JobWorker, LeaseLost
from rwa_guard.worker import __main__ as worker_cli
from scripts.export_schemas import build_openapi

ASSET_PAYLOAD = {
    "name": "합성 한강 오피스 수익증권",
    "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
    "underlying_description": "합성 상업용 부동산 fixture",
    "total_planned_supply": 100_000,
    "network": "KAIA_KAIROS",
    "currency": "KRW",
    "token_unit": "TOKEN",
    "is_synthetic": True,
}


@pytest.fixture
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def client(tmp_path: Path, session_factory: sessionmaker[Session]) -> TestClient:
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        max_upload_bytes=16,
        allow_insecure_demo_operator=True,
    )
    return TestClient(create_app(settings=settings, session_factory=session_factory))


def _create_asset(client: TestClient) -> str:
    response = client.post("/v1/assets", json=ASSET_PAYLOAD)
    assert response.status_code == 201
    return response.json()["asset_id"]


def _seed_scan_inputs(session_factory: sessionmaker[Session], asset_id: str) -> str:
    contract_id = "contract_test_01"
    with session_factory() as session:
        document_id = "document_test_01"
        session.add(
            IssuanceDocumentRecord(
                id=document_id,
                asset_id=asset_id,
                file_hash="sha256:document",
                version="1",
                status="READY",
                media_type="text/plain",
                size_bytes=9,
                page_count=1,
                failed_pages=[],
            )
        )
        for field in (
            "max_supply",
            "collateral_verified",
            "issuer_role",
            "oracle_max_age",
            "price_band_breach",
            "pauser_role",
        ):
            session.add(
                PolicyConstraintRecord(
                    id=f"control_{field}",
                    asset_id=asset_id,
                    document_id=document_id,
                    field_name=field,
                    normalized_value={"value": 1, "unit": None},
                    evidence_span={
                        "document_id": document_id,
                        "page": 1,
                        "start": 0,
                        "end": 9,
                        "quote": "synthetic",
                    },
                    confirmed=True,
                )
            )
        session.add(
            ContractRecord(
                id=contract_id,
                asset_id=asset_id,
                chain_id=1001,
                source_kind="SOURCE",
                source_code="contract SyntheticRwa {}",
                source_hash="sha256:source",
                proxy_status="NOT_CHECKED",
            )
        )
        session.commit()
    return contract_id


def test_health_ready_requires_a_fresh_worker_heartbeat(
    client: TestClient,
    session_factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 8, 28, 9, 0, tzinfo=UTC)
    monkeypatch.setattr(routes, "_readiness_now", lambda: now)
    assert client.get("/health").status_code == 200
    missing = client.get("/health/ready")
    assert missing.status_code == 503
    assert missing.json()["error"]["code"] == "WORKER_HEARTBEAT_MISSING"

    with session_factory.begin() as session:
        session.add(
            WorkerHeartbeatRecord(
                worker_name="worker-ready",
                status="READY",
                capabilities=["DOCUMENT_EXTRACT", "CONTRACT_SCAN"],
                worker_version="0.1.0",
                last_seen_at=now - timedelta(seconds=29),
            )
        )
    assert client.get("/health/ready").json()["database"] == "ready"

    monkeypatch.setattr(routes, "_readiness_now", lambda: now + timedelta(seconds=2))
    stale = client.get("/health/ready")
    assert stale.status_code == 503
    assert stale.json()["error"]["code"] == "WORKER_HEARTBEAT_STALE"

    asset_id = _create_asset(client)
    listed = client.get("/v1/assets")
    detail = client.get(f"/v1/assets/{asset_id}")

    assert listed.status_code == 200
    assert [item["asset_id"] for item in listed.json()] == [asset_id]
    assert detail.json()["name"] == ASSET_PAYLOAD["name"]
    assert client.get("/v1/assets/missing").status_code == 404


def test_openapi_includes_task2_routes(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert {
        "/health",
        "/health/ready",
        "/v1/dashboard",
        "/v1/assets",
        "/v1/assets/{asset_id}",
        "/v1/assets/{asset_id}/contracts",
        "/v1/assets/{asset_id}/documents",
        "/v1/documents/{document_id}",
        "/v1/assets/{asset_id}/policies",
        "/v1/assets/{asset_id}/scans",
        "/v1/scans/{scan_id}",
        "/v1/alerts",
        "/v1/alerts/{alert_id}",
        "/v1/reports/{report_id}",
        "/v1/reports/{report_id}/download",
        "/v1/demo/evidence-report",
    } <= paths.keys()


def test_openapi_uses_one_schema_mode_for_runtime_and_generation() -> None:
    generated = build_openapi()
    runtime = app.openapi()

    assert generated["components"]["schemas"] == runtime["components"]["schemas"]
    assert not any(
        name.endswith(("-Input", "-Output"))
        for name in generated["components"]["schemas"]
    )


def test_failed_document_upload_does_not_rollback_created_asset(client: TestClient) -> None:
    asset_id = _create_asset(client)

    rejected = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": ("too-large.pdf", b"%PDF-" + b"x" * 20, "application/pdf")},
        data={"is_synthetic": "true"},
    )

    assert rejected.status_code == 413
    assert client.get(f"/v1/assets/{asset_id}").status_code == 200


def test_document_upload_hashes_content_and_queues_extract(
    client: TestClient,
    session_factory: sessionmaker[Session],
    tmp_path: Path,
) -> None:
    asset_id = _create_asset(client)
    content = b"%PDF-synthetic"

    response = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": ("../unsafe.pdf", content, "application/pdf")},
        data={"is_synthetic": "true"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["file_hash"] == f"sha256:{hashlib.sha256(content).hexdigest()}"
    assert payload["asset_id"] == asset_id
    assert client.get(f"/v1/documents/{payload['document_id']}").json() == payload
    stored_files = list((tmp_path / "uploads").glob("*"))
    assert len(stored_files) == 1
    assert ".." not in stored_files[0].name
    with session_factory() as session:
        job = session.scalar(select(JobRecord))
        assert job is not None
        assert job.job_type == "DOCUMENT_EXTRACT"
        assert job.payload["document_id"] == payload["document_id"]


@pytest.mark.parametrize(
    ("filename", "media_type", "form", "expected"),
    [
        ("fixture.exe", "application/pdf", {"is_synthetic": "true"}, 415),
        ("fixture.pdf", "text/plain", {"is_synthetic": "true"}, 415),
        ("fixture.txt", "text/plain", {"is_synthetic": "false"}, 422),
    ],
)
def test_document_upload_rejects_unsafe_or_non_synthetic_input(
    client: TestClient,
    filename: str,
    media_type: str,
    form: dict[str, str],
    expected: int,
) -> None:
    asset_id = _create_asset(client)
    response = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": (filename, b"synthetic", media_type)},
        data=form,
    )
    assert response.status_code == expected


def test_policy_patch_requires_matching_document_asset(client: TestClient) -> None:
    first_asset = _create_asset(client)
    second_payload = {**ASSET_PAYLOAD, "name": "두 번째 합성 자산"}
    second_asset = client.post("/v1/assets", json=second_payload).json()["asset_id"]
    uploaded = client.post(
        f"/v1/assets/{first_asset}/documents",
        files={"file": ("fixture.txt", b"synthetic", "text/plain")},
        data={"is_synthetic": "true"},
    ).json()
    patch = {
        "document_id": uploaded["document_id"],
        "policies": [
            {
                "constraint_id": "control_supply",
                    "field": "max_supply",
                "value": 100_000,
                "unit": "TOKEN",
                "evidence_span": {
                    "document_id": uploaded["document_id"],
                    "page": 1,
                    "start": 0,
                    "end": 9,
                    "quote": "synthetic",
                },
                "confirmed": True,
                "expected_version": 0,
            }
        ],
        "is_synthetic": True,
    }

    assert client.patch(f"/v1/assets/{first_asset}/policies", json=patch).status_code == 200
    assert client.patch(f"/v1/assets/{second_asset}/policies", json=patch).status_code == 404


def test_policy_ids_are_scoped_across_assets(client: TestClient) -> None:
    first_asset = _create_asset(client)
    second_asset = client.post(
        "/v1/assets", json={**ASSET_PAYLOAD, "name": "두 번째 합성 자산"}
    ).json()["asset_id"]
    first_document = client.post(
        f"/v1/assets/{first_asset}/documents",
        files={"file": ("first.txt", b"synthetic", "text/plain")},
        data={"is_synthetic": "true"},
    ).json()["document_id"]
    second_document = client.post(
        f"/v1/assets/{second_asset}/documents",
        files={"file": ("second.txt", b"synthetic", "text/plain")},
        data={"is_synthetic": "true"},
    ).json()["document_id"]

    def payload(document_id: str, value: int) -> dict[str, object]:
        return {
            "document_id": document_id,
            "policies": [
                {
                    "constraint_id": "shared_constraint",
                    "field": "max_supply",
                    "value": value,
                    "evidence_span": {
                        "document_id": document_id,
                        "page": 1,
                        "start": 0,
                        "end": 9,
                        "quote": "synthetic",
                    },
                    "confirmed": True,
                    "expected_version": 0,
                }
            ],
            "is_synthetic": True,
        }

    first_response = client.patch(
        f"/v1/assets/{first_asset}/policies", json=payload(first_document, 100)
    )
    second_response = client.patch(
        f"/v1/assets/{second_asset}/policies", json=payload(second_document, 999)
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()[0]["constraint_id"] != second_response.json()[0]["constraint_id"]
    first = client.get(f"/v1/documents/{first_document}").json()
    second = client.get(f"/v1/documents/{second_document}").json()
    assert first["controls"][0]["value"] == 100
    assert second["controls"][0]["value"] == 999


def test_policy_ids_are_scoped_across_document_versions(client: TestClient) -> None:
    asset_id = _create_asset(client)
    first_document = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": ("first.txt", b"synthetic", "text/plain")},
        data={"is_synthetic": "true"},
    ).json()["document_id"]
    second_document = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": ("second.txt", b"synthetic", "text/plain")},
        data={"is_synthetic": "true"},
    ).json()["document_id"]

    def payload(document_id: str, value: int) -> dict[str, object]:
        return {
            "document_id": document_id,
            "policies": [
                {
                    "constraint_id": "fixed_document_constraint",
                    "field": "max_supply",
                    "value": value,
                    "evidence_span": {
                        "document_id": document_id,
                        "page": 1,
                        "start": 0,
                        "end": 9,
                        "quote": "synthetic",
                    },
                    "confirmed": True,
                    "expected_version": 0,
                }
            ],
            "is_synthetic": True,
        }

    first = client.patch(
        f"/v1/assets/{asset_id}/policies", json=payload(first_document, 100)
    )
    assert first.status_code == 200
    first_id = first.json()[0]["constraint_id"]
    first_update = payload(first_document, 101)
    first_update["policies"][0]["constraint_id"] = first_id  # type: ignore[index]
    first_update["policies"][0]["expected_version"] = 1  # type: ignore[index]
    same_document_update = client.patch(
        f"/v1/assets/{asset_id}/policies", json=first_update
    )
    assert same_document_update.status_code == 200
    assert same_document_update.json()[0]["value"] == 101
    second = client.patch(
        f"/v1/assets/{asset_id}/policies", json=payload(second_document, 999)
    )

    assert second.status_code == 200
    assert second.json()[0]["constraint_id"] != first_id
    assert client.get(f"/v1/documents/{first_document}").json()["controls"][0]["value"] == 101
    assert client.get(f"/v1/documents/{second_document}").json()["controls"][0]["value"] == 999


def test_scan_creation_and_base_validation(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    asset_id = _create_asset(client)
    contract_id = _seed_scan_inputs(session_factory, asset_id)

    created = client.post(
        f"/v1/assets/{asset_id}/scans",
        json={"contract_id": contract_id, "base_scan_id": None, "is_synthetic": True},
    )

    assert created.status_code == 202
    scan_id = created.json()["scan_id"]
    assert client.get(f"/v1/scans/{scan_id}").json()["scan_run"]["status"] == "QUEUED"
    assert client.get(f"/v1/scans/{scan_id}?base=missing").status_code == 404
    with session_factory() as session:
        job = session.scalar(select(JobRecord).where(JobRecord.job_type == "CONTRACT_SCAN"))
        assert job is not None
        assert job.payload["scan_id"] == scan_id


def test_alert_patch_writes_audit_log(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    asset_id = _create_asset(client)
    now = datetime.now(UTC)
    with session_factory() as session:
        session.add(
            AlertRecord(
                id="alert_01",
                asset_id=asset_id,
                alert_type="SYNTHETIC_BREACH",
                severity="HIGH",
                status="NEW",
                cause={"reason": "fixture"},
                evidence_links=[{"kind": "CHAIN", "ref": "replay:1"}],
                dedupe_key="fixture:alert:1",
                evidence_mode="REPLAY",
                fixture_version="1.0.0",
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()

    assert client.get("/v1/alerts").json()[0]["status"] == "NEW"
    patched = client.patch(
        "/v1/alerts/alert_01",
        json={
            "status": "ACKNOWLEDGED",
            "memo": "합성 사건 검토",
            "expected_updated_at": now.isoformat(),
            "is_synthetic": True,
        },
    )

    assert patched.status_code == 200
    assert patched.json()["status"] == "ACKNOWLEDGED"
    with session_factory() as session:
        audit = session.scalar(select(AuditLogRecord))
        assert audit is not None
        assert audit.before_state["status"] == "NEW"
        assert audit.after_state["status"] == "ACKNOWLEDGED"
        assert audit.after_state["memo"] == "합성 사건 검토"


def test_alert_optimistic_update_rejects_stale_transaction(
    session_factory: sessionmaker[Session],
) -> None:
    now = datetime.now(UTC)
    with session_factory() as seed:
        seed.add(
            AssetRecord(
                id="asset_alert_lock",
                name="합성 알림 자산",
                asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                underlying_description="fixture",
                total_planned_supply=1,
                network="KAIA_KAIROS",
                currency="KRW",
                token_unit="TOKEN",
            )
        )
        seed.flush()
        seed.add(
            AlertRecord(
                id="alert_lock",
                asset_id="asset_alert_lock",
                alert_type="SYNTHETIC_BREACH",
                severity="HIGH",
                status="NEW",
                cause={"reason": "fixture"},
                evidence_links=[{"kind": "CHAIN", "ref": "replay:1"}],
                dedupe_key="fixture:alert:lock",
                evidence_mode="REPLAY",
                created_at=now,
                updated_at=now,
            )
        )
        seed.commit()

    with session_factory() as first_read:
        first_version = AlertRepository(first_read).get_for_update("alert_lock").updated_at
    with session_factory() as second_read:
        stale_version = AlertRepository(second_read).get_for_update("alert_lock").updated_at
    with session_factory() as first_write:
        assert AlertRepository(first_write).update_status_if_current(
            "alert_lock", first_version, "ACKNOWLEDGED", now + timedelta(seconds=1)
        )
        first_write.commit()
    with session_factory() as stale_write:
        assert not AlertRepository(stale_write).update_status_if_current(
            "alert_lock", stale_version, "RESOLVED", now + timedelta(seconds=2)
        )
        stale_write.rollback()

    with session_factory() as verification:
        assert verification.get(AlertRecord, "alert_lock").status == "ACKNOWLEDGED"


def test_postgresql_alert_read_uses_row_lock() -> None:
    class FakeSession:
        statement = None

        def scalar(self, statement):
            self.statement = statement
            return None

    fake = FakeSession()
    assert AlertRepository(fake).get_for_update("alert_lock") is None

    compiled = str(fake.statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE" in compiled


def test_report_json_download_round_trip(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    report = build_demo_report()
    scan = report.scan_run
    with session_factory() as session:
        session.add(
            AssetRecord(
                id=scan.asset_id,
                name="합성 데모 자산",
                asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                underlying_description="fixture",
                total_planned_supply=1,
                network="KAIA_KAIROS",
                currency="KRW",
                token_unit="TOKEN",
            )
        )
        session.flush()
        session.add(
            ScanRunRecord(
                id=scan.scan_id,
                asset_id=scan.asset_id,
                status=scan.status.value,
                input_hashes=scan.input_hashes,
                rule_versions=scan.rule_versions,
                failed_stages=[],
                started_at=scan.started_at,
                completed_at=scan.completed_at,
            )
        )
        session.flush()
        session.add(
            ReportRecord(
                id=report.report_id,
                asset_id=scan.asset_id,
                scan_id=scan.scan_id,
                status="READY",
                evidence=report.model_dump(mode="json"),
                report_hash=report.report_hash,
                downloads={},
                limitations=["합성 fixture 전용"],
                generated_at=report.generated_at,
            )
        )
        session.commit()

    metadata = client.get(f"/v1/reports/{report.report_id}")
    download = client.get(f"/v1/reports/{report.report_id}/download?format=json")

    assert metadata.status_code == 200
    assert metadata.json()["report"]["report_id"] == report.report_id
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("application/json")
    assert "attachment" in download.headers["content-disposition"]
    assert download.json()["report_id"] == report.report_id
    json_metadata = next(
        item for item in metadata.json()["downloads"] if item["format"] == "json"
    )
    assert json_metadata["sha256"] == f"sha256:{hashlib.sha256(download.content).hexdigest()}"

    with session_factory() as session:
        stored = session.get(ReportRecord, report.report_id)
        assert stored is not None
        tampered = deepcopy(stored.evidence)
        assert tampered is not None
        tampered["controls"][0]["value"] = 999_999
        stored.evidence = tampered
        with pytest.raises(ReportImmutableError):
            session.flush()
        session.rollback()

    preserved = client.get(f"/v1/reports/{report.report_id}/download?format=json")
    assert preserved.status_code == 200
    assert preserved.content == download.content


def test_job_claim_is_not_duplicated(
    session_factory: sessionmaker[Session],
) -> None:
    with session_factory() as session:
        repository = JobRepository(session)
        repository.enqueue("DOCUMENT_EXTRACT", {"document_id": "doc_01"})
        session.commit()

    with session_factory() as first:
        claimed = JobRepository(first).claim_next("worker-a", now=datetime.now(UTC))
        first.commit()
    with session_factory() as second:
        duplicate = JobRepository(second).claim_next("worker-b", now=datetime.now(UTC))

    assert claimed is not None
    assert claimed.attempt_count == 1
    assert duplicate is None


def test_job_max_attempts_check_is_enforced_by_sqlite(
    session_factory: sessionmaker[Session],
) -> None:
    checks = {
        str(item.sqltext)
        for item in JobRecord.__table__.constraints
        if isinstance(item, CheckConstraint)
    }
    assert "max_attempts > 0" in checks

    with pytest.raises(IntegrityError):
        with session_factory.begin() as session:
            session.execute(
                insert(JobRecord).values(
                    id="job_invalid_attempts",
                    job_type="DOCUMENT_EXTRACT",
                    payload={},
                    max_attempts=0,
                )
            )


def test_postgresql_claim_uses_skip_locked() -> None:
    class FakeSession:
        statement = None

        def get_bind(self):
            return type("Bind", (), {"dialect": type("Dialect", (), {"name": "postgresql"})()})()

        def scalar(self, statement):
            self.statement = statement
            return None

    fake = FakeSession()
    claimed = JobRepository(fake).claim_next("worker-postgres", now=datetime.now(UTC))

    assert claimed is None
    compiled = str(fake.statement.compile(dialect=postgresql.dialect()))
    assert "FOR UPDATE SKIP LOCKED" in compiled


def test_worker_retries_with_backoff_then_marks_terminal_failed(
    session_factory: sessionmaker[Session],
) -> None:
    with session_factory() as session:
        repository = JobRepository(session)
        job = repository.enqueue("DOCUMENT_EXTRACT", {"document_id": "doc_01"}, max_attempts=2)
        session.commit()
        job_id = job.id

    def fail(_job: JobRecord, _session: Session) -> None:
        raise RuntimeError("synthetic handler failure")

    registry = HandlerRegistry()
    registry.register("DOCUMENT_EXTRACT", fail)
    first_now = datetime.now(UTC)
    worker = JobWorker(
        session_factory=session_factory,
        registry=registry,
        worker_name="worker-test",
        retry_base_seconds=1,
        clock=lambda: first_now + timedelta(milliseconds=500),
    )

    assert worker.run_once(now=first_now) is True
    with session_factory() as session:
        retrying = session.get(JobRecord, job_id)
        heartbeat = session.get(WorkerHeartbeatRecord, "worker-test")
        assert retrying is not None
        assert heartbeat is not None
        assert heartbeat.last_seen_at.replace(tzinfo=UTC) == first_now + timedelta(
            milliseconds=500
        )
        assert retrying.status == "QUEUED"
        available_at = retrying.available_at.replace(tzinfo=UTC)
        assert available_at == first_now + timedelta(seconds=1, milliseconds=500)

    assert worker.run_once(now=first_now + timedelta(seconds=2)) is True
    with session_factory() as session:
        failed = session.get(JobRecord, job_id)
        assert failed is not None
        assert failed.status == "FAILED"
        assert failed.attempt_count == 2
        assert failed.last_error == "synthetic handler failure"


def test_worker_refreshes_heartbeat_while_handler_is_running(
    session_factory: sessionmaker[Session],
) -> None:
    with session_factory.begin() as session:
        JobRepository(session).enqueue("DOCUMENT_EXTRACT", {"document_id": "doc_long"})
    handler_active = Event()
    heartbeats_during_handler: list[datetime] = []

    def slow_handler(_job: JobRecord, _session: Session) -> None:
        handler_active.set()
        Event().wait(0.05)
        handler_active.clear()

    registry = HandlerRegistry()
    registry.register("DOCUMENT_EXTRACT", slow_handler)
    worker = JobWorker(
        session_factory,
        registry,
        "worker-long-job",
        heartbeat_interval_seconds=0.01,
    )
    original_heartbeat = worker.heartbeat

    def observed_heartbeat(*, status: str = "READY", now: datetime | None = None) -> None:
        if handler_active.is_set():
            heartbeats_during_handler.append(now or datetime.now(UTC))
        original_heartbeat(status=status, now=now)

    worker.heartbeat = observed_heartbeat
    assert worker.run_once() is True
    assert heartbeats_during_handler


def test_stale_running_jobs_are_requeued_then_terminally_failed(
    session_factory: sessionmaker[Session],
) -> None:
    claimed_at = datetime.now(UTC)
    with session_factory() as session:
        job = JobRepository(session).enqueue(
            "DOCUMENT_EXTRACT",
            {"document_id": "doc_stale"},
            max_attempts=2,
            available_at=claimed_at,
        )
        session.commit()
        job_id = job.id
    with session_factory() as session:
        assert JobRepository(session).claim_next("dead-worker", now=claimed_at)
        session.commit()

    recovered_at = claimed_at + timedelta(seconds=31)
    with session_factory() as session:
        assert JobRepository(session).recover_stale(
            now=recovered_at, lock_timeout=timedelta(seconds=30)
        ) == 1
        session.commit()
    with session_factory() as session:
        recovered = session.get(JobRecord, job_id)
        assert recovered.status == "QUEUED"
        assert recovered.locked_at is None
        assert recovered.locked_by is None
        assert JobRepository(session).claim_next("next-worker", now=recovered_at)
        session.commit()

    with session_factory() as session:
        assert JobRepository(session).recover_stale(
            now=recovered_at + timedelta(seconds=31),
            lock_timeout=timedelta(seconds=30),
        ) == 1
        session.commit()
    with session_factory() as session:
        terminal = session.get(JobRecord, job_id)
        assert terminal.status == "FAILED"
        assert terminal.locked_at is None
        assert terminal.locked_by is None


def test_stale_lease_cannot_finalize_or_persist_handler_side_effect(
    session_factory: sessionmaker[Session],
) -> None:
    claimed_at = datetime.now(UTC)
    with session_factory() as session:
        job = JobRepository(session).enqueue(
            "DOCUMENT_EXTRACT",
            {"document_id": "doc_fenced"},
            max_attempts=3,
            available_at=claimed_at,
        )
        session.commit()
        job_id = job.id
    with session_factory() as stale_owner:
        first_claim = JobRepository(stale_owner).claim_next("worker-old", now=claimed_at)
        assert first_claim is not None
        first_lease = JobLease.from_record(first_claim)
        stale_owner.commit()
    with session_factory() as recovery:
        JobRepository(recovery).recover_stale(
            now=claimed_at + timedelta(seconds=31),
            lock_timeout=timedelta(seconds=30),
        )
        recovery.commit()
    with session_factory() as new_owner:
        second_claim = JobRepository(new_owner).claim_next(
            "worker-old", now=claimed_at + timedelta(seconds=31)
        )
        assert second_claim is not None
        second_lease = JobLease.from_record(second_claim)
        new_owner.commit()

    assert second_lease.lease_token != first_lease.lease_token
    assert second_lease.attempt_count == first_lease.attempt_count + 1
    with pytest.raises(LeaseLost):
        with session_factory.begin() as stale_handler:
            stale_handler.add(
                WorkerHeartbeatRecord(
                    worker_name="stale-handler-side-effect",
                    status="READY",
                    capabilities=["DOCUMENT_EXTRACT"],
                    last_seen_at=claimed_at,
                )
            )
            JobRepository(stale_handler).complete(
                first_lease,
                now=claimed_at + timedelta(seconds=32),
            )

    with session_factory() as verification:
        assert (
            verification.get(WorkerHeartbeatRecord, "stale-handler-side-effect") is None
        )
        current = verification.get(JobRecord, job_id)
        assert current.status == "RUNNING"
        assert current.locked_by == "worker-old"
        assert current.lease_token == second_lease.lease_token
        error_before_stale_failure = current.last_error

    with pytest.raises(LeaseLost):
        with session_factory.begin() as stale_failure:
            JobRepository(stale_failure).fail(
                first_lease,
                "old worker failure",
                now=claimed_at + timedelta(seconds=33),
                retry_base_seconds=1,
            )
    with session_factory() as verification:
        current = verification.get(JobRecord, job_id)
        assert current.status == "RUNNING"
        assert current.locked_by == "worker-old"
        assert current.last_error == error_before_stale_failure


def test_worker_loop_stays_alive_until_stop_and_records_stopping(
    session_factory: sessionmaker[Session],
) -> None:
    registry = HandlerRegistry()
    worker = JobWorker(session_factory, registry, "worker-loop")
    started = Event()
    stop = Event()
    original_heartbeat = worker.heartbeat

    def observed_heartbeat(*, status: str = "READY", now: datetime | None = None) -> None:
        original_heartbeat(status=status, now=now)
        if status == "READY":
            started.set()

    worker.heartbeat = observed_heartbeat
    thread = Thread(
        target=worker.run_forever,
        kwargs={
            "poll_interval_seconds": 0.01,
            "lock_timeout": timedelta(seconds=30),
            "stop_event": stop,
        },
    )
    thread.start()

    assert started.wait(timeout=1)
    assert thread.is_alive()
    stop.set()
    thread.join(timeout=1)

    assert not thread.is_alive()
    with session_factory() as session:
        heartbeat = session.get(WorkerHeartbeatRecord, "worker-loop")
        assert heartbeat.status == "STOPPING"


def test_worker_cli_handles_keyboard_interrupt(monkeypatch: pytest.MonkeyPatch) -> None:
    class InterruptingWorker:
        called = False
        registry = HandlerRegistry()

        def run_forever(self, **_kwargs: object) -> None:
            self.called = True
            raise KeyboardInterrupt

    worker = InterruptingWorker()
    monkeypatch.setattr(worker_cli, "build_worker", lambda _settings: worker)

    assert worker_cli.main() == 0
    assert worker.called


def test_worker_heartbeat_and_required_handler_hooks(
    session_factory: sessionmaker[Session],
) -> None:
    registry = HandlerRegistry()
    assert registry.supported_job_types == {"DOCUMENT_EXTRACT", "CONTRACT_SCAN"}
    worker = JobWorker(session_factory, registry, "worker-heartbeat")

    worker.heartbeat(status="READY", now=datetime.now(UTC))

    with session_factory() as session:
        heartbeat = session.get(WorkerHeartbeatRecord, "worker-heartbeat")
        assert heartbeat is not None
        assert set(heartbeat.capabilities) == {"DOCUMENT_EXTRACT", "CONTRACT_SCAN"}
        assert heartbeat.worker_version == "0.1.0"


def test_dashboard_and_missing_ids_do_not_leak_demo_data(client: TestClient) -> None:
    asset_id = _create_asset(client)
    dashboard = client.get("/v1/dashboard").json()

    assert dashboard["total_assets"] == 1
    assert dashboard["assets"][0]["asset_id"] == asset_id
    assert dashboard["recent_alerts"] == []
    for path in (
        "/v1/assets/missing",
        "/v1/documents/missing",
        "/v1/scans/missing",
        "/v1/reports/missing",
    ):
        response = client.get(path)
        assert response.status_code == 404
        assert "demo" not in response.text.lower()
    alert = client.patch(
        "/v1/alerts/missing",
        json={
            "status": "RESOLVED",
            "expected_updated_at": datetime.now(UTC).isoformat(),
            "is_synthetic": True,
        },
    )
    assert alert.status_code == 404
