"""Safe domain errors exposed by the internal API."""

from __future__ import annotations

from typing import Any


class DomainError(Exception):
    """An expected processing failure with a stable public error code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 422,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
