"""Shared test fixtures for the processing service."""

from __future__ import annotations

from collections.abc import Callable, Generator
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen.canvas import Canvas

from supplier_compliance_api.config import Settings
from supplier_compliance_api.idempotency import IdempotentJobProcessor
from supplier_compliance_api.main import create_app

INTERNAL_TOKEN = "test-internal-token-with-32-characters"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        internal_api_token=INTERNAL_TOKEN,
        log_level="WARNING",
        max_request_bytes=2 * 1024 * 1024,
        max_document_bytes=1024 * 1024,
        max_pdf_pages=10,
        max_extracted_characters=10_000,
        max_csv_rows=100,
        max_csv_bytes=100_000,
    )


@pytest.fixture
def client(settings: Settings) -> Generator[TestClient]:
    app = create_app(settings, job_processor=IdempotentJobProcessor())
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-Internal-Token": INTERNAL_TOKEN}


@pytest.fixture
def make_pdf() -> Callable[..., bytes]:
    def factory(
        text: str = "Fictional supplier compliance evidence.",
        *,
        title: str = "Demonstration Evidence",
        author: str = "Portfolio Test",
        pages: int = 1,
    ) -> bytes:
        output = BytesIO()
        canvas = Canvas(output, invariant=1)
        canvas.setTitle(title)
        canvas.setAuthor(author)
        for page_number in range(pages):
            if text:
                canvas.drawString(72, 760, f"{text} Page {page_number + 1}")
            canvas.showPage()
        canvas.save()
        return output.getvalue()

    return factory
