from pathlib import Path

from rwa_guard.domain.contracts import EvidenceMode, EvidenceReport, FindingStatus


def test_shared_example_matches_runtime_contract() -> None:
    repository = Path(__file__).resolve().parents[3]
    example = repository / "contracts" / "examples" / "evidence-report.sample.json"

    report = EvidenceReport.model_validate_json(example.read_text(encoding="utf-8"))

    assert report.is_synthetic is True
    assert report.code_findings[0].status is FindingStatus.CONFIRMED
    assert report.onchain_evidence[0].mode is EvidenceMode.REPLAY
