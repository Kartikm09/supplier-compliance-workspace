"""Idempotent queue-processor behaviour tests."""

from __future__ import annotations

from threading import Event, Thread
from uuid import uuid4

import pytest

from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.idempotency import IdempotentJobProcessor
from supplier_compliance_api.models import JobMetadata


def test_replays_completed_job_without_rerunning_handler() -> None:
    processor = IdempotentJobProcessor()
    request = JobMetadata(job_id="job-one", correlation_id=uuid4())
    calls = 0

    def handler() -> str:
        nonlocal calls
        calls += 1
        return "completed"

    first = processor.execute(operation="test", job_id="job-one", request=request, handler=handler)
    second = processor.execute(operation="test", job_id="job-one", request=request, handler=handler)
    assert first.value == second.value == "completed"
    assert not first.replayed
    assert second.replayed
    assert calls == 1


def test_rejects_job_id_reuse_with_different_payload() -> None:
    processor = IdempotentJobProcessor()
    processor.execute(
        operation="test",
        job_id="job-one",
        request=JobMetadata(job_id="job-one", attempt=1),
        handler=lambda: "completed",
    )
    with pytest.raises(DomainError, match="different request") as error:
        processor.execute(
            operation="test",
            job_id="job-one",
            request=JobMetadata(job_id="job-one", attempt=2),
            handler=lambda: "never",
        )
    assert error.value.status_code == 409


def test_failed_job_is_not_cached() -> None:
    processor = IdempotentJobProcessor()
    request = JobMetadata(job_id="job-one")

    def fail() -> str:
        raise DomainError("temporary_failure", "Retry this job.")

    with pytest.raises(DomainError):
        processor.execute(operation="test", job_id="job-one", request=request, handler=fail)
    result = processor.execute(
        operation="test",
        job_id="job-one",
        request=request,
        handler=lambda: "recovered",
    )
    assert result.value == "recovered"
    assert not result.replayed


def test_completed_job_cache_is_bounded() -> None:
    processor = IdempotentJobProcessor(max_completed_jobs=1)
    first = JobMetadata(job_id="first")
    second = JobMetadata(job_id="second")
    processor.execute(operation="test", job_id="first", request=first, handler=lambda: "one")
    processor.execute(operation="test", job_id="second", request=second, handler=lambda: "two")
    replay = processor.execute(
        operation="test", job_id="first", request=first, handler=lambda: "new"
    )
    assert replay.value == "new"
    assert not replay.replayed


def test_duplicate_job_is_rejected_while_original_is_in_progress() -> None:
    processor = IdempotentJobProcessor()
    request = JobMetadata(job_id="in-flight")
    handler_started = Event()
    release_handler = Event()

    def slow_handler() -> str:
        handler_started.set()
        release_handler.wait(timeout=2)
        return "completed"

    worker = Thread(
        target=lambda: processor.execute(
            operation="test",
            job_id="in-flight",
            request=request,
            handler=slow_handler,
        )
    )
    worker.start()
    assert handler_started.wait(timeout=2)
    with pytest.raises(DomainError, match="already being processed") as error:
        processor.execute(
            operation="test",
            job_id="in-flight",
            request=request,
            handler=lambda: "duplicate",
        )
    assert error.value.code == "job_in_progress"
    release_handler.set()
    worker.join(timeout=2)
    assert not worker.is_alive()
