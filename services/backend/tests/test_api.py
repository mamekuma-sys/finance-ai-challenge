from pathlib import Path

from fastapi.testclient import TestClient

from rwa_guard.api.main import app, create_app, demo_evidence_report, health
from rwa_guard.config import Settings

REPOSITORY = Path(__file__).resolve().parents[3]


def test_health_reports_mutation_auth_not_ready_without_operator_configuration() -> None:
    response = health()

    assert response.p0_ready is False


def test_health_reports_ready_with_explicit_production_settings() -> None:
    client = TestClient(
        create_app(
            settings=Settings(
                app_env="production",
                operator_token="explicit-health-token",
                operator_id="explicit-health-operator",
                operator_access_code="Explicit-Health-Access-Code-2026!",
                allow_insecure_demo_operator=False,
                rwa_guard_fixture_root=REPOSITORY,
            )
        )
    )

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["p0_ready"] is True


def test_demo_report_is_synthetic_and_replay() -> None:
    payload = demo_evidence_report(Settings(app_env="test")).model_dump(mode="json")

    assert payload["is_synthetic"] is True
    assert payload["onchain_evidence"][0]["mode"] == "REPLAY"
    assert payload["mismatches"][0]["evidence_links"] == [
        {"kind": "DOCUMENT", "ref": "control_max_supply"},
        {"kind": "CODE", "ref": "finding_mint_collateral_cap_missing"},
        {
            "kind": "CHAIN",
            "ref": "0x0000000000000000000000000000000000000000000000000000000000000001:0",
        },
    ]


def test_openapi_exposes_p0_routes() -> None:
    paths = app.openapi()["paths"]

    assert "/health" in paths
    assert "/v1/demo/evidence-report" in paths
