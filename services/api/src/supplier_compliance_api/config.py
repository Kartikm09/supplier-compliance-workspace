"""Typed environment-backed service configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

LOCAL_TOKEN = "local-development-token-change-me"


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime settings with conservative resource limits."""

    environment: str = "development"
    internal_api_token: str = field(default=LOCAL_TOKEN, repr=False)
    log_level: str = "INFO"
    max_request_bytes: int = 15 * 1024 * 1024
    max_document_bytes: int = 10 * 1024 * 1024
    max_pdf_pages: int = 100
    max_extracted_characters: int = 250_000
    max_csv_rows: int = 5_000
    max_csv_bytes: int = 1 * 1024 * 1024
    supabase_url: str = ""
    supabase_secret_key: str = field(default="", repr=False)

    @classmethod
    def from_environment(cls) -> Settings:
        """Load and validate settings without exposing secret values."""

        settings = cls(
            environment=os.getenv("APP_ENV", "development").strip().lower(),
            internal_api_token=os.getenv("INTERNAL_API_TOKEN", LOCAL_TOKEN),
            log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
            max_request_bytes=_positive_int("MAX_REQUEST_BYTES", 15 * 1024 * 1024),
            max_document_bytes=_positive_int("MAX_DOCUMENT_BYTES", 10 * 1024 * 1024),
            max_pdf_pages=_positive_int("MAX_PDF_PAGES", 100),
            max_extracted_characters=_positive_int(
                "MAX_EXTRACTED_CHARACTERS",
                250_000,
            ),
            max_csv_rows=_positive_int("MAX_CSV_ROWS", 5_000),
            max_csv_bytes=_positive_int("MAX_CSV_BYTES", 1 * 1024 * 1024),
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            supabase_secret_key=os.getenv("SUPABASE_SECRET_KEY", ""),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        """Reject weak production settings and inconsistent limits."""

        if len(self.internal_api_token) < 24:
            raise ValueError("INTERNAL_API_TOKEN must contain at least 24 characters.")
        if self.environment == "production" and self.internal_api_token == LOCAL_TOKEN:
            raise ValueError("The local development token cannot be used in production.")
        if self.log_level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL is not valid.")
        if self.max_document_bytes > self.max_request_bytes:
            raise ValueError("MAX_DOCUMENT_BYTES cannot exceed MAX_REQUEST_BYTES.")

    @property
    def supabase_configured(self) -> bool:
        """Return whether server-side Supabase integration is configured."""

        return self.supabase_url.startswith(("http://", "https://")) and bool(
            self.supabase_secret_key
        )


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error
    if value <= 0:
        raise ValueError(f"{name} must be positive.")
    return value
