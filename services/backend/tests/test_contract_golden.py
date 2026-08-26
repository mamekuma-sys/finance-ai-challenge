import json
from pathlib import Path
from typing import Any

REPOSITORY = Path(__file__).resolve().parents[3]
MANIFEST = Path(__file__).parent / "golden" / "contract_cases.json"
EXPECTED_RULES = {
    "MINT_ACCESS_CONTROL_MISSING": "CRITICAL",
    "MINT_COLLATERAL_CAP_MISSING": "CRITICAL",
    "ORACLE_VALIDATION_MISSING": "HIGH",
}


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_golden_manifest_locks_three_vulnerable_and_safe_variants_per_rule() -> None:
    manifest = load_manifest()

    assert manifest["schema_version"] == "1.0.0"
    assert {rule["rule_id"]: rule["severity"] for rule in manifest["rules"]} == EXPECTED_RULES

    for rule in manifest["rules"]:
        assert rule["rule_version"] == "1.0.0"
        assert len(rule["vulnerable"]) >= 3
        assert len(rule["safe"]) >= 3
        assert len({case["contract"] for case in rule["vulnerable"]}) == len(
            rule["vulnerable"]
        )
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
