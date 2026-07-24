"""FastAPI entry point for supplier compliance processing."""

from __future__ import annotations

import hmac
import logging
import time
from typing import Annotated, Any, cast
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from supplier_compliance_api import __version__
from supplier_compliance_api.config import Settings
from supplier_compliance_api.documents import process_document
from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.idempotency import IdempotentJobProcessor
from supplier_compliance_api.imports import import_suppliers
from supplier_compliance_api.logging_config import (
    configure_logging,
    correlation_id_context,
)
from supplier_compliance_api.models import (
    GenerateAssessmentReportRequest,
    ImportSuppliersRequest,
    JobResponse,
    ProcessDocumentRequest,
    RecalculateRiskRequest,
)
from supplier_compliance_api.reporting import generate_assessment_report, report_digest
from supplier_compliance_api.risk import calculate_risk

LOGGER = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    *,
    job_processor: IdempotentJobProcessor | None = None,
) -> FastAPI:
    """Create an application with injectable settings and job state."""

    runtime_settings = settings or Settings.from_environment()
    runtime_settings.validate()
    configure_logging(
        runtime_settings.log_level,
        known_secrets=(
            runtime_settings.internal_api_token,
            runtime_settings.supabase_secret_key,
        ),
    )
    processor = job_processor or IdempotentJobProcessor()
    application = FastAPI(
        title="Supplier Compliance Workspace API",
        version=__version__,
        docs_url="/docs",
        redoc_url=None,
    )
    application.state.settings = runtime_settings
    application.state.job_processor = processor

    @application.middleware("http")
    async def request_context(request: Request, call_next: Any) -> Response:
        correlation_id = _correlation_id(request.headers.get("x-correlation-id"))
        token = correlation_id_context.set(correlation_id)
        started = time.monotonic()
        try:
            content_length = request.headers.get("content-length")
            if content_length is not None:
                try:
                    request_bytes = int(content_length)
                except ValueError:
                    return _error_response(
                        status_code=400,
                        code="invalid_content_length",
                        message="Content-Length must be an integer.",
                    )
                if request_bytes > runtime_settings.max_request_bytes:
                    return _error_response(
                        status_code=413,
                        code="request_too_large",
                        message="The request exceeds the configured size limit.",
                    )
            response = cast(Response, await call_next(request))
            response.headers["x-correlation-id"] = correlation_id
            LOGGER.info(
                "request_completed method=%s path=%s status=%s duration_ms=%s",
                request.method,
                request.url.path,
                response.status_code,
                round((time.monotonic() - started) * 1000, 2),
            )
            return response
        finally:
            correlation_id_context.reset(token)

    async def require_internal_token(
        x_internal_token: Annotated[
            str | None,
            Header(alias="X-Internal-Token", include_in_schema=False),
        ] = None,
    ) -> None:
        expected = runtime_settings.internal_api_token
        if (
            x_internal_token is None
            or len(expected) < 24
            or not hmac.compare_digest(expected, x_internal_token)
        ):
            raise HTTPException(status_code=401, detail="Internal token is invalid.")

    protected = [Depends(require_internal_token)]

    @application.exception_handler(DomainError)
    async def domain_error_handler(_request: Request, error: DomainError) -> Response:
        LOGGER.warning(
            "processing_rejected code=%s status=%s",
            error.code,
            error.status_code,
        )
        return _error_response(
            status_code=error.status_code,
            code=error.code,
            message=error.message,
            details=error.details,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request,
        error: RequestValidationError,
    ) -> Response:
        safe_errors = [
            {
                "location": [str(part) for part in item["loc"]],
                "message": item["msg"],
                "type": item["type"],
            }
            for item in error.errors()
        ]
        return _error_response(
            status_code=422,
            code="request_validation_failed",
            message="The request did not satisfy the endpoint contract.",
            details={"fields": safe_errors},
        )

    @application.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/ready")
    async def ready() -> dict[str, str | bool]:
        return {
            "status": "ready",
            "processing": "available",
            "supabase_configured": runtime_settings.supabase_configured,
        }

    @application.get("/version")
    async def version() -> dict[str, str]:
        return {"name": "supplier-compliance-api", "version": __version__}

    @application.post("/internal/process-document", dependencies=protected)
    def process_document_endpoint(request: ProcessDocumentRequest) -> JobResponse:
        execution = processor.execute(
            operation="process-document",
            job_id=request.job.job_id,
            request=request,
            handler=lambda: process_document(
                request,
                service_max_bytes=runtime_settings.max_document_bytes,
                max_pages=runtime_settings.max_pdf_pages,
                max_extracted_characters=runtime_settings.max_extracted_characters,
            ),
        )
        return JobResponse(
            job_id=request.job.job_id,
            status="succeeded",
            idempotent_replay=execution.replayed,
            result=execution.value.model_dump(mode="json"),
        )

    @application.post("/internal/recalculate-risk", dependencies=protected)
    def recalculate_risk_endpoint(request: RecalculateRiskRequest) -> JobResponse:
        execution = processor.execute(
            operation="recalculate-risk",
            job_id=request.job.job_id,
            request=request,
            handler=lambda: calculate_risk(request),
        )
        return JobResponse(
            job_id=request.job.job_id,
            status="succeeded",
            idempotent_replay=execution.replayed,
            result=execution.value.model_dump(mode="json"),
        )

    @application.post("/internal/import-suppliers", dependencies=protected)
    def import_suppliers_endpoint(request: ImportSuppliersRequest) -> JobResponse:
        execution = processor.execute(
            operation="import-suppliers",
            job_id=request.job.job_id,
            request=request,
            handler=lambda: import_suppliers(
                request,
                max_rows=runtime_settings.max_csv_rows,
                max_bytes=runtime_settings.max_csv_bytes,
            ),
        )
        return JobResponse(
            job_id=request.job.job_id,
            status="succeeded",
            idempotent_replay=execution.replayed,
            result=execution.value.model_dump(mode="json"),
        )

    @application.post("/internal/generate-assessment-report", dependencies=protected)
    def generate_report_endpoint(request: GenerateAssessmentReportRequest) -> Response:
        execution = processor.execute(
            operation="generate-assessment-report",
            job_id=request.job.job_id,
            request=request,
            handler=lambda: generate_assessment_report(request),
        )
        digest = report_digest(execution.value)
        return Response(
            content=execution.value,
            media_type="application/pdf",
            headers={
                "Cache-Control": "no-store, private",
                "Content-Disposition": (
                    f'attachment; filename="assessment-{request.assessment_id}.pdf"'
                ),
                "X-Content-SHA256": digest,
                "X-Idempotent-Replay": str(execution.replayed).lower(),
                "X-Job-ID": request.job.job_id,
            },
        )

    return application


def _correlation_id(value: str | None) -> str:
    if value:
        try:
            return str(UUID(value))
        except ValueError:
            pass
    return str(uuid4())


def _error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        },
        "correlation_id": correlation_id_context.get(),
    }
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


app = create_app()
