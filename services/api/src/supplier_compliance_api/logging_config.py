"""Structured logging that intentionally excludes request payloads."""

from __future__ import annotations

import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from supplier_compliance_api.redaction import redact, redact_text

correlation_id_context: ContextVar[str] = ContextVar("correlation_id", default="")


class RedactedJsonFormatter(logging.Formatter):
    """Format log records as compact JSON with credential redaction."""

    def __init__(self, *, known_secrets: tuple[str, ...] = ()) -> None:
        super().__init__()
        self.known_secrets = known_secrets

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(tz=UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "event": redact_text(record.getMessage(), known_secrets=self.known_secrets),
            "correlation_id": correlation_id_context.get(),
        }
        safe_context = getattr(record, "safe_context", None)
        if safe_context is not None:
            payload["context"] = redact(safe_context, known_secrets=self.known_secrets)
        if record.exc_info and record.exc_info[0] is not None:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def configure_logging(level: str, *, known_secrets: tuple[str, ...] = ()) -> None:
    """Configure the root logger for server operation."""

    handler = logging.StreamHandler()
    handler.setFormatter(RedactedJsonFormatter(known_secrets=known_secrets))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
