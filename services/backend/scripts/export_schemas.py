import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel

from rwa_guard.api.main import app
from rwa_guard.domain.contracts import (
    AssetSummary,
    CodeFinding,
    ControlSpec,
    EvidenceReport,
    FindingDiff,
    MismatchFinding,
    OnchainEvidence,
    ScanRun,
)

MODELS = {
    "control-spec": ControlSpec,
    "code-finding": CodeFinding,
    "onchain-evidence": OnchainEvidence,
    "mismatch-finding": MismatchFinding,
    "scan-run": ScanRun,
    "evidence-report": EvidenceReport,
    "asset-summary": AssetSummary,
    "finding-diff": FindingDiff,
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


def build_openapi() -> dict[str, Any]:
    catalog_app = FastAPI()
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
                model.model_json_schema(),
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


if __name__ == "__main__":
    main()
