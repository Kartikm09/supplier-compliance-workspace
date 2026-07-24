"""Small queue-oriented idempotency abstraction for local and test operation."""

from __future__ import annotations

import hashlib
import json
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from threading import Lock
from typing import Generic, TypeVar, cast

from pydantic import BaseModel

from supplier_compliance_api.errors import DomainError

ResultT = TypeVar("ResultT")


@dataclass(frozen=True, slots=True)
class ExecutionResult(Generic[ResultT]):
    """A processing result and whether it came from the idempotency cache."""

    value: ResultT
    replayed: bool


@dataclass(frozen=True, slots=True)
class _CompletedJob(Generic[ResultT]):
    request_digest: str
    result: ResultT


class IdempotentJobProcessor:
    """Thread-safe reference adapter for deterministic queue handlers.

    Production consumers should replace this bounded in-memory registry with a database-backed
    job ledger while retaining the same job key and request-digest checks.
    """

    def __init__(self, *, max_completed_jobs: int = 2_000) -> None:
        self._max_completed_jobs = max_completed_jobs
        self._completed: OrderedDict[str, _CompletedJob[object]] = OrderedDict()
        self._in_flight: dict[str, str] = {}
        self._lock = Lock()

    def execute(
        self,
        *,
        operation: str,
        job_id: str,
        request: BaseModel,
        handler: Callable[[], ResultT],
    ) -> ExecutionResult[ResultT]:
        """Run once for a job and reject reuse with a different payload."""

        key = f"{operation}:{job_id}"
        request_digest = _model_digest(request)
        with self._lock:
            existing = self._completed.get(key)
            if existing is not None:
                if existing.request_digest != request_digest:
                    raise DomainError(
                        "idempotency_conflict",
                        "The job ID was already used with a different request.",
                        status_code=409,
                    )
                self._completed.move_to_end(key)
                return ExecutionResult(value=cast(ResultT, existing.result), replayed=True)
            in_flight_digest = self._in_flight.get(key)
            if in_flight_digest is not None:
                if in_flight_digest != request_digest:
                    raise DomainError(
                        "idempotency_conflict",
                        "The job ID is in progress with a different request.",
                        status_code=409,
                    )
                raise DomainError(
                    "job_in_progress",
                    "The job is already being processed.",
                    status_code=409,
                )
            self._in_flight[key] = request_digest

        try:
            result = handler()
        except Exception:
            with self._lock:
                self._in_flight.pop(key, None)
            raise

        with self._lock:
            self._in_flight.pop(key, None)
            self._completed[key] = _CompletedJob(request_digest=request_digest, result=result)
            self._completed.move_to_end(key)
            while len(self._completed) > self._max_completed_jobs:
                self._completed.popitem(last=False)
            return ExecutionResult(value=result, replayed=False)


def _model_digest(model: BaseModel) -> str:
    serialized = json.dumps(
        model.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode()
    return hashlib.sha256(serialized).hexdigest()
