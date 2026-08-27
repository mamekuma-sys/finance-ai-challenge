import json
from pathlib import Path
from typing import Any

import pytest

from rwa_guard.domain.contracts import FindingStatus
from rwa_guard.pipelines.contract import (
    CompiledSources,
    FoundryCompiler,
    RescanStatus,
    analyze_compiled_sources,
    compare_rescan,
)

REPOSITORY = Path(__file__).resolve().parents[3]
MANIFEST = Path(__file__).parent / "golden" / "contract_cases.json"
EXPECTED_RULES = {
    "MINT_ACCESS_CONTROL_MISSING": "CRITICAL",
    "MINT_COLLATERAL_CAP_MISSING": "CRITICAL",
    "ORACLE_VALIDATION_MISSING": "HIGH",
}


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def compiled_golden_sources() -> CompiledSources:
    paths = {
        case["path"]
        for rule in load_manifest()["rules"]
        for group in ("vulnerable", "safe")
        for case in rule[group]
    }
    sources = {path: (REPOSITORY / path).read_text(encoding="utf-8") for path in paths}
    return FoundryCompiler().compile(sources)


def test_golden_manifest_locks_three_vulnerable_and_safe_variants_per_rule() -> None:
    manifest = load_manifest()

    assert manifest["schema_version"] == "1.0.0"
    assert {rule["rule_id"]: rule["severity"] for rule in manifest["rules"]} == EXPECTED_RULES

    for rule in manifest["rules"]:
        assert rule["rule_version"] == "1.0.0"
        assert len(rule["vulnerable"]) >= 3
        assert len(rule["safe"]) >= 3
        assert len({case["contract"] for case in rule["vulnerable"]}) == len(rule["vulnerable"])
        assert len({case["contract"] for case in rule["safe"]}) == len(rule["safe"])


def test_golden_vulnerable_locations_match_original_source() -> None:
    for rule in load_manifest()["rules"]:
        for case in rule["vulnerable"]:
            source = REPOSITORY / case["path"]
            lines = source.read_text(encoding="utf-8").splitlines()

            assert source.is_file()
            assert case["excerpt_contains"] in lines[case["line"] - 1]
            assert case["missing_guards"]


def test_all_golden_sources_are_synthetic_fixtures() -> None:
    paths = {
        case["path"]
        for rule in load_manifest()["rules"]
        for group in ("vulnerable", "safe")
        for case in rule[group]
    }

    for relative_path in paths:
        source = (REPOSITORY / relative_path).read_text(encoding="utf-8")
        assert relative_path.startswith("chain/src/fixtures/")
        assert "Synthetic" in source


def test_ast_detector_matches_golden_vulnerable_and_safe_cases(
    compiled_golden_sources: CompiledSources,
) -> None:
    for rule in load_manifest()["rules"]:
        rule_id = rule["rule_id"]
        for case in rule["vulnerable"]:
            findings = _findings_for_rule(compiled_golden_sources, case["contract"], rule_id)

            assert findings
            finding = findings[0]
            assert finding.severity.value == rule["severity"]
            assert finding.status is FindingStatus.CONFIRMED
            assert finding.code_location.file == case["path"]
            assert finding.code_location.start_line == case["line"]
            assert case["excerpt_contains"] in finding.code_location.excerpt
            assert finding.source_hash.startswith("sha256:")
            assert finding.tool_versions["rule"] == rule["rule_version"]
            assert finding.tool_versions["solc"].startswith("0.8.24")
            for missing_guard in case["missing_guards"]:
                assert f"guard.{missing_guard}=missing" in finding.deterministic_evidence

        for case in rule["safe"]:
            assert not _findings_for_rule(compiled_golden_sources, case["contract"], rule_id)


def test_same_source_and_rule_version_produce_byte_equivalent_core_findings() -> None:
    path = "chain/src/fixtures/VulnerableRwaToken.sol"
    sources = {path: (REPOSITORY / path).read_text(encoding="utf-8")}
    first = analyze_compiled_sources(
        scan_id="scan_one",
        compiled=FoundryCompiler().compile(sources),
        target_contract="VulnerableRwaToken",
    )
    second = analyze_compiled_sources(
        scan_id="scan_two",
        compiled=FoundryCompiler().compile(sources),
        target_contract="VulnerableRwaToken",
    )

    first_bytes = json.dumps(
        [finding.model_dump(mode="json", exclude={"scan_id"}) for finding in first],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    second_bytes = json.dumps(
        [finding.model_dump(mode="json", exclude={"scan_id"}) for finding in second],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()

    assert first_bytes == second_bytes


def test_vulnerable_to_fixed_rescan_is_resolved(
    compiled_golden_sources: CompiledSources,
) -> None:
    token_before = analyze_compiled_sources(
        scan_id="scan_before_token",
        compiled=compiled_golden_sources,
        target_contract="VulnerableRwaToken",
    )
    token_after = analyze_compiled_sources(
        scan_id="scan_after_token",
        compiled=compiled_golden_sources,
        target_contract="FixedRwaToken",
    )
    oracle_before = analyze_compiled_sources(
        scan_id="scan_before_oracle",
        compiled=compiled_golden_sources,
        target_contract="VulnerableOracle",
    )
    oracle_after = analyze_compiled_sources(
        scan_id="scan_after_oracle",
        compiled=compiled_golden_sources,
        target_contract="FixedOracle",
    )

    assert {
        (result.rule_id, result.status) for result in compare_rescan(token_before, token_after)
    } == {
        ("MINT_ACCESS_CONTROL_MISSING", RescanStatus.RESOLVED),
        ("MINT_COLLATERAL_CAP_MISSING", RescanStatus.RESOLVED),
    }
    assert compare_rescan(oracle_before, oracle_after)[0].status is RescanStatus.RESOLVED


def _findings_for_rule(compiled: CompiledSources, contract: str, rule_id: str) -> list[Any]:
    return [
        finding
        for finding in analyze_compiled_sources(
            scan_id=f"scan_{contract}", compiled=compiled, target_contract=contract
        )
        if finding.rule_id == rule_id
    ]
