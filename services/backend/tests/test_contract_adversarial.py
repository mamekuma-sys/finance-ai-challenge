import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest

from rwa_guard.domain.contracts import CodeFinding, FindingStatus
from rwa_guard.pipelines.contract import CompiledSources, FoundryCompiler, analyze_compiled_sources

REPOSITORY = Path(__file__).resolve().parents[3]
GOLDEN = Path(__file__).parent / "golden" / "contract_cases.json"
ADVERSARIAL = Path(__file__).parent / "golden" / "adversarial_cases.json"
EVALUATION = Path(__file__).parent / "golden" / "contract-evaluation.json"


def _read(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def adversarial_compiled() -> CompiledSources:
    paths = {case["path"] for case in _read(ADVERSARIAL)["cases"]}
    return FoundryCompiler().compile(
        {path: (REPOSITORY / path).read_text(encoding="utf-8") for path in paths}
    )


def test_adversarial_cases_separate_confirmed_safe_and_review(
    adversarial_compiled: CompiledSources,
) -> None:
    for case in _read(ADVERSARIAL)["cases"]:
        findings = _rule_findings(adversarial_compiled, case)

        if case["expected"] == "NONE":
            assert not findings
            continue
        assert findings
        assert findings[0].status.value == case["expected"]
        assert findings[0].code_location.start_line == case["line"]
        if case["expected"] == "NEEDS_REVIEW":
            assert any(
                evidence.startswith("unsupported=")
                for evidence in findings[0].deterministic_evidence
            )


def test_recorded_confusion_matrix_matches_executable_corpus(
    adversarial_compiled: CompiledSources,
) -> None:
    golden = _read(GOLDEN)
    recorded = _read(EVALUATION)
    expected_by_rule = {item["rule_id"]: item for item in recorded["rules"]}
    metrics: dict[str, dict[str, int]] = defaultdict(
        lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0, "needs_review": 0}
    )

    golden_paths = {
        case["path"]
        for rule in golden["rules"]
        for group in ("vulnerable", "safe")
        for case in rule[group]
    }
    golden_compiled = FoundryCompiler().compile(
        {path: (REPOSITORY / path).read_text(encoding="utf-8") for path in golden_paths}
    )
    for rule in golden["rules"]:
        rule_id = rule["rule_id"]
        for case in rule["vulnerable"]:
            _record_binary(metrics[rule_id], _has_confirmed(golden_compiled, case, rule_id), True)
        for case in rule["safe"]:
            _record_binary(metrics[rule_id], _has_confirmed(golden_compiled, case, rule_id), False)

    for case in _read(ADVERSARIAL)["cases"]:
        if case["expected"] == "NEEDS_REVIEW":
            metrics[case["rule_id"]]["needs_review"] += 1
            continue
        _record_binary(
            metrics[case["rule_id"]],
            _has_confirmed(adversarial_compiled, case, case["rule_id"]),
            case["expected"] == "CONFIRMED",
        )

    threshold = recorded["precision_recall_threshold"]
    for rule_id, counts in metrics.items():
        precision = counts["tp"] / (counts["tp"] + counts["fp"])
        recall = counts["tp"] / (counts["tp"] + counts["fn"])
        assert {**counts, "precision": precision, "recall": recall} == {
            key: value for key, value in expected_by_rule[rule_id].items() if key != "rule_id"
        }
        assert precision >= threshold
        assert recall >= threshold


def _rule_findings(compiled: CompiledSources, case: dict[str, Any]) -> list[CodeFinding]:
    return [
        finding
        for finding in analyze_compiled_sources(
            scan_id=f"scan_{case['contract']}",
            compiled=compiled,
            target_contract=case["contract"],
        )
        if finding.rule_id == case["rule_id"]
    ]


def _has_confirmed(compiled: CompiledSources, case: dict[str, Any], rule_id: str) -> bool:
    return any(
        finding.status is FindingStatus.CONFIRMED
        for finding in _rule_findings(compiled, {**case, "rule_id": rule_id})
    )


def _record_binary(counts: dict[str, int], predicted: bool, actual: bool) -> None:
    if predicted and actual:
        counts["tp"] += 1
    elif predicted:
        counts["fp"] += 1
    elif actual:
        counts["fn"] += 1
    else:
        counts["tn"] += 1
