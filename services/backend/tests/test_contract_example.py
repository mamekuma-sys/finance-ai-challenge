import hashlib
import json
from pathlib import Path

from rwa_guard.domain.contracts import (
    AlertPatchRequest,
    AlertSummary,
    ContractCreateRequest,
    ContractCreateResponse,
    CreateAssetRequest,
    CreateAssetResponse,
    DashboardResponse,
    DocumentContentResponse,
    DocumentResponse,
    EvidenceKind,
    EvidenceMode,
    EvidenceReport,
    FindingDiff,
    FindingStatus,
    PolicyPatchRequest,
    ReportResponse,
    ScanCreateRequest,
    ScanCreateResponse,
)

REPOSITORY = Path(__file__).resolve().parents[3]
EXAMPLE = REPOSITORY / "contracts" / "examples" / "evidence-report.sample.json"
P0_WORKFLOW_EXAMPLE = REPOSITORY / "contracts" / "examples" / "p0-workflow.sample.json"
CONTRACT_SOURCE_ROOT = REPOSITORY


def _load() -> EvidenceReport:
    return EvidenceReport.model_validate_json(EXAMPLE.read_text(encoding="utf-8"))


def test_shared_example_matches_runtime_contract() -> None:
    report = _load()

    assert report.is_synthetic is True
    assert all(item.status is FindingStatus.CONFIRMED for item in report.code_findings)
    assert {item.rule_id for item in report.code_findings} == {
        "MINT_ACCESS_CONTROL_MISSING",
        "MINT_COLLATERAL_CAP_MISSING",
        "ORACLE_VALIDATION_MISSING",
    }
    assert report.exploit_risk is not None and report.exploit_risk.score == 100
    assert report.onchain_evidence[0].mode is EvidenceMode.REPLAY


def test_shared_example_report_hash_matches_snapshot() -> None:
    payload = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    report_hash = payload.pop("report_hash")
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()

    assert report_hash == f"sha256:{hashlib.sha256(canonical).hexdigest()}"


def test_mismatch_links_document_and_code() -> None:
    kinds = {link.kind for link in _load().mismatches[0].evidence_links}

    assert EvidenceKind.DOCUMENT in kinds
    assert EvidenceKind.CODE in kinds


def test_code_evidence_points_at_real_source_lines() -> None:
    """근거 없는 판정 금지 — 시드 데이터의 file/line이 실제 fixture와 일치해야 한다.

    이 테스트가 없어서 example·fixtures·web 세 곳이 존재하지 않는 23~25행을 가리키고 있었다.
    """

    for finding in _load().code_findings:
        location = finding.code_location
        source = CONTRACT_SOURCE_ROOT / location.file

        assert source.exists(), (
            f"code_location.file이 실제 소스를 가리키지 않는다: {location.file}"
        )

        lines = source.read_text(encoding="utf-8").splitlines()
        assert location.end_line <= len(lines), "end_line이 파일 길이를 넘는다"

        claimed = [line.strip() for line in location.excerpt.splitlines() if line.strip()]
        actual = [line.strip() for line in lines[location.start_line - 1 : location.end_line]]

        assert claimed == actual, "excerpt가 해당 라인의 실제 코드와 다르다"


def test_p0_workflow_requests_match_runtime_contracts() -> None:
    payload = json.loads(P0_WORKFLOW_EXAMPLE.read_text(encoding="utf-8"))

    assert CreateAssetRequest.model_validate(payload["create_asset"]).is_synthetic is True
    assert ContractCreateRequest.model_validate(payload["create_contract"]).source_code
    assert PolicyPatchRequest.model_validate(payload["patch_policies"]).policies[0].confirmed
    manual = PolicyPatchRequest.model_validate(payload["manual_patch_policies"]).policies[0]
    assert manual.evidence_span is None and manual.page == 1 and manual.quote
    assert ScanCreateRequest.model_validate(payload["create_scan"]).contract_id == "contract_01"
    assert (
        AlertPatchRequest.model_validate(payload["patch_alert"]).status.value == "INVESTIGATING"
    )
    assert CreateAssetResponse.model_validate(payload["asset_created"]).asset_id == "asset_01"
    assert DocumentResponse.model_validate(payload["document"]).document_id == "doc_01"
    assert DocumentContentResponse.model_validate(payload["document_content"]).text
    assert ContractCreateResponse.model_validate(payload["contract_created"]).source_hash
    assert ScanCreateResponse.model_validate(payload["scan_created"]).scan_id == "scan_01"
    assert (
        FindingDiff.model_validate(payload["finding_diff"]).rule_id
        == "MINT_COLLATERAL_CAP_MISSING"
    )
    assert AlertSummary.model_validate(payload["alert"]).evidence_mode is EvidenceMode.REPLAY
    dashboard = DashboardResponse.model_validate(payload["dashboard"])
    assert dashboard.total_assets == 1
    assert dashboard.assets[0].exploit_risk is not None
    assert dashboard.assets[0].exploit_risk.score == 100
    assert ReportResponse.model_validate(payload["report"]).human_review_required is True
