"""데모 부트스트랩이 저장하는 Solidity 소스가 실제로 컴파일되는지 검증한다.

두 fixture를 그대로 이어붙이던 시절, SPDX 헤더가 두 번 들어가 solc가 거부했고
핵심 결함 3종이 전부 UNKNOWN(판단 불가)으로 나왔다. 제출 데모의 첫 버튼이
`샘플 검증 시작`이므로 이 경로가 깨지면 제품이 아무것도 탐지하지 못한다.

fixture는 FixtureStore를 거쳐 읽는다. 라우터가 실제로 읽는 바이트와 다른 것을
검증하면 배포본이 깨져도 초록으로 남는다.
"""

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.api.main import create_app
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import (
    AlertRecord,
    AssetRecord,
    ContractRecord,
    IssuanceDocumentRecord,
    PolicyConstraintRecord,
    ReportRecord,
    ScanRunRecord,
)
from rwa_guard.domain.contracts import FindingStatus
from rwa_guard.fixture_store import fixture_store_for_settings
from rwa_guard.fixtures import (
    build_demo_contract_source,
    merge_solidity_sources,
)
from rwa_guard.pipelines.contract import (
    CompiledSources,
    FoundryCompiler,
    analyze_compiled_sources,
)
from rwa_guard.worker import JobWorker
from rwa_guard.worker.__main__ import build_handler_registry

REPOSITORY = Path(__file__).resolve().parents[3]
TOKEN_FILE = "chain/src/fixtures/VulnerableRwaToken.sol"
ORACLE_FILE = "chain/src/fixtures/VulnerableOracle.sol"
EXPECTED_CONFIRMED = {
    "MINT_ACCESS_CONTROL_MISSING",
    "MINT_COLLATERAL_CAP_MISSING",
    "ORACLE_VALIDATION_MISSING",
}
LEGACY_REPORT = Path(__file__).parent / "fixtures/demo-report-0.1.0.json"
LEGACY_SOURCE = Path(__file__).parent / "fixtures/demo-contract-source-0.1.0.sol"
LEGACY_REPORT_HASH = (
    "sha256:933baaf7d6bbf92cfb46f67596b8421a4936667e6197e7c380d1b435d1253e5e"
)
LEGACY_SOURCE_HASH = (
    "sha256:d0e0d6a7ce03141af361c38a9429fcc08d88754f988e08bb13a600fbabced93f"
)


def _demo_source() -> str:
    """라우터와 같은 경로로 fixture를 읽는다."""

    store = fixture_store_for_settings(
        Settings(app_env="test", rwa_guard_fixture_root=REPOSITORY)
    )
    return build_demo_contract_source(store)


# --- 병합 규칙 -------------------------------------------------------------


def test_merge_keeps_exactly_one_spdx_header() -> None:
    assert _demo_source().count("SPDX-License-Identifier") == 1


def test_merge_preserves_every_version_pragma() -> None:
    """pragma는 지우지 않는다. 지우면 뒤 파일의 컴파일러 제약이 조용히 사라진다."""

    assert _demo_source().count("pragma solidity") == 2


def test_merge_preserves_every_contract_declaration() -> None:
    merged = _demo_source()

    assert "contract VulnerableRwaToken" in merged
    assert "contract VulnerableOracle" in merged


def test_merge_does_not_delete_code_around_a_pragma_mention() -> None:
    """이전 구현의 `[^;]*`가 줄바꿈을 삼켜 주석 뒤 코드를 통째로 지웠다."""

    first = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\ncontract A {}"
    second = (
        "// SPDX-License-Identifier: MIT\n"
        "pragma solidity ^0.8.24;\n"
        "/*\npragma solidity ^0.8.0 is required\n*/\n"
        "contract Oracle {\n    uint256 public x;\n}"
    )

    merged = merge_solidity_sources(first, second)

    assert "contract Oracle" in merged
    assert "uint256 public x" in merged


def test_merge_scrubs_spdx_from_the_first_source_too() -> None:
    """첫 소스만 예외로 두면 인자 순서가 바뀔 때 헤더가 둘이 된다."""

    merged = merge_solidity_sources(
        "// SPDX-License-Identifier: MIT\ncontract A {}",
        "// SPDX-License-Identifier: MIT\ncontract B {}",
    )

    assert merged.count("SPDX-License-Identifier") == 1


def test_merge_without_sources_returns_empty() -> None:
    assert merge_solidity_sources() == ""


def test_merge_of_only_empty_sources_returns_empty() -> None:
    assert merge_solidity_sources("", "   \n") == ""


# --- 컴파일과 판정 ---------------------------------------------------------


@pytest.fixture(scope="module")
def compiled_demo_source() -> CompiledSources:
    return FoundryCompiler().compile({"DemoVulnerable.sol": _demo_source()})


def test_demo_source_compiles_into_both_contract_asts(
    compiled_demo_source: CompiledSources,
) -> None:
    rendered = str(compiled_demo_source.asts)

    assert compiled_demo_source.asts, "AST가 비어 있으면 룰이 전부 UNKNOWN이 된다"
    assert "VulnerableRwaToken" in rendered
    assert "VulnerableOracle" in rendered


def test_demo_scan_confirms_exactly_the_three_core_defects(
    compiled_demo_source: CompiledSources,
) -> None:
    findings = analyze_compiled_sources(
        scan_id="scan_demo_source_check", compiled=compiled_demo_source
    )

    # dict로 접으면 중복 finding이 조용히 사라지므로 쌍의 집합으로 비교한다.
    observed = {(finding.rule_id, finding.status) for finding in findings}

    assert observed == {(rule, FindingStatus.CONFIRMED) for rule in EXPECTED_CONFIRMED}
    assert len(findings) == len(EXPECTED_CONFIRMED), "중복 finding이 있다"


# --- 엔드포인트가 저장하는 것 ----------------------------------------------


@pytest.fixture
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def test_bootstrap_stores_a_source_whose_hash_matches_it(
    tmp_path: Path, session_factory: sessionmaker[Session]
) -> None:
    """저장된 source_hash가 저장된 source_code를 실제로 설명해야 한다.

    소스를 병합하도록 바꾸면서 hash 계산을 함께 옮기지 않아, 한동안 저장된 hash가
    저장소 어디에도 없는 바이트를 가리켰다. DoD의 "입력 hash를 추적할 수 있다"가
    깨지는 상태였다.
    """

    from fastapi.testclient import TestClient

    from rwa_guard.api.main import create_app

    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        rwa_guard_fixture_root=REPOSITORY,
        allow_insecure_demo_operator=True,
    )
    client = TestClient(create_app(settings=settings, session_factory=session_factory))

    response = client.post("/v1/demo/bootstrap")
    assert response.status_code == 201, response.text

    with session_factory() as session:
        record = session.get(ContractRecord, response.json()["contract_id"])
        assert record is not None
        digest = hashlib.sha256(record.source_code.encode("utf-8")).hexdigest()
        assert record.source_hash == f"sha256:{digest}", (
            "저장된 source_hash가 저장된 source_code와 다르다"
        )
        assert record.source_code.count("SPDX-License-Identifier") == 1
        assert re.search(r"contract\s+VulnerableOracle", record.source_code)


def _legacy_report_payload() -> tuple[dict[str, object], str, str]:
    """Load the frozen origin/main 0.1.0 snapshot without current builders."""

    payload = json.loads(LEGACY_REPORT.read_text(encoding="utf-8"))
    legacy_source = LEGACY_SOURCE.read_text(encoding="utf-8")
    legacy_source_hash = f"sha256:{hashlib.sha256(legacy_source.encode()).hexdigest()}"
    snapshot = {key: value for key, value in payload.items() if key != "report_hash"}
    canonical = json.dumps(
        snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    calculated_report_hash = f"sha256:{hashlib.sha256(canonical).hexdigest()}"

    assert payload["report_hash"] == LEGACY_REPORT_HASH
    assert calculated_report_hash == LEGACY_REPORT_HASH
    assert legacy_source_hash == LEGACY_SOURCE_HASH
    assert payload["scan_run"]["input_hashes"]["contract_source"] == LEGACY_SOURCE_HASH
    assert payload["lineage"]["input_hashes"]["contract_source"] == LEGACY_SOURCE_HASH
    return payload, legacy_source, legacy_source_hash


def test_legacy_ready_report_survives_bootstrap_then_persisted_source_rescans(
    tmp_path: Path, session_factory: sessionmaker[Session]
) -> None:
    """옛 READY 스냅샷을 보존한 업그레이드에서도 실제 worker 분석이 완료돼야 한다."""

    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        storage_directory=tmp_path / "uploads",
        rwa_guard_fixture_root=REPOSITORY,
        allow_insecure_demo_operator=True,
    )
    client = TestClient(create_app(settings=settings, session_factory=session_factory))
    legacy, legacy_source, legacy_source_hash = _legacy_report_payload()
    legacy_report_hash = str(legacy["report_hash"])
    legacy_payload_bytes = json.dumps(
        legacy, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    fixture_store = fixture_store_for_settings(settings)
    document_path = fixture_store.path("data/synthetic/documents/issuance-terms-01.txt")
    document_bytes = document_path.read_bytes()
    legacy_scan = legacy["scan_run"]
    legacy_controls = legacy["controls"]
    legacy_mismatches = legacy["mismatches"]
    legacy_onchain = legacy["onchain_evidence"]
    started_at = datetime(2026, 8, 25, 3, 0, tzinfo=UTC)
    completed_at = datetime(2026, 8, 25, 3, 0, 8, tzinfo=UTC)
    with session_factory.begin() as session:
        session.add(
            AssetRecord(
                id="asset_synthetic_hanriver_01",
                name="합성 한강 오피스 수익증권",
                asset_type="SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
                status="REVIEW_REQUIRED",
                underlying_description="서울 소재 합성 상업용 부동산 수익증권 fixture",
                total_planned_supply=100_000,
                network="KAIA_KAIROS",
                currency="KRW",
                token_unit="TOKEN",
                created_at=started_at,
            )
        )
        session.flush()
        session.add(
            IssuanceDocumentRecord(
                id="doc_synthetic_issuance_01",
                asset_id="asset_synthetic_hanriver_01",
                file_hash=legacy_scan["input_hashes"]["document"],
                version="0.1.0",
                storage_path=str(document_path),
                status="READY",
                media_type="text/plain",
                size_bytes=len(document_bytes),
                page_count=1,
                failed_pages=[],
                extraction_metadata={
                    "fixture_version": "0.1.0",
                    "source": "data/synthetic",
                },
                uploaded_at=started_at,
                processed_at=completed_at,
            )
        )
        session.add(
            ContractRecord(
                id="contract_demo_vulnerable_01",
                asset_id="asset_synthetic_hanriver_01",
                chain_id=1001,
                source_kind="SOURCE",
                source_code=legacy_source,
                source_hash=legacy_source_hash,
                proxy_status="NOT_CHECKED",
                created_at=started_at,
            )
        )
        session.flush()
        for control in legacy_controls:
            session.add(
                PolicyConstraintRecord(
                    id=control["constraint_id"],
                    asset_id=control["asset_id"],
                    document_id=control["document_id"],
                    field_name=control["field"],
                    normalized_value={
                        "value": control["value"],
                        "unit": control["unit"],
                    },
                    evidence_span=control["evidence_span"],
                    confirmed=control["confirmed"],
                    version=control["version"],
                    created_at=started_at,
                    updated_at=started_at,
                )
            )
        session.add(
            ScanRunRecord(
                id="scan_demo_vulnerable_01",
                asset_id="asset_synthetic_hanriver_01",
                contract_id="contract_demo_vulnerable_01",
                status="COMPLETED",
                input_hashes=legacy_scan["input_hashes"],
                rule_versions=legacy_scan["rule_versions"],
                failed_stages=[],
                result_payload={
                    "code_findings": legacy["code_findings"],
                    "mismatches": legacy_mismatches,
                    "onchain_evidence": legacy_onchain,
                    "diff": [],
                },
                started_at=started_at,
                completed_at=completed_at,
            )
        )
        session.flush()
        session.add(
            ReportRecord(
                id="report_demo_01",
                asset_id="asset_synthetic_hanriver_01",
                scan_id="scan_demo_vulnerable_01",
                status="READY",
                evidence=legacy,
                report_hash=legacy_report_hash,
                downloads={},
                limitations=legacy["lineage"]["limitations"],
                generated_at=completed_at,
                created_at=started_at,
            )
        )
        lead = legacy_mismatches[0]
        session.add(
            AlertRecord(
                id="alert_demo_critical_01",
                asset_id="asset_synthetic_hanriver_01",
                alert_type="CRITICAL_CONTROL_MISMATCH",
                severity="CRITICAL",
                status="NEW",
                cause={"mismatch_id": lead["mismatch_id"]},
                evidence_links=lead["evidence_links"],
                dedupe_key="demo:0.1.0:mismatch_max_supply_01",
                evidence_mode="REPLAY",
                fixture_version="0.1.0",
                created_at=completed_at,
                updated_at=completed_at,
            )
        )

    bootstrap = client.post("/v1/demo/bootstrap")
    assert bootstrap.status_code == 200, bootstrap.text
    seeded = bootstrap.json()
    assert seeded["fixture_version"] == "0.2.0"
    assert seeded["document_id"] == "doc_synthetic_issuance_01"
    assert seeded["contract_id"] != "contract_demo_vulnerable_01"
    assert seeded["scan_id"] != "scan_demo_vulnerable_01"
    assert seeded["report_id"] != "report_demo_01"
    assert seeded["evidence_mode"] == "REPLAY"

    with session_factory() as session:
        old_report = session.get(ReportRecord, "report_demo_01")
        assert old_report is not None
        assert old_report.status == "READY"
        assert old_report.report_hash == legacy_report_hash
        assert old_report.evidence == legacy
        assert (
            json.dumps(
                old_report.evidence,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
            == legacy_payload_bytes
        )
        old_asset = session.get(AssetRecord, "asset_synthetic_hanriver_01")
        old_document = session.get(
            IssuanceDocumentRecord, "doc_synthetic_issuance_01"
        )
        old_contract = session.get(ContractRecord, "contract_demo_vulnerable_01")
        old_scan = session.get(ScanRunRecord, "scan_demo_vulnerable_01")
        old_alert = session.get(AlertRecord, "alert_demo_critical_01")
        assert old_asset is not None
        assert old_asset.underlying_description == (
            "서울 소재 합성 상업용 부동산 수익증권 fixture"
        )
        assert old_document is not None
        assert old_document.version == "0.1.0"
        assert old_document.extraction_metadata["fixture_version"] == "0.1.0"
        assert old_contract is not None
        assert old_contract.source_code == legacy_source
        assert old_contract.source_hash == LEGACY_SOURCE_HASH
        assert old_scan is not None
        assert old_scan.input_hashes == legacy_scan["input_hashes"]
        assert old_alert is not None
        assert old_alert.fixture_version == "0.1.0"
        assert old_alert.dedupe_key == "demo:0.1.0:mismatch_max_supply_01"
        old_control_ids = {
            control["constraint_id"] for control in legacy_controls
        }
        old_policies = list(
            session.scalars(
                select(PolicyConstraintRecord).where(
                    PolicyConstraintRecord.id.in_(old_control_ids)
                )
            )
        )
        assert len(old_policies) == 6
        assert all(
            policy.document_id == "doc_synthetic_issuance_01"
            for policy in old_policies
        )
        assert all(
            policy.updated_at.replace(tzinfo=UTC) == started_at
            for policy in old_policies
        )
        v2_report = session.get(ReportRecord, seeded["report_id"])
        assert v2_report is not None and v2_report.evidence is not None
        assert {
            control["document_id"] for control in v2_report.evidence["controls"]
        } == {"doc_synthetic_issuance_01"}
        assert {
            control["constraint_id"] for control in v2_report.evidence["controls"]
        } == old_control_ids
        assert (
            v2_report.evidence["lineage"]["input_hashes"]["document"]
            == old_document.file_hash
        )
        assert session.scalar(select(func.count()).select_from(AssetRecord)) == 1
        assert (
            session.scalar(select(func.count()).select_from(IssuanceDocumentRecord))
            == 1
        )
        assert session.scalar(select(func.count()).select_from(ContractRecord)) == 2
        assert session.scalar(select(func.count()).select_from(ScanRunRecord)) == 2
        assert session.scalar(select(func.count()).select_from(ReportRecord)) == 2
        assert session.scalar(select(func.count()).select_from(AlertRecord)) == 2
        assert (
            session.scalar(select(func.count()).select_from(PolicyConstraintRecord))
            == 6
        )
        contract = session.get(ContractRecord, seeded["contract_id"])
        assert contract is not None and contract.source_code is not None
        persisted_source = contract.source_code
        assert "derived compilation unit; not a canonical source file" in persisted_source

    document_content = client.get(
        f"/v1/documents/{seeded['document_id']}/content"
    )
    assert document_content.status_code == 200
    assert "document_id=doc_synthetic_issuance_01" in document_content.json()["text"]

    scan_response = client.post(
        f"/v1/assets/{seeded['asset_id']}/scans",
        json={
            "contract_id": seeded["contract_id"],
            "base_scan_id": None,
            "is_synthetic": True,
        },
    )
    assert scan_response.status_code == 202, scan_response.text
    assert JobWorker(
        session_factory,
        build_handler_registry(settings),
        "demo-source-regression",
    ).run_once()

    result = client.get(f"/v1/scans/{scan_response.json()['scan_id']}").json()
    worker_report = client.get(f"/v1/reports/{result['report_id']}").json()
    assert result["scan_run"]["status"] == "COMPLETED"
    assert worker_report["status"] == "READY"
    assert {
        (finding["rule_id"], finding["status"])
        for finding in result["code_findings"]
    } == {(rule, "CONFIRMED") for rule in EXPECTED_CONFIRMED}
    source_lines = persisted_source.splitlines()
    lineage_hashes = worker_report["report"]["lineage"]["input_hashes"].values()
    for finding in result["code_findings"]:
        location = finding["code_location"]
        assert location["file"] == "submitted.sol"
        assert location["excerpt"] == "\n".join(
            source_lines[location["start_line"] - 1 : location["end_line"]]
        )
        assert finding["source_hash"] in lineage_hashes
    assert worker_report["report"]["onchain_evidence"] == []
