"""Configuration and log-safety tests."""

from __future__ import annotations

import json
import logging

import pytest

from supplier_compliance_api.config import LOCAL_TOKEN, Settings
from supplier_compliance_api.logging_config import RedactedJsonFormatter
from supplier_compliance_api.redaction import REDACTED, redact, redact_text


def test_settings_reject_short_internal_token() -> None:
    with pytest.raises(ValueError, match="at least 24"):
        Settings(internal_api_token="short").validate()


def test_settings_reject_default_token_in_production() -> None:
    with pytest.raises(ValueError, match="local development token"):
        Settings(environment="production", internal_api_token=LOCAL_TOKEN).validate()


def test_settings_reject_invalid_log_level() -> None:
    with pytest.raises(ValueError, match="LOG_LEVEL"):
        Settings(log_level="LOUD").validate()


def test_settings_reject_document_limit_larger_than_request_limit() -> None:
    with pytest.raises(ValueError, match="MAX_DOCUMENT_BYTES"):
        Settings(max_request_bytes=100, max_document_bytes=101).validate()


def test_supabase_configured_requires_url_and_secret() -> None:
    assert not Settings(supabase_url="https://example.supabase.co").supabase_configured
    assert Settings(
        supabase_url="https://example.supabase.co",
        supabase_secret_key="server-only",
    ).supabase_configured


def test_recursive_redaction_removes_sensitive_keys_and_bearer_values() -> None:
    result = redact(
        {
            "token": "not-for-logs",
            "nested": {"Authorization": "Bearer abc.def"},
            "safe": "visible",
        }
    )
    assert result == {
        "token": REDACTED,
        "nested": {"Authorization": REDACTED},
        "safe": "visible",
    }


def test_text_redaction_removes_known_secret_and_key_value() -> None:
    value = redact_text(
        "token=abc123 request secret-value",
        known_secrets=("secret-value",),
    )
    assert "abc123" not in value
    assert "secret-value" not in value
    assert REDACTED in value


def test_json_formatter_never_emits_known_secret() -> None:
    formatter = RedactedJsonFormatter(known_secrets=("very-private-value",))
    record = logging.LogRecord(
        "test",
        logging.INFO,
        __file__,
        1,
        "processed %s",
        ("very-private-value",),
        None,
    )
    payload = json.loads(formatter.format(record))
    assert "very-private-value" not in json.dumps(payload)
    assert payload["event"] == f"processed {REDACTED}"
