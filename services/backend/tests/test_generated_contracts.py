import json
from pathlib import Path

from scripts.export_schemas import build_openapi

REPOSITORY = Path(__file__).resolve().parents[3]
GENERATED_OPENAPI = REPOSITORY / "contracts" / "generated" / "openapi.json"
CONTRACT_VERSION = REPOSITORY / "contracts" / "VERSION"


def test_generated_openapi_matches_pydantic_source() -> None:
    committed = json.loads(GENERATED_OPENAPI.read_text(encoding="utf-8"))

    assert committed == build_openapi()


def test_openapi_covers_shared_consumer_models_and_contract_version() -> None:
    schema = build_openapi()
    components = schema["components"]["schemas"]

    assert {
        "AssetSummary",
        "EvidenceLink",
        "EvidenceReport",
        "FindingDiff",
        "MismatchFinding",
        "ScanRun",
    } <= components.keys()
    assert schema["info"]["version"] == CONTRACT_VERSION.read_text(encoding="utf-8").strip()
