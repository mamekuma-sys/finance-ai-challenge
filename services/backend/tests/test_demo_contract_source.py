"""데모 부트스트랩이 저장하는 Solidity 소스가 실제로 컴파일되는지 검증한다.

두 fixture를 그대로 이어붙이던 시절, SPDX 헤더가 두 번 들어가 solc가 거부했고
핵심 결함 3종이 전부 UNKNOWN(판단 불가)으로 나왔다. 제출 데모의 첫 버튼이
`샘플 검증 시작`이므로 이 경로가 깨지면 제품이 아무것도 탐지하지 못한다.

fixture는 FixtureStore를 거쳐 읽는다. 라우터가 실제로 읽는 바이트와 다른 것을
검증하면 배포본이 깨져도 초록으로 남는다.
"""

import hashlib
import re
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.db.models import ContractRecord
from rwa_guard.domain.contracts import FindingStatus
from rwa_guard.fixture_store import fixture_store_for_settings
from rwa_guard.fixtures import merge_solidity_sources
from rwa_guard.pipelines.contract import (
    CompiledSources,
    FoundryCompiler,
    analyze_compiled_sources,
)

REPOSITORY = Path(__file__).resolve().parents[3]
TOKEN_FILE = "chain/src/fixtures/VulnerableRwaToken.sol"
ORACLE_FILE = "chain/src/fixtures/VulnerableOracle.sol"
EXPECTED_CONFIRMED = {
    "MINT_ACCESS_CONTROL_MISSING",
    "MINT_COLLATERAL_CAP_MISSING",
    "ORACLE_VALIDATION_MISSING",
}


def _demo_source() -> str:
    """라우터와 같은 경로로 fixture를 읽는다."""

    store = fixture_store_for_settings(
        Settings(app_env="test", rwa_guard_fixture_root=REPOSITORY)
    )
    return merge_solidity_sources(store.read_text(TOKEN_FILE), store.read_text(ORACLE_FILE))


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
