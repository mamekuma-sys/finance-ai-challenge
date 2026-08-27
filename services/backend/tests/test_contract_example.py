from pathlib import Path

from rwa_guard.domain.contracts import (
    EvidenceKind,
    EvidenceMode,
    EvidenceReport,
    FindingStatus,
)

REPOSITORY = Path(__file__).resolve().parents[3]
EXAMPLE = REPOSITORY / "contracts" / "examples" / "evidence-report.sample.json"
CONTRACT_SOURCE_ROOT = REPOSITORY


def _load() -> EvidenceReport:
    return EvidenceReport.model_validate_json(EXAMPLE.read_text(encoding="utf-8"))


def test_shared_example_matches_runtime_contract() -> None:
    report = _load()

    assert report.is_synthetic is True
    assert report.code_findings[0].status is FindingStatus.CONFIRMED
    assert report.code_findings[0].rule_id == "MINT_COLLATERAL_CAP_MISSING"
    assert report.onchain_evidence[0].mode is EvidenceMode.REPLAY


def test_mismatch_links_document_and_code() -> None:
    kinds = {link.kind for link in _load().mismatches[0].evidence_links}

    assert EvidenceKind.DOCUMENT in kinds
    assert EvidenceKind.CODE in kinds


def test_code_evidence_points_at_real_source_lines() -> None:
    """근거 없는 판정 금지 — 시드 데이터의 file/line이 실제 fixture와 일치해야 한다.

    이 테스트가 없어서 example·fixtures·web 세 곳이 존재하지 않는 23~25행을 가리키고 있었다.
    """

    location = _load().code_findings[0].code_location
    source = CONTRACT_SOURCE_ROOT / location.file

    assert source.exists(), f"code_location.file이 실제 소스를 가리키지 않는다: {location.file}"

    lines = source.read_text(encoding="utf-8").splitlines()
    assert location.end_line <= len(lines), "end_line이 파일 길이를 넘는다"

    claimed = [line.strip() for line in location.excerpt.splitlines() if line.strip()]
    actual = [line.strip() for line in lines[location.start_line - 1 : location.end_line]]

    assert claimed == actual, "excerpt가 해당 라인의 실제 코드와 다르다"
