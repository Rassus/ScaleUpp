from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Render entrega postgres://; SQLAlchemy/psycopg2 necesitan postgresql+psycopg2://."""
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql+psycopg2://" + u[len("postgres://") :]
    elif u.startswith("postgresql://") and "+psycopg2" not in u:
        u = "postgresql+psycopg2://" + u[len("postgresql://") :]
    return u


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

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_url(cls, v: object) -> object:
        if isinstance(v, str) and v:
            return normalize_database_url(v)
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
