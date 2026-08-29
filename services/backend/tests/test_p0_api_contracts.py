from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from rwa_guard.domain import contracts


def test_p0_contract_catalog_is_complete() -> None:
    required = {
        "AlertPatchRequest",
        "AlertStatus",
        "AlertSummary",
        "AssetDetail",
        "ContractCreateRequest",
        "ContractCreateResponse",
        "CreateAssetRequest",
        "CreateAssetResponse",
        "DashboardResponse",
        "DocumentResponse",
        "DocumentStatus",
        "PolicyPatchRequest",
        "ReportDownloadMetadata",
        "ReportResponse",
        "ScanCreateRequest",
        "ScanCreateResponse",
        "ScanResultResponse",
    }

    assert required <= set(vars(contracts))


def test_create_asset_request_forbids_extra_fields_and_real_data() -> None:
    payload = {
        "name": "합성 한강 오피스 수익증권",
        "asset_type": "SYNTHETIC_COMMERCIAL_REAL_ESTATE_REVENUE",
        "underlying_description": "서울 소재 합성 상업용 부동산",
        "total_planned_supply": 100_000,
        "network": "KAIA_KAIROS",
        "currency": "KRW",
        "token_unit": "TOKEN",
        "is_synthetic": True,
    }
    request = contracts.CreateAssetRequest.model_validate(payload)

    assert request.is_synthetic is True
    with pytest.raises(ValidationError):
        contracts.CreateAssetRequest.model_validate({**payload, "unexpected": "field"})
    with pytest.raises(ValidationError):
        contracts.CreateAssetRequest.model_validate({**payload, "is_synthetic": False})


def test_partial_document_and_scan_results_preserve_failure_details() -> None:
    document = contracts.DocumentResponse(
        document_id="doc_01",
        asset_id="asset_01",
        status=contracts.DocumentStatus.PARTIAL,
        file_hash="sha256:document",
        version="1",
        media_type="application/pdf",
        size_bytes=2048,
        page_count=3,
        failed_pages=[2],
        uploaded_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    scan = contracts.ScanResultResponse(
        scan_run=contracts.ScanRun(
            scan_id="scan_01",
            asset_id="asset_01",
            status=contracts.ScanStatus.PARTIAL,
            input_hashes={"source": "sha256:source"},
            rule_versions={"ORACLE_VALIDATION_MISSING": "1.0.0"},
            failed_stages=[
                contracts.FailedStage(
                    stage="contract_analysis",
                    rule_id="ORACLE_VALIDATION_MISSING",
                    reason="tool timeout",
                )
            ],
            started_at=datetime(2026, 8, 28, tzinfo=UTC),
        )
    )

    assert document.failed_pages == [2]
    assert scan.scan_run.failed_stages[0].rule_id == "ORACLE_VALIDATION_MISSING"


def test_alert_patch_only_accepts_workflow_status_and_synthetic_note() -> None:
    patch = contracts.AlertPatchRequest(
        status=contracts.AlertStatus.INVESTIGATING,
        note="합성 Replay 사건을 확인 중입니다.",
        expected_updated_at=datetime(2026, 8, 28, tzinfo=UTC),
    )

    assert patch.status is contracts.AlertStatus.INVESTIGATING
    with pytest.raises(ValidationError):
        contracts.AlertPatchRequest(
            status="CLOSED",
            note="invalid",
            expected_updated_at=datetime(2026, 8, 28, tzinfo=UTC),
        )


def test_report_response_names_html_and_json_downloads() -> None:
    html = contracts.ReportDownloadMetadata(
        format=contracts.ReportFormat.HTML,
        media_type="text/html",
        url="/reports/report_01.html",
        sha256="sha256:html",
    )
    json_download = contracts.ReportDownloadMetadata(
        format=contracts.ReportFormat.JSON,
        media_type="application/json",
        url="/reports/report_01.json",
        sha256="sha256:json",
    )

    assert {item.format for item in (html, json_download)} == {
        contracts.ReportFormat.HTML,
        contracts.ReportFormat.JSON,
    }
    assert html.format.value == "html"
    assert json_download.format.value == "json"
