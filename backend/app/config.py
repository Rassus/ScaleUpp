from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ScaleUpp"
    app_env: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = (
        "postgresql+psycopg2://scaleupp:scaleupp@localhost:5433/scaleupp"
    )

    secret_key: str = "change-me-in-production-scaleupp-dev-secret"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
