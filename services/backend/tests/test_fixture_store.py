from pathlib import Path
from shutil import copy2

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from rwa_guard.api.main import create_app
from rwa_guard.config import Settings
from rwa_guard.db.base import Base
from rwa_guard.fixture_store import (
    MANIFEST_PATH,
    REQUIRED_FIXTURE_FILES,
    FixtureUnavailable,
    fixture_store_for_settings,
)
from rwa_guard.fixtures import DOCUMENT_FILE

REPOSITORY = Path(__file__).resolve().parents[3]


def test_production_configured_missing_fixture_root_fails_closed(tmp_path: Path) -> None:
    settings = Settings(
        app_env="production",
        rwa_guard_fixture_root=tmp_path / "missing",
    )

    with pytest.raises(FixtureUnavailable, match="fixture root"):
        fixture_store_for_settings(settings)


def test_configured_fixture_root_requires_valid_hash_manifest() -> None:
    store = fixture_store_for_settings(
        Settings(app_env="production", rwa_guard_fixture_root=REPOSITORY)
    )

    assert "총 발행량" in store.read_text(DOCUMENT_FILE)


def test_text_fixture_hash_is_stable_across_platform_line_endings() -> None:
    attributes = (REPOSITORY / ".gitattributes").read_text(encoding="utf-8")
    document_bytes = (REPOSITORY / DOCUMENT_FILE).read_bytes()

    assert "data/synthetic/documents/*.txt text eol=lf" in attributes
    assert "chain/src/fixtures/*.sol text eol=lf" in attributes
    assert b"\r\n" not in document_bytes


def test_manifest_hash_treats_lf_and_crlf_as_same_text_fixture(tmp_path: Path) -> None:
    for relative in [MANIFEST_PATH, *REQUIRED_FIXTURE_FILES]:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy2(REPOSITORY / relative, destination)
        if destination.suffix in {".txt", ".sol"}:
            normalized = destination.read_bytes().replace(b"\r\n", b"\n").replace(b"\r", b"\n")
            destination.write_bytes(normalized.replace(b"\n", b"\r\n"))

    store = fixture_store_for_settings(
        Settings(app_env="production", rwa_guard_fixture_root=tmp_path)
    )

    assert "총 발행량" in store.read_text(DOCUMENT_FILE)


def test_configured_fixture_root_rejects_hash_mismatch(tmp_path: Path) -> None:
    for relative in [MANIFEST_PATH, *REQUIRED_FIXTURE_FILES]:
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy2(REPOSITORY / relative, destination)
    (tmp_path / DOCUMENT_FILE).write_text("tampered", encoding="utf-8")

    with pytest.raises(FixtureUnavailable, match="hash mismatch"):
        fixture_store_for_settings(
            Settings(app_env="production", rwa_guard_fixture_root=tmp_path)
        )


def test_bootstrap_returns_actionable_503_for_missing_fixture_root(tmp_path: Path) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, class_=Session)
    client = TestClient(
        create_app(
            settings=Settings(
                app_env="production",
                database_url="sqlite+pysqlite:///:memory:",
                operator_token="fixture-test-token",
                operator_id="fixture-test-operator",
                operator_access_code="Strong-Fixture-Test-Code-2026!",
                rwa_guard_fixture_root=tmp_path / "missing",
            ),
            session_factory=factory,
        )
    )

    response = client.post(
        "/v1/demo/bootstrap",
        headers={"Authorization": "Bearer fixture-test-token"},
    )
    readiness = client.get("/health/ready")
    health = client.get("/health")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "FIXTURE_UNAVAILABLE"
    assert "RWA_GUARD_FIXTURE_ROOT" in response.json()["error"]["message"]
    assert readiness.status_code == 503
    assert readiness.json()["error"]["code"] == "FIXTURE_UNAVAILABLE"
    assert health.json()["p0_ready"] is False
