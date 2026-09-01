"""항목 4 — 문서 통제조건 추출 평가셋.

PRD §10.4는 문서 필드 추출 최소 10케이스와 필수 필드 정확도 90% 이상을 요구한다.
`tests/golden/document_cases.json`이 케이스와 기대값을, `document-evaluation.json`이
측정 결과를 고정한다. 이 평가는 합성 TXT 결정론적 P0 6필드만 다루며 AI, PDF,
실데이터는 제외한다. 기대값은 명세에서 도출했고 추출기 출력에서 역산하지 않는다.
"""

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from rwa_guard.domain.contracts import ControlSpec, EvidenceSpan
from rwa_guard.pipelines.document import (
    P0_FIELDS,
    DocumentControlExtraction,
    DocumentExtractionError,
    DocumentPage,
    document_contains_suspicious_instructions,
    extract_controls,
    extract_document_pages,
)

REPOSITORY = Path(__file__).resolve().parents[3]
CASES = Path(__file__).parent / "golden" / "document_cases.json"
EVALUATION = Path(__file__).parent / "golden" / "document-evaluation.json"
OPENAPI = REPOSITORY / "contracts" / "generated" / "openapi.json"
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


def _extract(path: str) -> tuple[DocumentControlExtraction, tuple[DocumentPage, ...]]:
    pages = _pages(path)
    extraction = extract_controls(
        asset_id="asset_eval",
        document_id="doc_eval",
        pages=pages,
        mode="deterministic",
    )
    return extraction, pages


def _controls_by_field(extraction: DocumentControlExtraction) -> dict[str, ControlSpec]:
    return {item.field: item for item in extraction.controls}


def _score() -> dict[str, Any]:
    """케이스 × 필수 필드마다 값 일치 여부를 센다. 미검출 기대는 미검출이어야 맞는다."""

    correct = 0
    total = 0
    misses: list[str] = []
    for case in load_cases()["cases"]:
        extraction, _ = _extract(case["path"])
        controls = _controls_by_field(extraction)
        for field in P0_FIELD_ORDER:
            total += 1
            expected = case["expected"][field]
            actual = controls.get(field)
            if expected is None:
                ok = actual is None
            else:
                ok = (
                    actual is not None
                    and actual.value == expected["value"]
                    and actual.unit == expected["unit"]
                )
            if ok:
                correct += 1
            else:
                misses.append(f"{case['case_id']}.{field}")
    return {
        "total_field_outcomes": total,
        "correct": correct,
        "exact_match_rate": round(correct / total, 4),
        "misses": misses,
    }


def test_manifest_locks_ten_cases_and_six_p0_fields() -> None:
    manifest = load_cases()

    assert manifest["schema_version"] == "1.0.0"
    assert manifest["is_synthetic"] is True
    assert manifest["measurement_scope"] == "synthetic_txt_deterministic_p0_six_fields"
    assert tuple(manifest["fields"]) == P0_FIELD_ORDER
    assert set(manifest["fields"]) == P0_FIELDS
    assert len(manifest["cases"]) >= 10, "PRD §10.4는 최소 10케이스를 요구한다"
    assert len({case["case_id"] for case in manifest["cases"]}) == len(manifest["cases"])


def test_every_case_document_exists() -> None:
    for case in load_cases()["cases"]:
        assert (REPOSITORY / case["path"]).is_file(), case["path"]


def test_every_case_hash_is_locked_after_lf_normalization() -> None:
    for case in load_cases()["cases"]:
        payload = (REPOSITORY / case["path"]).read_text(encoding="utf-8")
        normalized = payload.replace("\r\n", "\n").replace("\r", "\n").encode()
        digest = f"sha256:{hashlib.sha256(normalized).hexdigest()}"

        assert case["sha256_lf"] == digest, case["path"]


def test_every_case_is_explicitly_synthetic() -> None:
    for case in load_cases()["cases"]:
        text = (REPOSITORY / case["path"]).read_text(encoding="utf-8")

        assert "is_synthetic=true" in text, case["path"]


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_case_matches_expected_fields(case: dict[str, Any]) -> None:
    extraction, _ = _extract(case["path"])
    controls = _controls_by_field(extraction)

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
    """합성 TXT 결정론적 경로에서 반환된 모든 quote가 원문 위치와 같아야 한다."""

    extraction, pages = _extract(case["path"])

    for control in extraction.controls:
        span = control.evidence_span
        page = pages[span.page - 1]
        assert page.text[span.start : span.end] == span.quote, (
            f"{case['case_id']}: {control.field}의 quote가 원문 위치와 다르다"
        )


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_pipeline_provenance_and_taint_match_manifest(case: dict[str, Any]) -> None:
    extraction, pages = _extract(case["path"])

    assert document_contains_suspicious_instructions(pages) is case["suspicious_instructions"]
    assert extraction.extractor_kind == "DETERMINISTIC"
    assert extraction.extractor_version == "1.0.0"
    assert extraction.ai_model is None
    assert not any(control.confirmed for control in extraction.controls)
    if case["suspicious_instructions"]:
        assert "Suspicious document instructions require human review" in extraction.limitations


@pytest.mark.parametrize("case", load_cases()["cases"], ids=lambda case: str(case["case_id"]))
def test_pipeline_payload_matches_pydantic_and_openapi_contract(case: dict[str, Any]) -> None:
    extraction, _ = _extract(case["path"])
    openapi = json.loads(OPENAPI.read_text(encoding="utf-8"))
    schema = openapi["components"]["schemas"]["ControlSpec"]
    property_names = set(schema["properties"])
    required = set(schema["required"])

    for control in extraction.controls:
        payload = control.model_dump(mode="json")
        assert ControlSpec.model_validate(payload) == control
        assert set(payload) == property_names
        assert required <= payload.keys()
        assert payload["is_synthetic"] is True
        assert payload["confirmed"] is False


class _AIOnlyExtractor:
    name = "anthropic-structured-json"
    version = "test"
    model = "synthetic-ai"

    def extract(
        self, asset_id: str, document_id: str, _pages: tuple[DocumentPage, ...]
    ) -> list[ControlSpec]:
        quote = "Maximum issuance is 100000 tokens."
        return [
            ControlSpec(
                asset_id=asset_id,
                document_id=document_id,
                constraint_id="control_ai_only",
                field="max_supply",
                value=100000,
                unit="TOKEN",
                evidence_span=EvidenceSpan(
                    document_id=document_id,
                    page=1,
                    start=0,
                    end=len(quote),
                    quote=quote,
                ),
                confirmed=True,
            )
        ]


def test_ai_only_pipeline_forces_review_required_control() -> None:
    pages = extract_document_pages(
        b"Maximum issuance is 100000 tokens.",
        media_type="text/plain",
        max_bytes=MAX_BYTES,
    )

    extraction = extract_controls(
        asset_id="asset_eval",
        document_id="doc_eval",
        pages=pages,
        mode="anthropic",
        anthropic_extractor=_AIOnlyExtractor(),
    )

    assert extraction.extractor_kind == "ANTHROPIC"
    assert extraction.ai_model == "synthetic-ai"
    assert extraction.controls[0].confirmed is False


@pytest.mark.parametrize(
    ("payload", "media_type", "expected_code"),
    [
        (b"", "text/plain", "EMPTY_DOCUMENT"),
        (b"%PDF-not-text", "text/plain", "MAGIC_MISMATCH"),
        (b"not-a-pdf", "application/pdf", "MAGIC_MISMATCH"),
    ],
)
def test_pipeline_rejects_invalid_inputs(
    payload: bytes, media_type: str, expected_code: str
) -> None:
    with pytest.raises(DocumentExtractionError) as captured:
        extract_document_pages(payload, media_type=media_type, max_bytes=MAX_BYTES)

    assert captured.value.code == expected_code


def test_recorded_exact_match_rate_matches_the_executable_corpus() -> None:
    """기록 수치는 합성 TXT 결정론적 6필드 경로의 실행 결과만 나타낸다."""

    evaluation = load_evaluation()
    measured = _score()

    assert evaluation["measurement_scope"] == "synthetic_txt_deterministic_p0_six_fields"
    assert evaluation["excludes"] == [
        "anthropic_or_other_ai",
        "pdf",
        "real_or_competition_data",
    ]
    assert evaluation["measured"]["total_field_outcomes"] == measured["total_field_outcomes"]
    assert evaluation["measured"]["correct"] == measured["correct"]
    assert evaluation["measured"]["exact_match_rate"] == measured["exact_match_rate"]
    assert evaluation["measured"]["misses"] == measured["misses"]


def test_scoped_exact_match_rate_meets_the_configured_threshold() -> None:
    manifest = load_cases()
    measured = _score()

    assert measured["exact_match_rate"] >= manifest["exact_match_threshold"], (
        f"합성 TXT 결정론적 회귀 기준 미달: "
        f"{measured['exact_match_rate']} < {manifest['exact_match_threshold']} "
        f"(놓친 판정: {measured['misses']})"
    )
