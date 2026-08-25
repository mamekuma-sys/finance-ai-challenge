from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/rwa_guard"
    public_web_origin: str = "http://localhost:3000"
    anthropic_api_key: str | None = None
    kaia_rpc_url: str | None = None
    kaia_fallback_rpc_url: str | None = None
    kaia_chain_id: int = 1001

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
