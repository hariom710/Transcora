from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven config. No secrets live in source (SECURITY.md §J)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:3000"
    request_timeout_seconds: float = 15.0
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60
    max_body_bytes: int = 16_384

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
