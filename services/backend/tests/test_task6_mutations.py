from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.api.main import create_app
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import (
    AlertRecord,
    AssetRecord,
    AuditLogRecord,
    IssuanceDocumentRecord,
    OperatorLoginAttemptRecord,
    PolicyConstraintRecord,
    ScanRunRecord,
)
from rwa_guard.db.repositories import PolicyRepository, PolicyVersionConflict
from rwa_guard.domain.contracts import OnchainEvidence

REPOSITORY = Path(__file__).resolve().parents[3]


def _client(
    tmp_path: Path,
    *,
    app_env: str = "test",
    allow_insecure_demo_operator: bool = True,
    operator_token: str | None = None,
    operator_access_code: str = "Strong-Operator-Code-2026!",
) -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    settings = Settings(
        app_env=app_env,
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        rwa_guard_fixture_root=REPOSITORY,
        allow_insecure_demo_operator=allow_insecure_demo_operator,
        operator_token=operator_token,
        operator_id="configured-operator",
        operator_access_code=operator_access_code,
    )
    return TestClient(create_app(settings=settings, session_factory=factory)), factory


def test_alert_patch_persists_memo_audit_and_rejects_stale_version(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    before = client.get("/v1/alerts").json()[0]

    changed = client.patch(
        f"/v1/alerts/{before['alert_id']}",
        json={
            "status": "ACKNOWLEDGED",
            "memo": "담보 통제 근거를 확인 중입니다.",
            "expected_updated_at": before["updated_at"],
            "is_synthetic": True,
        },
    )
    stale = client.patch(
        f"/v1/alerts/{before['alert_id']}",
        json={
            "status": "RESOLVED",
            "memo": "중복 제출",
            "expected_updated_at": before["updated_at"],
            "is_synthetic": True,
        },
    )

    assert changed.status_code == 200
    assert changed.json()["memo"] == "담보 통제 근거를 확인 중입니다."
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "ALERT_CONCURRENT_UPDATE"
    with factory() as session:
        alert = session.get(AlertRecord, before["alert_id"])
        audit = session.scalar(
            select(AuditLogRecord).where(AuditLogRecord.target_id == before["alert_id"])
        )
        assert alert is not None and alert.memo == "담보 통제 근거를 확인 중입니다."
        assert audit is not None
        assert audit.actor_type == "INSECURE_DEMO"
        assert audit.actor_id == "demo-operator"
        assert audit.auth_metadata == {"authentication_mode": "INSECURE_DEMO"}
        assert audit.before_state == {"status": "NEW", "memo": None}
        assert audit.after_state["status"] == "ACKNOWLEDGED"
        assert audit.after_state["memo"] == "담보 통제 근거를 확인 중입니다."
        assert audit.created_at is not None
        assert session.scalars(
            select(AuditLogRecord).where(AuditLogRecord.target_id == before["alert_id"])
        ).all() == [audit]
    assert seeded["asset_id"] == changed.json()["asset_id"]


def test_policy_patch_writes_before_after_actor_and_timestamp(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    control = client.get(f"/v1/documents/{seeded['document_id']}").json()["controls"][0]
    changed = {
        "constraint_id": control["constraint_id"],
        "field": control["field"],
        "value": 120_000,
        "unit": control["unit"],
        "evidence_span": control["evidence_span"],
        "confirmed": False,
        "expected_version": control.get("version", 1),
        "is_synthetic": True,
    }

    response = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies",
        json={
            "document_id": seeded["document_id"],
            "policies": [changed],
            "is_synthetic": True,
        },
    )
    duplicate = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies",
        json={
            "document_id": seeded["document_id"],
            "policies": [changed],
            "is_synthetic": True,
        },
    )

    assert response.status_code == 200
    assert duplicate.status_code == 409
    with factory() as session:
        audit = session.scalar(
            select(AuditLogRecord).where(
                AuditLogRecord.action == "POLICY_CHANGED",
                AuditLogRecord.target_id == control["constraint_id"],
            )
        )
        assert audit is not None
        assert audit.actor_type == "INSECURE_DEMO"
        assert audit.actor_id == "demo-operator"
        assert audit.auth_metadata == {"authentication_mode": "INSECURE_DEMO"}
        assert audit.before_state["value"] == control["value"]
        assert audit.after_state["value"] == 120_000
        assert audit.before_state["version"] == 1
        assert audit.after_state["version"] == 2
        policy = session.scalar(
            select(PolicyConstraintRecord).where(
                PolicyConstraintRecord.asset_id == seeded["asset_id"]
            )
        )
        assert policy is not None and policy.version == 2
        assert isinstance(audit.created_at, datetime)
        assert audit.created_at.replace(tzinfo=UTC) <= datetime.now(UTC)
        assert len(
            session.scalars(
                select(AuditLogRecord).where(
                    AuditLogRecord.action == "POLICY_CHANGED",
                    AuditLogRecord.target_id == control["constraint_id"],
                )
            ).all()
        ) == 1


def test_dashboard_excludes_unconfirmed_findings_from_critical_aggregate(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    with factory.begin() as session:
        scan = session.get(ScanRunRecord, seeded["scan_id"])
        assert scan is not None
        payload = dict(scan.result_payload)
        payload["code_findings"] = [
            {**finding, "status": "NEEDS_REVIEW"}
            for finding in payload["code_findings"]
        ]
        scan.result_payload = payload

    dashboard = client.get("/v1/dashboard").json()

    assert dashboard["critical_assets"] == 0
    assert dashboard["high_assets"] == 0
    assert dashboard["assets"][0]["highest_severity"] is None


def test_production_mutations_require_configured_bearer_operator(tmp_path: Path) -> None:
    unconfigured, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
    )
    assert unconfigured.get("/health").json()["p0_ready"] is False
    assert unconfigured.get("/health/ready").status_code == 503
    assert unconfigured.post("/v1/demo/bootstrap").status_code == 503

    configured, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    assert configured.post("/v1/demo/bootstrap").status_code == 401
    assert configured.post(
        "/v1/demo/bootstrap",
        headers={"Authorization": "Bearer wrong"},
    ).status_code == 401
    allowed = configured.post(
        "/v1/demo/bootstrap",
        headers={"Authorization": "Bearer server-secret"},
    )
    assert allowed.status_code == 201


def test_operator_health_probe_only_verifies_bearer_context(tmp_path: Path) -> None:
    client, factory = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    assert client.get("/health/operator").status_code == 401
    assert client.get(
        "/health/operator",
        headers={"Authorization": "Bearer wrong"},
    ).status_code == 401
    allowed = client.get(
        "/health/operator",
        headers={"Authorization": "Bearer server-secret"},
    )
    assert allowed.status_code == 200
    assert allowed.json() == {"ready": True}
    with factory() as session:
        assert session.scalar(select(AuditLogRecord)) is None


def test_operator_health_requires_login_attempt_migration_and_columns(tmp_path: Path) -> None:
    client, factory = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret"}
    with factory() as session:
        engine = session.get_bind()
    OperatorLoginAttemptRecord.__table__.drop(engine)

    missing = client.get("/health/operator", headers=auth)
    assert missing.status_code == 503
    assert "operator_login_attempts" not in missing.text

    with engine.begin() as connection:
        connection.exec_driver_sql(
            "create table operator_login_attempts (fingerprint text primary key)"
        )
    incomplete = client.get("/health/operator", headers=auth)
    assert incomplete.status_code == 503
    assert "window_started_at" not in incomplete.text


def test_operator_access_code_strength_controls_probe_and_verify(tmp_path: Path) -> None:
    client, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
        operator_access_code="too-short",
    )
    auth = {"Authorization": "Bearer server-secret"}
    assert client.post(
        "/v1/operator/session/verify",
        json={"fingerprint": f"fp_{'a' * 64}", "access_code": "too-short"},
    ).status_code == 401
    assert client.get("/health/operator", headers=auth).status_code == 503
    response = client.post(
        "/v1/operator/session/verify",
        headers=auth,
        json={"fingerprint": f"fp_{'a' * 64}", "access_code": "too-short"},
    )
    assert response.status_code == 503


def test_operator_verify_limits_failures_per_opaque_fingerprint_and_clears_success(
    tmp_path: Path,
) -> None:
    client, factory = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret"}

    def verify(fingerprint: str, code: str):
        return client.post(
            "/v1/operator/session/verify",
            headers=auth,
            json={"fingerprint": fingerprint, "access_code": code},
        )

    first = f"fp_{'a' * 64}"
    second = f"fp_{'b' * 64}"
    assert [verify(first, "wrong").status_code for _ in range(5)] == [401] * 5
    assert verify(first, "wrong").status_code == 429
    assert verify(second, "wrong").status_code == 401

    clearable = f"fp_{'c' * 64}"
    assert verify(clearable, "wrong").status_code == 401
    success = verify(clearable, "Strong-Operator-Code-2026!")
    assert success.status_code == 200
    assert success.json() == {"verified": True}
    with factory() as session:
        assert session.get(OperatorLoginAttemptRecord, clearable) is None
        stored = session.get(OperatorLoginAttemptRecord, first)
        assert stored is not None
        assert stored.failures == 5
        assert stored.fingerprint == first
        assert "ip" not in stored.__table__.columns
        assert "user_agent" not in stored.__table__.columns


def test_operator_verify_lock_expires_with_injected_clock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = [datetime(2026, 8, 28, tzinfo=UTC)]
    monkeypatch.setattr("rwa_guard.api.routes._operator_now", lambda: now[0])
    client, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret"}
    payload = {"fingerprint": f"fp_{'d' * 64}", "access_code": "wrong"}
    for _ in range(5):
        response = client.post(
            "/v1/operator/session/verify", headers=auth, json=payload
        )
        assert response.status_code == 401
    limited = client.post(
        "/v1/operator/session/verify", headers=auth, json=payload
    )
    assert limited.status_code == 429
    now[0] += timedelta(minutes=16)
    assert client.post("/v1/operator/session/verify", headers=auth, json=payload).status_code == 401


def test_operator_verify_rejects_oversized_or_malformed_body(tmp_path: Path) -> None:
    client, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret", "Content-Type": "application/json"}
    oversized = client.post(
        "/v1/operator/session/verify",
        headers=auth,
        content=b"x" * 1_025,
    )
    malformed = client.post(
        "/v1/operator/session/verify",
        headers=auth,
        content=b"{not-json}",
    )
    assert oversized.status_code == 413
    assert malformed.status_code == 400
    assert "x" * 20 not in oversized.text


def test_concurrent_operator_failures_never_exceed_limit(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'operator-rate.db'}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    settings = Settings(
        app_env="production",
        database_url=str(engine.url),
        storage_directory=tmp_path / "uploads",
        operator_token="server-secret",
        operator_id="configured-operator",
        operator_access_code="Strong-Operator-Code-2026!",
    )
    client = TestClient(create_app(settings=settings, session_factory=factory))
    auth = {"Authorization": "Bearer server-secret"}
    payload = {"fingerprint": f"fp_{'e' * 64}", "access_code": "wrong"}

    def fail_once(_: int) -> int:
        return client.post(
            "/v1/operator/session/verify",
            headers=auth,
            json=payload,
        ).status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        statuses = list(executor.map(fail_once, range(10)))

    assert statuses.count(401) == 5
    assert statuses.count(429) == 5
    with factory() as session:
        attempt = session.get(OperatorLoginAttemptRecord, payload["fingerprint"])
        assert attempt is not None and attempt.failures == 5


def test_request_body_cannot_select_audit_actor(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    response = client.post(
        "/v1/assets",
        json={
            "name": "합성 자산",
            "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
            "underlying_description": "fixture",
            "total_planned_supply": 1,
            "network": "KAIA_KAIROS",
            "currency": "KRW",
            "token_unit": "TOKEN",
            "actor": "forged-admin",
            "is_synthetic": True,
        },
    )
    assert response.status_code == 422


def test_alert_requires_version_preserves_omitted_memo_and_enforces_transitions(
    tmp_path: Path,
) -> None:
    client, _ = _client(tmp_path)
    client.post("/v1/demo/bootstrap")
    alert = client.get("/v1/alerts").json()[0]

    assert client.patch(
        f"/v1/alerts/{alert['alert_id']}",
        json={"status": "ACKNOWLEDGED", "is_synthetic": True},
    ).status_code == 422
    acknowledged = client.patch(
        f"/v1/alerts/{alert['alert_id']}",
        json={
            "status": "ACKNOWLEDGED",
            "memo": "유지할 메모",
            "expected_updated_at": alert["updated_at"],
            "is_synthetic": True,
        },
    )
    assert acknowledged.status_code == 200
    illegal = client.patch(
        f"/v1/alerts/{alert['alert_id']}",
        json={
            "status": "RESOLVED",
            "expected_updated_at": acknowledged.json()["updated_at"],
            "is_synthetic": True,
        },
    )
    assert illegal.status_code == 409
    investigating = client.patch(
        f"/v1/alerts/{alert['alert_id']}",
        json={
            "status": "INVESTIGATING",
            "expected_updated_at": acknowledged.json()["updated_at"],
            "is_synthetic": True,
        },
    )
    assert investigating.status_code == 200
    assert investigating.json()["memo"] == "유지할 메모"


def test_policy_patch_requires_version_and_rejects_stale_update(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    control = client.get(f"/v1/documents/{seeded['document_id']}").json()["controls"][0]
    assert control["version"] == 1
    patch = {
        "constraint_id": control["constraint_id"],
        "field": control["field"],
        "value": 123_000,
        "unit": control["unit"],
        "evidence_span": control["evidence_span"],
        "confirmed": False,
        "expected_version": control["version"],
        "is_synthetic": True,
    }
    first = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies",
        json={
            "document_id": seeded["document_id"],
            "policies": [patch],
            "is_synthetic": True,
        },
    )
    stale = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies",
        json={
            "document_id": seeded["document_id"],
            "policies": [{**patch, "value": 999_000}],
            "is_synthetic": True,
        },
    )
    assert first.status_code == 200
    assert first.json()[0]["version"] == 2
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "POLICY_CONCURRENT_UPDATE"


def test_new_policy_stale_observers_normalize_unique_race_to_version_conflict(
    tmp_path: Path,
) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'policy-race.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory.begin() as seed:
        seed.add(
            AssetRecord(
                id="asset",
                name="정책 경쟁 합성 자산",
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
            IssuanceDocumentRecord(
                id="document",
                asset_id="asset",
                file_hash="sha256:fixture",
                version="1",
                status="READY",
                media_type="text/plain",
                size_bytes=1,
                page_count=1,
            )
        )
    first = factory()
    second = factory()
    try:
        assert PolicyRepository(first).get("asset", "control_race") is None
        assert PolicyRepository(second).get("asset", "control_race") is None
        def make_policy() -> PolicyConstraintRecord:
            return PolicyConstraintRecord(
                id="control_race",
                asset_id="asset",
                document_id="document",
                field_name="max_supply",
                normalized_value={"value": 1, "unit": "TOKEN"},
                evidence_span={
                    "document_id": "document",
                    "page": 1,
                    "start": 0,
                    "end": 1,
                    "quote": "1",
                },
                confirmed=False,
                version=1,
            )
        PolicyRepository(first).insert_new(make_policy())
        first.commit()
        with pytest.raises(PolicyVersionConflict):
            PolicyRepository(second).insert_new(make_policy())
    finally:
        first.close()
        second.close()


def test_new_policy_integrity_race_returns_409_not_500(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    payload = {
        "document_id": seeded["document_id"],
        "policies": [{
            "constraint_id": "manual_race",
            "field": "oracle_max_age",
            "value": 60,
            "unit": "MINUTE",
            "page": 1,
            "quote": "가격은 60분 이내에 갱신되어야 한다.",
            "confirmed": False,
            "expected_version": 0,
            "is_synthetic": True,
        }],
        "is_synthetic": True,
    }
    first = client.patch(f"/v1/assets/{seeded['asset_id']}/policies", json=payload)
    assert first.status_code == 200

    monkeypatch.setattr(PolicyRepository, "get_for_update", lambda *_args: None)
    raced = client.patch(f"/v1/assets/{seeded['asset_id']}/policies", json=payload)
    assert raced.status_code == 409
    assert raced.json()["error"]["code"] == "POLICY_VERSION_CONFLICT"


def test_all_browser_mutation_routes_reject_missing_production_auth(tmp_path: Path) -> None:
    client, _ = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret"}
    seeded = client.post("/v1/demo/bootstrap", headers=auth).json()
    alert = client.get("/v1/alerts").json()[0]
    document = client.get(f"/v1/documents/{seeded['document_id']}").json()
    control = document["controls"][0]
    mutations = [
        client.post(
            "/v1/assets",
            json={
                "name": "합성 자산",
                "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                "underlying_description": "fixture",
                "total_planned_supply": 1,
                "network": "KAIA_KAIROS",
                "currency": "KRW",
                "token_unit": "TOKEN",
                "is_synthetic": True,
            },
        ),
        client.post(
            f"/v1/assets/{seeded['asset_id']}/documents",
            files={"file": ("terms.txt", b"synthetic", "text/plain")},
            data={"is_synthetic": "true"},
        ),
        client.post(
            f"/v1/assets/{seeded['asset_id']}/contracts",
            json={"source_code": "contract X {}", "chain_id": 1001, "is_synthetic": True},
        ),
        client.post(
            f"/v1/assets/{seeded['asset_id']}/scans",
            json={"contract_id": seeded["contract_id"], "is_synthetic": True},
        ),
        client.patch(
            f"/v1/assets/{seeded['asset_id']}/policies",
            json={
                "document_id": seeded["document_id"],
                "policies": [{
                    "constraint_id": control["constraint_id"],
                    "field": control["field"],
                    "value": control["value"],
                    "unit": control["unit"],
                    "evidence_span": control["evidence_span"],
                    "confirmed": control["confirmed"],
                    "expected_version": control["version"],
                    "is_synthetic": True,
                }],
                "is_synthetic": True,
            },
        ),
        client.patch(
            f"/v1/alerts/{alert['alert_id']}",
            json={
                "status": "ACKNOWLEDGED",
                "expected_updated_at": alert["updated_at"],
                "is_synthetic": True,
            },
        ),
    ]
    assert [response.status_code for response in mutations] == [401] * len(mutations)


def test_configured_bearer_actor_is_server_derived_in_audit(tmp_path: Path) -> None:
    client, factory = _client(
        tmp_path,
        app_env="production",
        allow_insecure_demo_operator=False,
        operator_token="server-secret",
    )
    auth = {"Authorization": "Bearer server-secret"}
    client.post("/v1/demo/bootstrap", headers=auth)
    alert = client.get("/v1/alerts").json()[0]
    response = client.patch(
        f"/v1/alerts/{alert['alert_id']}",
        headers=auth,
        json={
            "status": "ACKNOWLEDGED",
            "expected_updated_at": alert["updated_at"],
            "is_synthetic": True,
        },
    )
    assert response.status_code == 200
    with factory() as session:
        audit = session.scalar(select(AuditLogRecord))
        assert audit is not None
        assert audit.actor_type == "OPERATOR"
        assert audit.actor_id == "configured-operator"
        assert audit.auth_metadata == {"authentication_mode": "CONFIGURED_BEARER"}


def test_live_evidence_requires_verified_successful_receipt() -> None:
    base = {
        "asset_id": "asset",
        "mode": "LIVE",
        "chain_id": 1001,
        "tx_hash": f"0x{'1' * 64}",
        "log_index": 0,
        "block_number": 1,
        "event_name": "Minted",
        "is_synthetic": True,
    }
    with pytest.raises(ValidationError):
        OnchainEvidence.model_validate(base)

    evidence = OnchainEvidence.model_validate({
        **base,
        "receipt_status": "SUCCESS",
        "block_hash": f"0x{'2' * 64}",
        "verified_at": "2026-08-28T00:00:00Z",
    })
    assert evidence.receipt_status == "SUCCESS"
