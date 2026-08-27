import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import pytest

from rwa_guard.domain.contracts import CodeFinding, FindingStatus
from rwa_guard.pipelines.contract import (
    CompiledSources,
    FoundryCompiler,
    analyze_compiled_sources,
    analyze_contract_sources,
)

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
        assert {finding.status.value for finding in findings} == {case["expected"]}
        assert findings[0].code_location.file == case["path"]
        assert findings[0].code_location.start_line == case["line"]
        assert findings[0].code_location.excerpt
        assert findings[0].finding_id.startswith("finding_")
        assert findings[0].tool_versions["rule"] == "1.0.0"
        assert findings[0].tool_versions["rwa_guard_contract"] == "1.2.0"
        if case["expected"] == "NEEDS_REVIEW":
            assert any(
                evidence.startswith("unsupported=")
                for evidence in findings[0].deterministic_evidence
            )


def test_adversarial_results_are_byte_equivalent_across_repeated_analysis(
    adversarial_compiled: CompiledSources,
) -> None:
    contracts = sorted({case["contract"] for case in _read(ADVERSARIAL)["cases"]})

    for contract in contracts:
        first = analyze_compiled_sources(
            scan_id="scan_first", compiled=adversarial_compiled, target_contract=contract
        )
        second = analyze_compiled_sources(
            scan_id="scan_second", compiled=adversarial_compiled, target_contract=contract
        )

        assert _core_finding_bytes(first) == _core_finding_bytes(second)


def test_overloaded_entrypoints_have_distinct_stable_ids_and_signature_order(
    adversarial_compiled: CompiledSources,
) -> None:
    findings = analyze_compiled_sources(
        scan_id="scan_overloads",
        compiled=adversarial_compiled,
        target_contract="OverloadedMintEntrypoints",
    )

    for rule_id in ("MINT_ACCESS_CONTROL_MISSING", "MINT_COLLATERAL_CAP_MISSING"):
        rule_findings = [finding for finding in findings if finding.rule_id == rule_id]
        entrypoints = [
            next(
                item.removeprefix("entrypoint=")
                for item in finding.deterministic_evidence
                if item.startswith("entrypoint=")
            )
            for finding in rule_findings
        ]
        assert entrypoints == [
            "OverloadedMintEntrypoints.mint(address,uint256)",
            "OverloadedMintEntrypoints.mint(uint256)",
        ]
        assert len({finding.finding_id for finding in rule_findings}) == 2


def test_compile_failure_unknown_is_byte_equivalent() -> None:
    sources = {"Broken.sol": "pragma solidity ^0.8.24; contract Broken {"}

    first = analyze_contract_sources(scan_id="scan_first", sources=sources)
    second = analyze_contract_sources(scan_id="scan_second", sources=sources)

    assert {finding.status for finding in first} == {FindingStatus.UNKNOWN}
    assert _core_finding_bytes(first) == _core_finding_bytes(second)


def test_missing_ast_is_unknown_instead_of_silent_safe() -> None:
    compiled = CompiledSources(
        sources={"src/Empty.sol": "pragma solidity ^0.8.24;"},
        asts=(),
        compiler_version="0.8.24",
        forge_version="synthetic",
        original_path_by_compiler_path={"src/Empty.sol": "Empty.sol"},
    )

    findings = analyze_compiled_sources(scan_id="scan_empty_ast", compiled=compiled)

    assert len(findings) == 3
    assert {finding.status for finding in findings} == {FindingStatus.UNKNOWN}
    assert all(finding.code_location.file == "Empty.sol" for finding in findings)


def test_all_adversarial_sources_are_declared_synthetic() -> None:
    for path in {case["path"] for case in _read(ADVERSARIAL)["cases"]}:
        source = (REPOSITORY / path).read_text(encoding="utf-8")

        assert path.startswith("chain/src/fixtures/")
        assert "Synthetic" in source


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


def _core_finding_bytes(findings: tuple[CodeFinding, ...]) -> bytes:
    payload = [finding.model_dump(mode="json", exclude={"scan_id"}) for finding in findings]
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
