"""Bounded, non-executing inspection of supported text-based PDF evidence."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import re
from datetime import timedelta
from io import BytesIO
from typing import Final, Literal

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.models import (
    DocumentProcessingResult,
    DocumentValidation,
    PdfMetadata,
    ProcessDocumentRequest,
)

SUPPORTED_MIME_TYPE: Final[Literal["application/pdf"]] = "application/pdf"
CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")


def process_document(
    request: ProcessDocumentRequest,
    *,
    service_max_bytes: int,
    max_pages: int,
    max_extracted_characters: int,
) -> DocumentProcessingResult:
    """Decode, verify, inspect, and validate one text PDF.

    The function never executes embedded objects, follows links, performs OCR, or returns document
    text. Only bounded metadata and a digest of normalized extracted text leave this boundary.
    """

    if request.mime_type.casefold() != SUPPORTED_MIME_TYPE:
        raise DomainError(
            "unsupported_mime_type",
            "Only application/pdf documents are supported.",
            status_code=415,
        )
    try:
        content = base64.b64decode(request.content_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise DomainError(
            "invalid_document_encoding", "Document content is not valid base64."
        ) from error

    maximum_size = min(service_max_bytes, request.rules.maximum_size_bytes)
    if not content:
        raise DomainError("empty_document", "The document is empty.")
    if len(content) > maximum_size:
        raise DomainError(
            "document_too_large",
            "The document exceeds the configured size limit.",
            status_code=413,
        )
    if not content.startswith(b"%PDF-"):
        raise DomainError("invalid_pdf", "The document does not have a valid PDF signature.")

    sha256_hash = hashlib.sha256(content).hexdigest()
    if request.expected_sha256 and not hmac.compare_digest(
        sha256_hash,
        request.expected_sha256.casefold(),
    ):
        raise DomainError("checksum_mismatch", "The document checksum does not match.")

    metadata = _extract_metadata(
        content,
        max_pages=max_pages,
        max_extracted_characters=max_extracted_characters,
    )
    validation = validate_document_rules(request)
    return DocumentProcessingResult(
        document_version_id=request.document_version_id,
        sha256_hash=sha256_hash,
        byte_size=len(content),
        mime_type=SUPPORTED_MIME_TYPE,
        metadata=metadata,
        validation=validation,
    )


def validate_document_rules(request: ProcessDocumentRequest) -> DocumentValidation:
    """Validate issue, expiry, and minimum-validity rules."""

    errors: list[str] = []
    warnings: list[str] = []
    days_until_expiry: int | None = None

    if request.rules.requires_issue_date and request.issue_date is None:
        errors.append("issue_date_required")
    if request.rules.requires_expiry_date and request.expiry_date is None:
        errors.append("expiry_date_required")
    if (
        request.issue_date is not None
        and request.expiry_date is not None
        and request.expiry_date <= request.issue_date
    ):
        errors.append("expiry_must_follow_issue_date")
    if request.expiry_date is not None:
        days_until_expiry = (request.expiry_date - request.rules.reference_date).days
        minimum_expiry = request.rules.reference_date + timedelta(
            days=request.rules.minimum_validity_days
        )
        if request.expiry_date < request.rules.reference_date:
            errors.append("document_expired")
        elif request.expiry_date < minimum_expiry:
            errors.append("minimum_validity_not_met")
        elif days_until_expiry <= 30:
            warnings.append("document_expires_within_30_days")
    if request.issue_date is not None and request.issue_date > request.rules.reference_date:
        errors.append("issue_date_in_future")

    return DocumentValidation(
        valid=not errors,
        warnings=warnings,
        errors=errors,
        days_until_expiry=days_until_expiry,
    )


def _extract_metadata(
    content: bytes,
    *,
    max_pages: int,
    max_extracted_characters: int,
) -> PdfMetadata:
    try:
        reader = PdfReader(BytesIO(content), strict=True)
    except (PdfReadError, ValueError, TypeError, OSError) as error:
        raise DomainError("malformed_pdf", "The PDF could not be parsed safely.") from error
    if reader.is_encrypted:
        raise DomainError("encrypted_pdf", "Encrypted PDF documents are not supported.")
    page_count = len(reader.pages)
    if page_count == 0:
        raise DomainError("empty_pdf", "The PDF has no pages.")
    if page_count > max_pages:
        raise DomainError("too_many_pdf_pages", "The PDF exceeds the configured page limit.")

    extracted_parts: list[str] = []
    character_count = 0
    try:
        for page in reader.pages:
            text = page.extract_text() or ""
            remaining = max_extracted_characters - character_count
            if remaining <= 0:
                raise DomainError(
                    "pdf_text_too_large",
                    "Extracted PDF text exceeds the configured limit.",
                )
            if len(text) > remaining:
                raise DomainError(
                    "pdf_text_too_large",
                    "Extracted PDF text exceeds the configured limit.",
                )
            extracted_parts.append(text)
            character_count += len(text)
    except DomainError:
        raise
    except Exception as error:
        raise DomainError("pdf_text_extraction_failed", "PDF text extraction failed.") from error

    normalized_text = "\n".join(part.strip() for part in extracted_parts if part.strip()).strip()
    if not normalized_text:
        raise DomainError(
            "text_extraction_unsupported",
            "The PDF does not contain supported extractable text; OCR is not enabled.",
        )
    metadata = reader.metadata
    return PdfMetadata(
        page_count=page_count,
        title=_safe_metadata(getattr(metadata, "title", None)),
        author=_safe_metadata(getattr(metadata, "author", None)),
        extracted_character_count=len(normalized_text),
        extracted_text_sha256=hashlib.sha256(normalized_text.encode("utf-8")).hexdigest(),
    )


def _safe_metadata(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = CONTROL_CHARACTERS.sub(" ", value).strip()
    return cleaned[:200] or None
