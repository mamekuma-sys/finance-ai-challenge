from rwa_guard.api.main import app, demo_evidence_report, health


def test_health_does_not_require_p1_chain() -> None:
    response = health()

    assert response.p0_ready is True


def test_demo_report_is_synthetic_and_replay() -> None:
    payload = demo_evidence_report().model_dump(mode="json")

    assert payload["is_synthetic"] is True
    assert payload["onchain_evidence"][0]["mode"] == "REPLAY"
    assert payload["mismatches"][0]["evidence_links"] == [
        "control_max_supply",
        "finding_mint_cap_missing",
    ]


def test_openapi_exposes_p0_routes() -> None:
    paths = app.openapi()["paths"]

    assert "/health" in paths
    assert "/v1/demo/evidence-report" in paths
