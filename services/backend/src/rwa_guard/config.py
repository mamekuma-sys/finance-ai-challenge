import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/rwa_guard"
    public_web_origin: str = "http://localhost:3000"
    anthropic_api_key: str | None = None
    document_extractor: Literal["auto", "deterministic", "anthropic"] = "auto"
    anthropic_document_model: str = "claude-sonnet-4-20250514"
    kaia_rpc_url: str | None = None
    kaia_fallback_rpc_url: str | None = None
    kaia_chain_id: int = 1001
    storage_directory: Path = Path(".rwa-guard-storage")
    rwa_guard_fixture_root: Path | None = None
    max_upload_bytes: int = 10 * 1024 * 1024
    worker_name: str = "rwa-guard-worker"
    worker_poll_interval_seconds: float = 1.0
    worker_lock_timeout_seconds: int = 300
    worker_heartbeat_freshness_seconds: int = 30
    operator_token: str | None = None
    operator_id: str | None = None
    operator_access_code: str | None = None
    allow_insecure_demo_operator: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def is_strong_operator_access_code(value: str | None) -> bool:
    if value is None or len(value) < 20 or len(value) > 256:
        return False
    return all(
        re.search(pattern, value) is not None
        for pattern in (r"[A-Z]", r"[a-z]", r"[0-9]", r"[^A-Za-z0-9]")
    )
