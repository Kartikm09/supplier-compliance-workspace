"""Infrastructure ports implemented by Supabase-backed queue consumers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol
from uuid import UUID


class PrivateObjectStore(Protocol):
    """Private Storage operations required by the eventual queue worker."""

    def read_document(self, document_version_id: UUID) -> bytes:
        """Read one authorized private document version."""

    def write_report(
        self,
        assessment_id: UUID,
        content: bytes,
        *,
        sha256_hash: str,
        metadata: Mapping[str, str],
    ) -> str:
        """Persist a generated report and return its private object path."""


class DurableJobLedger(Protocol):
    """Durable idempotency contract for PGMQ consumers."""

    def claim(self, operation: str, job_id: str, request_digest: str) -> bool:
        """Atomically claim a job, returning false when already completed."""

    def complete(self, operation: str, job_id: str, result_digest: str) -> None:
        """Record successful completion before deleting the queue message."""

    def fail(self, operation: str, job_id: str, error_code: str) -> None:
        """Record a retryable attempt without leaking request data."""
