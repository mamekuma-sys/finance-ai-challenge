"""항목 4 — 문서 통제조건 추출 평가셋.

PRD §10.4는 문서 필드 추출 최소 10케이스와 필수 필드 정확도 90% 이상을 요구한다.
`tests/golden/document_cases.json`이 케이스와 기대값을, `document-evaluation.json`이
측정 결과를 고정한다. 기대값은 명세에서 도출한 것이며 추출기 출력에서 역산하지 않는다.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from rwa_guard.pipelines.document import (
    DeterministicControlExtractor,
    DocumentPage,
    document_contains_suspicious_instructions,
    extract_document_pages,
)

REPOSITORY = Path(__file__).resolve().parents[3]
CASES = Path(__file__).parent / "golden" / "document_cases.json"
EVALUATION = Path(__file__).parent / "golden" / "document-evaluation.json"
MAX_BYTES = 1 << 20

P0_FIELD_ORDER = (
    "max_supply",
    "issuer_role",
    "collateral_verified",
    "oracle_max_age",
    "price_band_breach",
    "pauser_role",
)


def load_cases() -> dict[str, Any]:
    return json.loads(CASES.read_text(encoding="utf-8"))


def load_evaluation() -> dict[str, Any]:
    return json.loads(EVALUATION.read_text(encoding="utf-8"))


def _pages(path: str) -> tuple[DocumentPage, ...]:
    payload = (REPOSITORY / path).read_bytes()
    return extract_document_pages(payload, media_type="text/plain", max_bytes=MAX_BYTES)


def _extract(path: str) -> tuple[dict[str, Any], tuple[DocumentPage, ...]]:
    pages = _pages(path)
    controls = DeterministicControlExtractor().extract("asset_eval", "doc_eval", pages)
    return {item.field: item for item in controls}, pages


def _score() -> dict[str, Any]:
    """케이스 × 필수 필드마다 값 일치 여부를 센다. 미검출 기대는 미검출이어야 맞는다."""

    correct = 0
    total = 0
    misses: list[str] = []
    for case in load_cases()["cases"]:
        controls, _ = _extract(case["path"])
        for field in P0_FIELD_ORDER:
            total += 1
            expected = case["expected"][field]
            actual = controls.get(field)
            if expected is None:
                ok = actual is None
            else:
                ok = actual is not None and actual.value == expected["value"]
            if ok:
                correct += 1
            else:
                misses.append(f"{case['case_id']}.{field}")
    return {
        "total_field_outcomes": total,
        "correct": correct,
        "accuracy": round(correct / total, 4),
        "misses": misses,
    }


def test_manifest_locks_ten_cases_and_six_p0_fields() -> None:
    manifest = load_cases()

    assert manifest["schema_version"] == "1.0.0"
    assert manifest["is_synthetic"] is True
    assert tuple(manifest["fields"]) == P0_FIELD_ORDER
    assert len(manifest["cases"]) >= 10, "PRD §10.4는 최소 10케이스를 요구한다"
    assert len({case["case_id"] for case in manifest["cases"]}) == len(manifest["cases"])


def test_every_case_document_exists() -> None:
    for case in load_cases()["cases"]:
        assert (REPOSITORY / case["path"]).is_file(), case["path"]


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_case_matches_expected_fields(case: dict[str, Any]) -> None:
    controls, _ = _extract(case["path"])

    for field in P0_FIELD_ORDER:
        expected = case["expected"][field]
        actual = controls.get(field)
        if expected is None:
            assert actual is None, f"{case['case_id']}: {field}는 근거가 없으므로 만들면 안 된다"
        else:
            assert actual is not None, f"{case['case_id']}: {field}를 놓쳤다"
            assert actual.value == expected["value"]
            assert actual.unit == expected["unit"]


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_every_quote_exists_verbatim_in_the_source_page(case: dict[str, Any]) -> None:
    """환각 차단 — quote가 원문 해당 위치에 실제로 존재해야 한다. 100%가 기준이다."""

    controls, pages = _extract(case["path"])

    for field, control in controls.items():
        span = control.evidence_span
        page = pages[span.page - 1]
        assert page.text[span.start : span.end] == span.quote, (
            f"{case['case_id']}: {field}의 quote가 원문 위치와 다르다"
        )


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_suspicious_instruction_flag_matches_manifest(case: dict[str, Any]) -> None:
    pages = _pages(case["path"])

    assert document_contains_suspicious_instructions(pages) is case["suspicious_instructions"]


def test_recorded_accuracy_matches_the_executable_corpus() -> None:
    """기록된 수치가 실제 실행 결과와 같아야 한다. 기능명세서가 이 숫자를 인용한다."""

    evaluation = load_evaluation()
    measured = _score()

    assert evaluation["measured"]["total_field_outcomes"] == measured["total_field_outcomes"]
    assert evaluation["measured"]["correct"] == measured["correct"]
    assert evaluation["measured"]["accuracy"] == measured["accuracy"]
    assert evaluation["measured"]["misses"] == measured["misses"]


def test_accuracy_meets_the_prd_threshold() -> None:
    manifest = load_cases()
    measured = _score()

    assert measured["accuracy"] >= manifest["accuracy_threshold"], (
        f"PRD §10.4 기준 미달: {measured['accuracy']} < {manifest['accuracy_threshold']} "
        f"(놓친 판정: {measured['misses']})"
    )
