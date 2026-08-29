import hashlib
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pymupdf as fitz
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.api.main import create_app
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import (
    AssetRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    PolicyConstraintRecord,
    ReportRecord,
    ScanRunRecord,
)
from rwa_guard.fixtures import build_demo_report

REPOSITORY = Path(__file__).resolve().parents[3]


def _client(tmp_path: Path) -> tuple[TestClient, sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        allow_insecure_demo_operator=True,
    )
    return TestClient(create_app(settings=settings, session_factory=factory)), factory


def _simulate_legacy_ready_report_corruption(
    session: Session, report_id: str, **values: object
) -> None:
    """Bypass new guards to retain GET checks for pre-migration corruption."""

    session.execute(text("drop trigger if exists reports_ready_immutable_update"))
    session.execute(text("drop trigger if exists reports_ready_immutable_delete"))
    session.execute(
        update(ReportRecord).where(ReportRecord.id == report_id).values(**values)
    )


def test_sqlite_test_engine_enforces_foreign_keys(tmp_path: Path) -> None:
    _, factory = _client(tmp_path)

    with factory() as session:
        assert session.scalar(text("PRAGMA foreign_keys")) == 1


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("evidence", '{"tampered":true}'),
        ("report_hash", "sha256:tampered"),
        ("status", "FAILED"),
        ("scan_id", "scan_other"),
        ("asset_id", "asset_other"),
        ("generated_at", "2030-01-01T00:00:00+00:00"),
    ],
)
def test_sqlite_database_rejects_every_update_to_ready_report(
    tmp_path: Path, column: str, value: str
) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]

    with factory() as session:
        with pytest.raises(IntegrityError, match="READY report is immutable"):
            session.execute(
                text(f"update reports set {column} = :value where id = :report_id"),
                {"value": value, "report_id": report_id},
            )


def test_sqlite_database_rejects_delete_of_ready_report(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]

    with factory() as session:
        with pytest.raises(IntegrityError, match="READY report is immutable"):
            session.execute(delete(ReportRecord).where(ReportRecord.id == report_id))


def test_sqlite_database_allows_completion_transition_to_ready(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    with factory.begin() as session:
        session.add(
            ScanRunRecord(
                id="scan_completion_transition",
                asset_id=seeded["asset_id"],
                status="RUNNING",
                input_hashes={},
                rule_versions={},
                failed_stages=[],
                result_payload={},
                started_at=datetime.now(UTC),
            )
        )
        session.flush()
        session.add(
            ReportRecord(
                id="report_completion_transition",
                asset_id=seeded["asset_id"],
                scan_id="scan_completion_transition",
                status="QUEUED",
            )
        )

    with factory.begin() as session:
        session.execute(
            update(ReportRecord)
            .where(
                ReportRecord.id == "report_completion_transition",
                ReportRecord.status == "QUEUED",
            )
            .values(
                status="READY",
                evidence={"worker": "completed"},
                report_hash="sha256:worker-completed",
                generated_at=datetime.now(UTC),
            )
        )

    with factory() as session:
        completed = session.get(ReportRecord, "report_completion_transition")
        assert completed is not None
        assert completed.status == "READY"


def test_demo_bootstrap_is_persisted_replay_and_idempotent(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)

    first = client.post("/v1/demo/bootstrap")
    second = client.post("/v1/demo/bootstrap")

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json() == first.json()
    payload = first.json()
    assert payload["is_synthetic"] is True
    assert payload["evidence_mode"] == "REPLAY"
    assert payload["fixture_version"] == "0.1.0"
    assert set(payload) >= {
        "asset_id",
        "document_id",
        "contract_id",
        "scan_id",
        "report_id",
    }

    asset = client.get(f"/v1/assets/{payload['asset_id']}").json()
    scan = client.get(f"/v1/scans/{payload['scan_id']}").json()
    report = client.get(f"/v1/reports/{payload['report_id']}").json()
    assert asset["documents"][0]["status"] == "READY"
    assert asset["scans"][0]["status"] == "COMPLETED"
    assert scan["onchain_evidence"][0]["mode"] == "REPLAY"
    assert report["status"] == "READY"
    assert scan["scan_run"]["status"] == "COMPLETED"
    assert len(report["report"]["controls"]) == 6
    assert all(control["confirmed"] for control in report["report"]["controls"])

    with factory() as session:
        assert session.scalar(select(func.count()).select_from(AssetRecord)) == 1
        assert session.scalar(select(func.count()).select_from(IssuanceDocumentRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ContractRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ScanRunRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ReportRecord)) == 1


def test_bootstrap_does_not_retry_or_disclose_foreign_key_errors(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    class ForeignKeyFailureSession(Session):
        def flush(self, objects: object = None) -> None:
            raise IntegrityError(
                "private insert statement",
                {"private": "value"},
                sqlite3.IntegrityError("FOREIGN KEY constraint failed: private"),
            )

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(
        bind=engine,
        class_=ForeignKeyFailureSession,
        autoflush=False,
        expire_on_commit=False,
    )
    client = TestClient(
        create_app(
            settings=Settings(
                app_env="test",
                storage_directory=tmp_path / "uploads",
                allow_insecure_demo_operator=True,
            ),
            session_factory=factory,
        )
    )

    response = client.post("/v1/demo/bootstrap")

    assert response.status_code == 500
    assert response.json()["error"] == {
        "code": "DEMO_BOOTSTRAP_INTEGRITY_ERROR",
        "message": "demo fixture persistence failed; inspect server logs",
    }
    assert "private" not in response.text
    assert "demo bootstrap integrity failure" in caplog.text
    assert "kind=FOREIGN_KEY" in caplog.text


def test_demo_report_locations_and_hashes_match_repository_fixtures() -> None:
    report = build_demo_report()
    document_path = REPOSITORY / "data/synthetic/documents/issuance-terms-01.txt"
    document_bytes = document_path.read_bytes()
    document_text = document_bytes.decode()
    assert report.scan_run.input_hashes["document"] == (
        f"sha256:{hashlib.sha256(document_bytes).hexdigest()}"
    )
    contract_source = (
        (REPOSITORY / "chain/src/fixtures/VulnerableRwaToken.sol").read_bytes()
        + b"\n\n"
        + (REPOSITORY / "chain/src/fixtures/VulnerableOracle.sol").read_bytes()
    )
    assert report.scan_run.input_hashes["contract_source"] == (
        f"sha256:{hashlib.sha256(contract_source).hexdigest()}"
    )
    for control in report.controls:
        span = control.evidence_span
        assert span.page == 1
        assert document_text[span.start : span.end] == span.quote

    for finding in report.code_findings:
        source_path = REPOSITORY / finding.code_location.file
        source_bytes = source_path.read_bytes()
        source_lines = source_bytes.decode().splitlines()
        location = finding.code_location
        assert finding.source_hash == f"sha256:{hashlib.sha256(source_bytes).hexdigest()}"
        actual_excerpt = "\n".join(
            source_lines[location.start_line - 1 : location.end_line]
        )
        assert actual_excerpt == location.excerpt
        assert finding.source_hash in report.scan_run.input_hashes.values()


def test_demo_report_is_byte_deterministic_and_does_not_claim_unproven_implementation() -> None:
    first = build_demo_report()
    second = build_demo_report()

    assert first.model_dump(mode="json") == second.model_dump(mode="json")
    assert first.report_hash == second.report_hash
    mismatch_ids = {item.constraint_id for item in first.mismatches}
    assert "control_issuer_role" not in mismatch_ids
    assert "control_pauser_role" not in mismatch_ids
    assert all(item.implementation_status.value != "IMPLEMENTED" for item in first.mismatches)


def test_bootstrap_repairs_partial_seed_and_preserves_other_assets(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    with factory.begin() as session:
        session.add(
            AssetRecord(
                id="asset_other",
                name="다른 합성 자산",
                asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                underlying_description="보존되어야 하는 자산",
                total_planned_supply=1,
                network="KAIA_KAIROS",
                currency="KRW",
                token_unit="TOKEN",
            )
        )
        session.add(
            AssetRecord(
                id="asset_synthetic_hanriver_01",
                name="부분 시드",
                asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                underlying_description="partial",
                total_planned_supply=1,
                network="KAIA_KAIROS",
                currency="KRW",
                token_unit="TOKEN",
            )
        )

    response = client.post("/v1/demo/bootstrap")

    assert response.status_code == 200
    payload = response.json()
    assert client.get(f"/v1/documents/{payload['document_id']}").status_code == 200
    assert client.get(f"/v1/scans/{payload['scan_id']}").json()["report_id"] == payload["report_id"]
    assert client.get("/v1/assets/asset_other").json()["name"] == "다른 합성 자산"


def test_bootstrap_independent_sessions_converge_without_mutating_snapshot(tmp_path: Path) -> None:
    first_client, factory = _client(tmp_path)
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        allow_insecure_demo_operator=True,
    )
    second_client = TestClient(create_app(settings=settings, session_factory=factory))
    first_response = first_client.post("/v1/demo/bootstrap")
    before = first_client.get(f"/v1/reports/{first_response.json()['report_id']}").json()["report"]
    with factory.begin() as session:
        session.execute(
            delete(PolicyConstraintRecord).where(
                PolicyConstraintRecord.document_id == first_response.json()["document_id"]
            )
        )
        document = session.get(IssuanceDocumentRecord, first_response.json()["document_id"])
        assert document is not None
        session.delete(document)

    second_response = second_client.post("/v1/demo/bootstrap")
    after = second_client.get(f"/v1/reports/{first_response.json()['report_id']}").json()["report"]

    assert first_response.status_code == 201
    assert second_response.status_code == 200
    assert first_response.json() == second_response.json()
    assert before == after
    assert before["report_hash"] == after["report_hash"]
    restored_document = second_client.get(
        f"/v1/documents/{first_response.json()['document_id']}"
    )
    assert restored_document.status_code == 200
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(AssetRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ReportRecord)) == 1


def test_bootstrap_concurrent_first_callers_return_creator_then_follower(tmp_path: Path) -> None:
    database = tmp_path / "bootstrap.db"
    engine = create_engine(
        f"sqlite+pysqlite:///{database}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    settings = Settings(
        app_env="test",
        database_url=str(database),
        storage_directory=tmp_path / "uploads",
        allow_insecure_demo_operator=True,
    )
    clients = [
        TestClient(create_app(settings=settings, session_factory=factory)),
        TestClient(create_app(settings=settings, session_factory=factory)),
    ]

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda client: client.post("/v1/demo/bootstrap"), clients))

    assert sorted(response.status_code for response in responses) == [200, 201]
    assert responses[0].json() == responses[1].json()


def test_bootstrap_rejects_corrupted_ready_report_without_replacing_it(
    tmp_path: Path,
) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    with factory.begin() as session:
        _simulate_legacy_ready_report_corruption(
            session,
            seeded["report_id"],
            evidence={"corrupted": True},
        )

    rejected = client.post("/v1/demo/bootstrap")

    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "DEMO_REPORT_INTEGRITY_CONFLICT"
    with factory() as session:
        stored = session.get(ReportRecord, seeded["report_id"])
        assert stored is not None
        assert stored.evidence == {"corrupted": True}


def test_contract_input_rejects_invalid_address_and_oversized_source(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    asset_id = client.post(
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
    ).json()["asset_id"]

    invalid_address = client.post(
        f"/v1/assets/{asset_id}/contracts",
        json={"address": "0x123", "chain_id": 1001, "is_synthetic": True},
    )
    oversized_source = client.post(
        f"/v1/assets/{asset_id}/contracts",
        json={"source_code": "x" * 200_001, "chain_id": 1001, "is_synthetic": True},
    )

    assert invalid_address.status_code == 422
    assert oversized_source.status_code == 422
    wrong_chain = client.post(
        f"/v1/assets/{asset_id}/contracts",
        json={"source_code": "contract X {}", "chain_id": 1, "is_synthetic": True},
    )
    assert wrong_chain.status_code == 422


def test_scan_requires_all_six_latest_controls_confirmed(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    with factory.begin() as session:
        policy = session.get(PolicyConstraintRecord, "control_oracle_max_age")
        assert policy is not None
        policy.confirmed = False

    blocked = client.post(
        f"/v1/assets/{seeded['asset_id']}/scans",
        json={"contract_id": seeded["contract_id"], "is_synthetic": True},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "CONTROL_REVIEW_REQUIRED"

    with factory.begin() as session:
        for policy in session.scalars(select(PolicyConstraintRecord)):
            policy.confirmed = True
    allowed = client.post(
        f"/v1/assets/{seeded['asset_id']}/scans",
        json={"contract_id": seeded["contract_id"], "is_synthetic": True},
    )
    assert allowed.status_code == 202


def test_document_content_returns_persisted_fixture(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    document_id = client.post("/v1/demo/bootstrap").json()["document_id"]

    response = client.get(f"/v1/documents/{document_id}/content")

    assert response.status_code == 200
    assert response.json()["media_type"] == "text/plain"
    assert "총 발행량은 100,000 토큰" in response.json()["text"]


def test_manual_policy_requires_verified_page_quote_and_server_builds_span(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    quote = "가격은 60분 이내에 갱신되어야 한다."
    payload = {
        "document_id": seeded["document_id"],
        "policies": [{
            "constraint_id": "manual_oracle",
            "field": "oracle_max_age",
            "value": 60,
            "unit": "MINUTE",
            "page": 1,
            "quote": quote,
            "confirmed": True,
            "expected_version": 0,
            "is_synthetic": True,
        }],
        "is_synthetic": True,
    }

    invalid = deepcopy(payload)
    invalid["policies"][0]["quote"] = "문서에 없는 인용문"
    invalid_response = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies", json=invalid
    )
    assert invalid_response.status_code == 422

    response = client.patch(f"/v1/assets/{seeded['asset_id']}/policies", json=payload)
    assert response.status_code == 200
    span = response.json()[0]["evidence_span"]
    assert span["page"] == 1
    assert span["quote"] == quote
    assert span["start"] > 0


def test_client_evidence_span_is_revalidated_against_stored_text(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    seeded = client.post("/v1/demo/bootstrap").json()
    stored_control = client.get(
        f"/v1/documents/{seeded['document_id']}"
    ).json()["controls"][0]
    manipulated_span = deepcopy(stored_control["evidence_span"])
    manipulated_span["start"] += 1
    manipulated_span["end"] += 1
    control = {
        "constraint_id": stored_control["constraint_id"],
        "field": stored_control["field"],
        "value": 999,
        "unit": stored_control["unit"],
        "evidence_span": manipulated_span,
        "confirmed": True,
        "expected_version": stored_control["version"],
        "is_synthetic": True,
    }

    response = client.patch(
        f"/v1/assets/{seeded['asset_id']}/policies",
        json={
            "document_id": seeded["document_id"],
            "policies": [control],
            "is_synthetic": True,
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EVIDENCE_SPAN_INVALID"


def test_manual_pdf_policy_uses_exact_requested_page_text(tmp_path: Path) -> None:
    client, _ = _client(tmp_path)
    asset_id = client.post(
        "/v1/assets",
        json={
            "name": "PDF asset",
            "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
            "underlying_description": "fixture",
            "total_planned_supply": 1,
            "network": "KAIA_KAIROS",
            "currency": "KRW",
            "token_unit": "TOKEN",
            "is_synthetic": True,
        },
    ).json()["asset_id"]
    pdf = fitz.open()
    page = pdf.new_page()
    quote = "Issuer role must approve minting."
    page.insert_text((72, 72), quote)
    payload = pdf.tobytes()
    pdf.close()
    document_id = client.post(
        f"/v1/assets/{asset_id}/documents",
        files={"file": ("terms.pdf", payload, "application/pdf")},
        data={"is_synthetic": "true"},
    ).json()["document_id"]

    response = client.patch(
        f"/v1/assets/{asset_id}/policies",
        json={
            "document_id": document_id,
            "policies": [{
                "constraint_id": "manual_issuer",
                "field": "issuer_role",
                "value": "ISSUER_ROLE",
                "page": 1,
                "quote": quote,
                "confirmed": True,
                "expected_version": 0,
                "is_synthetic": True,
            }],
            "is_synthetic": True,
        },
    )

    assert response.status_code == 200
    assert response.json()[0]["evidence_span"]["quote"] == quote


def test_rehashed_report_with_broken_nested_reference_is_rejected(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]
    with factory.begin() as session:
        stored = session.get(ReportRecord, report_id)
        assert stored is not None and stored.evidence is not None
        tampered = deepcopy(stored.evidence)
        tampered["mismatches"][0]["evidence_links"][0]["ref"] = "control_missing"
        snapshot = {key: value for key, value in tampered.items() if key != "report_hash"}
        canonical = json.dumps(
            snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        tampered["report_hash"] = f"sha256:{hashlib.sha256(canonical).hexdigest()}"
        _simulate_legacy_ready_report_corruption(
            session, report_id, evidence=tampered
        )

    response = client.get(f"/v1/reports/{report_id}")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REPORT_INTEGRITY_FAILED"


def test_rehashed_report_with_inconsistent_lineage_is_rejected(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]
    with factory.begin() as session:
        stored = session.get(ReportRecord, report_id)
        assert stored is not None and stored.evidence is not None
        tampered = deepcopy(stored.evidence)
        tampered["lineage"]["generated_at"] = "2030-01-01T00:00:00Z"
        tampered["lineage"]["rule_versions"]["MINT_COLLATERAL_CAP_MISSING"] = "evil"
        snapshot = {key: value for key, value in tampered.items() if key != "report_hash"}
        canonical = json.dumps(
            snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        tampered["report_hash"] = f"sha256:{hashlib.sha256(canonical).hexdigest()}"
        _simulate_legacy_ready_report_corruption(
            session, report_id, evidence=tampered
        )

    assert client.get(f"/v1/reports/{report_id}").status_code == 409


def test_report_rejects_ambiguous_ai_model_versions(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]
    with factory.begin() as session:
        stored = session.get(ReportRecord, report_id)
        assert stored is not None and stored.evidence is not None
        tampered = deepcopy(stored.evidence)
        tampered["lineage"]["ai_model"] = "model-a"
        tampered["lineage"]["model_versions"] = {"model-a": "1", "model-b": "2"}
        snapshot = {key: value for key, value in tampered.items() if key != "report_hash"}
        encoded = json.dumps(
            snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        tampered["report_hash"] = f"sha256:{hashlib.sha256(encoded).hexdigest()}"
        _simulate_legacy_ready_report_corruption(
            session,
            report_id,
            evidence=tampered,
            report_hash=tampered["report_hash"],
        )

    assert client.get(f"/v1/reports/{report_id}").status_code == 409


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("asset_id", "asset_other"),
        ("scan_id", "scan_other"),
        ("generated_at", datetime(2030, 1, 1, tzinfo=UTC)),
        ("report_hash", f"sha256:{'f' * 64}"),
    ],
)
def test_report_db_envelope_must_match_nested_snapshot(
    tmp_path: Path, field: str, value: object
) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]
    with factory.begin() as session:
        stored = session.get(ReportRecord, report_id)
        assert stored is not None
        if field == "asset_id":
            session.add(
                AssetRecord(
                    id="asset_other",
                    name="다른 합성 자산",
                    asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                    underlying_description="envelope mismatch fixture",
                    total_planned_supply=1,
                    network="KAIA_KAIROS",
                    currency="KRW",
                    token_unit="TOKEN",
                )
            )
            session.flush()
        elif field == "scan_id":
            session.add(
                ScanRunRecord(
                    id="scan_other",
                    asset_id=stored.asset_id,
                    status="COMPLETED",
                    input_hashes={},
                    rule_versions={},
                    failed_stages=[],
                    result_payload={},
                    started_at=datetime.now(UTC),
                    completed_at=datetime.now(UTC),
                )
            )
            session.flush()
        _simulate_legacy_ready_report_corruption(
            session, report_id, **{field: value}
        )

    assert client.get(f"/v1/reports/{report_id}").status_code == 409
    assert client.get(f"/v1/reports/{report_id}/download?format=json").status_code == 409


def test_bootstrap_rejects_valid_but_noncanonical_ready_report(tmp_path: Path) -> None:
    client, factory = _client(tmp_path)
    report_id = client.post("/v1/demo/bootstrap").json()["report_id"]
    with factory.begin() as session:
        stored = session.get(ReportRecord, report_id)
        assert stored is not None and stored.evidence is not None
        alternate = deepcopy(stored.evidence)
        alternate["lineage"]["limitations"].append("noncanonical but internally valid")
        snapshot = {key: value for key, value in alternate.items() if key != "report_hash"}
        encoded = json.dumps(
            snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode()
        alternate["report_hash"] = f"sha256:{hashlib.sha256(encoded).hexdigest()}"
        _simulate_legacy_ready_report_corruption(
            session,
            report_id,
            evidence=alternate,
            report_hash=alternate["report_hash"],
        )

    assert client.get(f"/v1/reports/{report_id}").status_code == 200
    rejected = client.post("/v1/demo/bootstrap")
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "DEMO_REPORT_CANONICAL_CONFLICT"
    preserved = client.get(f"/v1/reports/{report_id}").json()["report"]
    assert preserved["report_hash"] == alternate["report_hash"]
