"""Recursive redaction helpers for logs and diagnostic metadata."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

SENSITIVE_KEY = re.compile(
    r"(authorization|cookie|password|secret|token|api[_-]?key|document[_-]?text|content[_-]?base64)",
    re.IGNORECASE,
)
BEARER_VALUE = re.compile(r"(?i)\bbearer\s+[a-z0-9._~+/=-]+")
KEY_VALUE = re.compile(r"(?i)\b(password|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;]+")
REDACTED = "[REDACTED]"


def redact(value: Any, *, known_secrets: Sequence[str] = ()) -> Any:
    """Return a JSON-compatible structure with sensitive values removed."""

    if isinstance(value, Mapping):
        return {
            str(key): (
                REDACTED
                if SENSITIVE_KEY.search(str(key))
                else redact(item, known_secrets=known_secrets)
            )
            for key, item in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [redact(item, known_secrets=known_secrets) for item in value]
    if isinstance(value, str):
        return redact_text(value, known_secrets=known_secrets)
    return value


def redact_text(value: str, *, known_secrets: Sequence[str] = ()) -> str:
    """Redact credentials from an unstructured string."""

    redacted = BEARER_VALUE.sub(f"Bearer {REDACTED}", value)
    redacted = KEY_VALUE.sub(lambda match: f"{match.group(1)}={REDACTED}", redacted)
    for secret in known_secrets:
        if secret:
            redacted = redacted.replace(secret, REDACTED)
    return redacted
