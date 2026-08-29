"""데모 부트스트랩이 저장하는 Solidity 소스가 실제로 컴파일되는지 검증한다.

두 fixture를 그대로 이어붙이던 시절, SPDX 헤더가 두 번 들어가 solc가 거부했고
핵심 결함 3종이 전부 UNKNOWN(판단 불가)으로 나왔다. 제출 데모의 첫 버튼이
`샘플 검증 시작`이므로 이 경로가 깨지면 제품이 아무것도 탐지하지 못한다.
"""

from pathlib import Path

import pytest

from rwa_guard.api.routes import merge_solidity_sources
from rwa_guard.domain.contracts import FindingStatus
from rwa_guard.pipelines.contract import (
    CompiledSources,
    FoundryCompiler,
    analyze_compiled_sources,
)

REPOSITORY = Path(__file__).resolve().parents[3]
DEMO_SOURCES = (
    "chain/src/fixtures/VulnerableRwaToken.sol",
    "chain/src/fixtures/VulnerableOracle.sol",
)
EXPECTED_RULES = {
    "MINT_ACCESS_CONTROL_MISSING",
    "MINT_COLLATERAL_CAP_MISSING",
    "ORACLE_VALIDATION_MISSING",
}


def _demo_source() -> str:
    return merge_solidity_sources(
        *((REPOSITORY / path).read_text(encoding="utf-8") for path in DEMO_SOURCES)
    )


def test_merge_keeps_one_spdx_header_and_one_pragma() -> None:
    merged = _demo_source()

    assert merged.count("SPDX-License-Identifier") == 1
    assert merged.count("pragma solidity") == 1


def test_merge_preserves_every_contract_declaration() -> None:
    merged = _demo_source()

    assert "contract VulnerableRwaToken" in merged
    assert "contract VulnerableOracle" in merged


def test_merge_of_a_single_source_is_unchanged_apart_from_trimming() -> None:
    single = (REPOSITORY / DEMO_SOURCES[0]).read_text(encoding="utf-8")

    assert merge_solidity_sources(single).strip() == single.strip()


def test_merge_without_sources_returns_empty() -> None:
    assert merge_solidity_sources() == ""


@pytest.fixture(scope="module")
def compiled_demo_source() -> CompiledSources:
    return FoundryCompiler().compile({"DemoVulnerable.sol": _demo_source()})


def test_demo_source_compiles(compiled_demo_source: CompiledSources) -> None:
    """이어붙인 소스가 solc를 통과해야 한다. 실패하면 룰이 전부 UNKNOWN이 된다."""

    assert compiled_demo_source.forge_version


def test_demo_scan_confirms_the_three_core_defects(
    compiled_demo_source: CompiledSources,
) -> None:
    findings = analyze_compiled_sources(
        scan_id="scan_demo_source_check", compiled=compiled_demo_source
    )

    by_rule = {finding.rule_id: finding for finding in findings}
    assert EXPECTED_RULES <= set(by_rule)
    for rule_id in EXPECTED_RULES:
        finding = by_rule[rule_id]
        assert finding.status is FindingStatus.CONFIRMED, (
            f"{rule_id}가 {finding.status.value}다. 컴파일 실패 시 UNKNOWN이 된다"
        )
        assert finding.code_location.start_line >= 1
