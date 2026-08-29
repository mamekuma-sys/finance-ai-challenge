import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel

from rwa_guard.api.main import app
from rwa_guard.domain.contracts import (
    AlertPatchRequest,
    AlertSummary,
    AssetDetail,
    AssetSummary,
    CodeFinding,
    ContractCreateRequest,
    ContractCreateResponse,
    ControlSpec,
    CreateAssetRequest,
    CreateAssetResponse,
    DashboardResponse,
    DemoBootstrapResponse,
    DocumentContentResponse,
    DocumentResponse,
    EvidenceReport,
    ExploitRisk,
    FindingDiff,
    MismatchFinding,
    OnchainEvidence,
    PolicyPatchRequest,
    ReportDownloadMetadata,
    ReportResponse,
    ScanCreateRequest,
    ScanCreateResponse,
    ScanResultResponse,
    ScanRun,
)
from rwa_guard.fixtures import build_demo_report

MODELS = {
    "control-spec": ControlSpec,
    "code-finding": CodeFinding,
    "onchain-evidence": OnchainEvidence,
    "mismatch-finding": MismatchFinding,
    "scan-run": ScanRun,
    "evidence-report": EvidenceReport,
    "asset-summary": AssetSummary,
    "finding-diff": FindingDiff,
    "exploit-risk": ExploitRisk,
    "asset-detail": AssetDetail,
    "create-asset-request": CreateAssetRequest,
    "create-asset-response": CreateAssetResponse,
    "document-response": DocumentResponse,
    "document-content-response": DocumentContentResponse,
    "policy-patch-request": PolicyPatchRequest,
    "contract-create-request": ContractCreateRequest,
    "contract-create-response": ContractCreateResponse,
    "scan-create-request": ScanCreateRequest,
    "scan-create-response": ScanCreateResponse,
    "scan-result-response": ScanResultResponse,
    "dashboard-response": DashboardResponse,
    "demo-bootstrap-response": DemoBootstrapResponse,
    "alert-summary": AlertSummary,
    "alert-patch-request": AlertPatchRequest,
    "report-download-metadata": ReportDownloadMetadata,
    "report-response": ReportResponse,
}


class ContractCatalog(BaseModel):
    """Generation-only model that makes every shared contract visible to OpenAPI."""

    control_spec: ControlSpec
    code_finding: CodeFinding
    onchain_evidence: OnchainEvidence
    mismatch_finding: MismatchFinding
    scan_run: ScanRun
    evidence_report: EvidenceReport
    asset_summary: AssetSummary
    finding_diff: FindingDiff
    asset_detail: AssetDetail
    create_asset_request: CreateAssetRequest
    create_asset_response: CreateAssetResponse
    document_response: DocumentResponse
    document_content_response: DocumentContentResponse
    policy_patch_request: PolicyPatchRequest
    contract_create_request: ContractCreateRequest
    contract_create_response: ContractCreateResponse
    scan_create_request: ScanCreateRequest
    scan_create_response: ScanCreateResponse
    scan_result_response: ScanResultResponse
    dashboard_response: DashboardResponse
    demo_bootstrap_response: DemoBootstrapResponse
    alert_summary: AlertSummary
    alert_patch_request: AlertPatchRequest
    report_download_metadata: ReportDownloadMetadata
    report_response: ReportResponse


def build_openapi() -> dict[str, Any]:
    catalog_app = FastAPI(separate_input_output_schemas=False)
    catalog_app.add_api_route(
        "/__contract_catalog",
        lambda: None,
        response_model=ContractCatalog,
        methods=["GET"],
    )
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=[*app.routes, *catalog_app.routes],
        separate_input_output_schemas=False,
    )
    del schema["paths"]["/__contract_catalog"]
    del schema["components"]["schemas"]["ContractCatalog"]
    return schema


def main() -> None:
    repository = Path(__file__).resolve().parents[3]
    destination = repository / "contracts" / "generated"
    destination.mkdir(parents=True, exist_ok=True)
    for name, model in MODELS.items():
        path = destination / f"{name}.schema.json"
        path.write_text(
            json.dumps(
                model.model_json_schema(mode="validation"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

    (destination / "openapi.json").write_text(
        json.dumps(build_openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    generated_files = [f"{name}.schema.json" for name in MODELS] + ["openapi.json"]
    (destination / ".generated-files.json").write_text(
        json.dumps({"files": sorted(generated_files)}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (repository / "contracts" / "examples" / "evidence-report.sample.json").write_text(
        json.dumps(
            build_demo_report().model_dump(mode="json"),
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
