"""Safe PDF processing and document-rule tests."""

from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable
from datetime import date
from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfReader, PdfWriter

from supplier_compliance_api.documents import process_document, validate_document_rules
from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.models import DocumentRules, JobMetadata, ProcessDocumentRequest


def make_request(
    content: bytes,
    *,
    mime_type: str = "application/pdf",
    expected_sha256: str | None = None,
    issue_date: date | None = None,
    expiry_date: date | None = None,
    rules: DocumentRules | None = None,
) -> ProcessDocumentRequest:
    return ProcessDocumentRequest(
        job=JobMetadata(job_id=f"document-{uuid4()}"),
        document_version_id=uuid4(),
        file_name="fictional-certificate.pdf",
        mime_type=mime_type,
        content_base64=base64.b64encode(content).decode(),
        expected_sha256=expected_sha256,
        issue_date=issue_date,
        expiry_date=expiry_date,
        rules=rules or DocumentRules(reference_date=date(2026, 7, 24)),
    )


def process(request: ProcessDocumentRequest) -> object:
    return process_document(
        request,
        service_max_bytes=1024 * 1024,
        max_pages=10,
        max_extracted_characters=10_000,
    )


def test_processes_text_pdf_and_returns_only_safe_metadata(
    make_pdf: Callable[..., bytes],
) -> None:
    content = make_pdf()
    result = process(make_request(content, expected_sha256=hashlib.sha256(content).hexdigest()))
    assert result.sha256_hash == hashlib.sha256(content).hexdigest()
    assert result.metadata.page_count == 1
    assert result.metadata.title == "Demonstration Evidence"
    assert result.metadata.author == "Portfolio Test"
    assert result.metadata.extracted_character_count > 10
    assert not hasattr(result.metadata, "text")


def test_rejects_unsupported_mime_type(make_pdf: Callable[..., bytes]) -> None:
    with pytest.raises(DomainError, match="Only application/pdf") as error:
        process(make_request(make_pdf(), mime_type="image/png"))
    assert error.value.status_code == 415


def test_rejects_invalid_base64(make_pdf: Callable[..., bytes]) -> None:
    request = make_request(make_pdf())
    mutated = request.model_copy(update={"content_base64": "not-valid-base64"})
    with pytest.raises(DomainError, match="valid base64"):
        process(mutated)


def test_rejects_non_pdf_signature() -> None:
    with pytest.raises(DomainError, match="valid PDF signature"):
        process(make_request(b"this is not a pdf"))


def test_rejects_malformed_pdf() -> None:
    with pytest.raises(DomainError, match="parsed safely"):
        process(make_request(b"%PDF-1.7\nnot-a-valid-structure"))


def test_rejects_image_only_or_blank_pdf(make_pdf: Callable[..., bytes]) -> None:
    with pytest.raises(DomainError, match="OCR is not enabled"):
        process(make_request(make_pdf(text="")))


def test_rejects_encrypted_pdf(make_pdf: Callable[..., bytes]) -> None:
    reader = PdfReader(BytesIO(make_pdf()))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt("fictional-password")
    output = BytesIO()
    writer.write(output)
    with pytest.raises(DomainError, match="Encrypted"):
        process(make_request(output.getvalue()))


def test_rejects_checksum_mismatch(make_pdf: Callable[..., bytes]) -> None:
    with pytest.raises(DomainError, match="checksum"):
        process(make_request(make_pdf(), expected_sha256="0" * 64))


def test_rejects_document_over_size_limit(make_pdf: Callable[..., bytes]) -> None:
    request = make_request(
        make_pdf(),
        rules=DocumentRules(maximum_size_bytes=100, reference_date=date(2026, 7, 24)),
    )
    with pytest.raises(DomainError, match="size limit") as error:
        process(request)
    assert error.value.status_code == 413


def test_rejects_too_many_pages(make_pdf: Callable[..., bytes]) -> None:
    with pytest.raises(DomainError, match="page limit"):
        process_document(
            make_request(make_pdf(pages=3)),
            service_max_bytes=1024 * 1024,
            max_pages=2,
            max_extracted_characters=10_000,
        )


def test_document_rules_report_required_dates() -> None:
    request = make_request(
        b"%PDF-unused",
        rules=DocumentRules(
            requires_issue_date=True,
            requires_expiry_date=True,
            reference_date=date(2026, 7, 24),
        ),
    )
    result = validate_document_rules(request)
    assert not result.valid
    assert result.errors == ["issue_date_required", "expiry_date_required"]


def test_document_rules_reject_invalid_date_order() -> None:
    result = validate_document_rules(
        make_request(
            b"%PDF-unused",
            issue_date=date(2026, 8, 1),
            expiry_date=date(2026, 7, 31),
        )
    )
    assert "expiry_must_follow_issue_date" in result.errors
    assert "issue_date_in_future" in result.errors


def test_document_rules_reject_expired_and_minimum_validity() -> None:
    expired = validate_document_rules(make_request(b"%PDF-unused", expiry_date=date(2026, 7, 23)))
    assert "document_expired" in expired.errors

    short = validate_document_rules(
        make_request(
            b"%PDF-unused",
            expiry_date=date(2026, 8, 1),
            rules=DocumentRules(
                minimum_validity_days=60,
                reference_date=date(2026, 7, 24),
            ),
        )
    )
    assert "minimum_validity_not_met" in short.errors


def test_document_rules_warn_for_soon_expiry() -> None:
    result = validate_document_rules(make_request(b"%PDF-unused", expiry_date=date(2026, 8, 15)))
    assert result.valid
    assert result.warnings == ["document_expires_within_30_days"]
    assert result.days_until_expiry == 22
