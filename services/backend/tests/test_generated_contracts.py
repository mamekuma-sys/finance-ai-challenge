import json
from pathlib import Path

from scripts.export_schemas import build_openapi

REPOSITORY = Path(__file__).resolve().parents[3]
GENERATED_OPENAPI = REPOSITORY / "contracts" / "generated" / "openapi.json"
CONTRACT_VERSION = REPOSITORY / "contracts" / "VERSION"
SOURCE_SCHEMAS = REPOSITORY / "contracts" / "schemas"
GENERATED_SCHEMAS = REPOSITORY / "contracts" / "generated"


def test_generated_openapi_matches_pydantic_source() -> None:
    committed = json.loads(GENERATED_OPENAPI.read_text(encoding="utf-8"))

    assert committed == build_openapi()


def test_openapi_covers_shared_consumer_models_and_contract_version() -> None:
    schema = build_openapi()
    components = schema["components"]["schemas"]

    assert {
        "AlertPatchRequest",
        "AlertSummary",
        "AssetDetail",
        "AssetSummary",
        "ContractCreateRequest",
        "ContractCreateResponse",
        "CreateAssetRequest",
        "CreateAssetResponse",
        "DashboardResponse",
        "DocumentResponse",
        "DocumentContentResponse",
        "DemoBootstrapResponse",
        "EvidenceLink",
        "EvidenceReport",
        "FindingDiff",
        "MismatchFinding",
        "PolicyPatchRequest",
        "ReportDownloadMetadata",
        "ReportResponse",
        "ScanCreateRequest",
        "ScanCreateResponse",
        "ScanResultResponse",
        "ScanRun",
    } <= components.keys()
    assert schema["info"]["version"] == CONTRACT_VERSION.read_text(encoding="utf-8").strip()


def test_finding_diff_contract_fields_match_source_generated_and_openapi() -> None:
    required = {
        "rule_id",
        "base_rule_version",
        "head_rule_version",
    }
    source = json.loads((SOURCE_SCHEMAS / "finding-diff.schema.json").read_text())
    generated = json.loads((GENERATED_SCHEMAS / "finding-diff.schema.json").read_text())
    openapi = build_openapi()["components"]["schemas"]["FindingDiff"]

    for schema in (source, generated, openapi):
        assert required <= set(schema["properties"])
        assert required <= set(schema["required"])

    assert set(source["properties"]) == set(generated["properties"])
    assert set(source["required"]) == set(generated["required"])
    for field in ("base_rule_version", "head_rule_version"):
        assert {item["type"] for item in generated["properties"][field]["anyOf"]} == {
            "string",
            "null",
        }
        assert set(source["properties"][field]["type"]) == {"string", "null"}


def test_evidence_report_static_schema_matches_generated_requiredness() -> None:
    source = json.loads((SOURCE_SCHEMAS / "evidence-report.schema.json").read_text())
    generated = json.loads((GENERATED_SCHEMAS / "evidence-report.schema.json").read_text())
    generated_lineage = generated["$defs"]["ReportLineage"]
    source_lineage = source["properties"]["lineage"]

    assert set(source["properties"]) == set(generated["properties"])
    assert set(source["required"]) == set(generated["required"])
    assert set(source_lineage["properties"]) == set(generated_lineage["properties"])
    assert set(source_lineage["required"]) == set(generated_lineage["required"])
    assert source["properties"]["report_hash"]["pattern"] == generated["properties"][
        "report_hash"
    ]["pattern"]
    for field in ("controls", "code_findings", "mismatches", "onchain_evidence"):
        assert source["properties"][field]["type"] == generated["properties"][field]["type"]
    assert set(source_lineage["properties"]["ai_model"]["type"]) == {
        item["type"]
        for item in generated_lineage["properties"]["ai_model"]["anyOf"]
    }
