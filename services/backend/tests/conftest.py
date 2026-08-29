from collections.abc import Iterator
from pathlib import Path

import pytest

from rwa_guard.config import get_settings

RUNTIME_SETTINGS_ENV = (
    "APP_ENV",
    "OPERATOR_TOKEN",
    "OPERATOR_ID",
    "OPERATOR_ACCESS_CODE",
    "ALLOW_INSECURE_DEMO_OPERATOR",
    "RWA_GUARD_FIXTURE_ROOT",
)
REPOSITORY = Path(__file__).resolve().parents[3]


@pytest.fixture(autouse=True)
def isolate_runtime_settings_env(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    get_settings.cache_clear()
    for name in RUNTIME_SETTINGS_ENV:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("OPERATOR_TOKEN", "")
    monkeypatch.setenv("OPERATOR_ID", "")
    monkeypatch.setenv("OPERATOR_ACCESS_CODE", "")
    monkeypatch.setenv("ALLOW_INSECURE_DEMO_OPERATOR", "false")
    monkeypatch.setenv("RWA_GUARD_FIXTURE_ROOT", str(REPOSITORY))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
