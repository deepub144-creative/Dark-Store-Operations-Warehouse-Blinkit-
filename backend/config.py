"""Central configuration loaded from environment variables / .env with sensible defaults."""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env", override=False)
_PROCESS_SIGNING_SECRET = os.getenv("FILES_SIGNING_SECRET") or secrets.token_hex(24)


class Settings(BaseModel):
    app_name: str = "Audit-X Assistant API"
    app_env: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    root_dir: Path = ROOT_DIR
    db_path: Path = Field(
        default_factory=lambda: Path(os.getenv("AUDITX_DB_PATH", str(ROOT_DIR / "data" / "auditx.db")))
    )
    generated_dir: Path = Field(
        default_factory=lambda: Path(os.getenv("GENERATED_DIR", str(ROOT_DIR / "backend" / "generated")))
    )
    uploads_dir: Path = Field(
        default_factory=lambda: Path(os.getenv("UPLOADS_DIR", str(ROOT_DIR / "backend" / "uploads")))
    )

    llm_provider: str = Field(default_factory=lambda: os.getenv("LLM_PROVIDER", "auto"))
    anthropic_api_key: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = Field(default_factory=lambda: os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"))
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    gemini_model: str = Field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))
    openai_api_key: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_model: str = Field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    ollama_base_url: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = Field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "llama3.1:8b"))

    files_signing_secret: str = Field(
        default_factory=lambda: os.getenv("FILES_SIGNING_SECRET", _PROCESS_SIGNING_SECRET)
    )
    file_url_ttl_seconds: int = Field(
        default_factory=lambda: int(os.getenv("FILE_URL_TTL_SECONDS", "1800"))
    )
    rate_limit_per_minute: int = Field(
        default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_MINUTE", "90"))
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
            ).split(",")
            if origin.strip()
        ]
    )


def get_settings() -> Settings:
    settings = Settings()
    settings.generated_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
