"""Validated contracts for internal processing operations."""

from __future__ import annotations

import base64
import binascii
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    """Base model that rejects unknown fields at service boundaries."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class JobMetadata(StrictModel):
    """Queue-oriented identity used for idempotent processing."""

    job_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    correlation_id: UUID | None = None
    attempt: int = Field(default=1, ge=1, le=100)


class DocumentRules(StrictModel):
    """Document validation rules copied from an immutable program version."""

    requires_issue_date: bool = False
    requires_expiry_date: bool = False
    minimum_validity_days: int = Field(default=0, ge=0, le=3650)
    maximum_size_bytes: int = Field(default=10 * 1024 * 1024, ge=1, le=10 * 1024 * 1024)
    reference_date: date = Field(default_factory=date.today)


class ProcessDocumentRequest(StrictModel):
    """Text-PDF processing job received from a trusted queue consumer."""

    job: JobMetadata
    document_version_id: UUID
    file_name: str = Field(min_length=5, max_length=255)
    mime_type: str = Field(min_length=1, max_length=100)
    content_base64: str = Field(min_length=8, max_length=14_000_000, repr=False)
    expected_sha256: str | None = Field(
        default=None,
        pattern=r"^[a-fA-F0-9]{64}$",
        repr=False,
    )
    issue_date: date | None = None
    expiry_date: date | None = None
    issuing_body: str | None = Field(default=None, max_length=200)
    rules: DocumentRules = Field(default_factory=DocumentRules)

    @field_validator("file_name")
    @classmethod
    def validate_file_name(cls, value: str) -> str:
        if "/" in value or "\\" in value or value in {".", ".."}:
            raise ValueError("file_name must not contain a path")
        if not value.lower().endswith(".pdf"):
            raise ValueError("only .pdf files are supported")
        return value

    @field_validator("content_base64")
    @classmethod
    def validate_content_base64(cls, value: str) -> str:
        try:
            base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("content_base64 must be valid base64") from error
        return value


class PdfMetadata(StrictModel):
    """Safe metadata extracted from a supported PDF."""

    page_count: int = Field(ge=1)
    title: str | None = None
    author: str | None = None
    extracted_character_count: int = Field(ge=1)
    extracted_text_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class DocumentValidation(StrictModel):
    """Document rule findings suitable for persistence."""

    valid: bool
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    days_until_expiry: int | None = None


class DocumentProcessingResult(StrictModel):
    """Result of safe document processing."""

    document_version_id: UUID
    sha256_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    byte_size: int = Field(ge=1)
    mime_type: Literal["application/pdf"]
    metadata: PdfMetadata
    validation: DocumentValidation


class CanonicalSupplierField(StrEnum):
    """Allowed destinations for supplier CSV field mapping."""

    LEGAL_NAME = "legal_name"
    REGISTRATION_NUMBER = "registration_number"
    COUNTRY_CODE = "country_code"
    WEBSITE = "website"
    PRIMARY_CATEGORY = "primary_category"
    CONTACT_EMAIL = "contact_email"


class SupplierRecord(StrictModel):
    """Canonical supplier import record."""

    legal_name: str = Field(min_length=1, max_length=200)
    registration_number: str | None = Field(default=None, max_length=100)
    country_code: str = Field(min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    website: str | None = Field(default=None, max_length=500)
    primary_category: str | None = Field(default=None, max_length=150)
    contact_email: str | None = Field(default=None, max_length=320)

    @field_validator("country_code")
    @classmethod
    def uppercase_country(cls, value: str) -> str:
        return value.upper()


class ImportSuppliersRequest(StrictModel):
    """CSV import job and caller-controlled source-to-canonical mapping."""

    job: JobMetadata
    csv_text: str = Field(min_length=1, max_length=1_048_576, repr=False)
    field_mapping: dict[str, CanonicalSupplierField] = Field(min_length=2, max_length=20)
    existing_suppliers: list[SupplierRecord] = Field(default_factory=list, max_length=10_000)


class ImportIssue(StrictModel):
    """A row-level validation or duplicate issue."""

    row_number: int = Field(ge=2)
    code: str
    message: str
    matched_existing_name: str | None = None


class SupplierImportResult(StrictModel):
    """Normalized import preview; persistence remains the queue worker's responsibility."""

    accepted: list[SupplierRecord]
    issues: list[ImportIssue]
    total_rows: int = Field(ge=0)
    accepted_rows: int = Field(ge=0)
    duplicate_rows: int = Field(ge=0)
    invalid_rows: int = Field(ge=0)


AnswerType = Literal["text", "number", "boolean", "date", "single_select", "multi_select"]


class QuestionnaireAnswer(StrictModel):
    """Question definition and supplied value used for completeness checks."""

    stable_question_key: str = Field(min_length=1, max_length=100)
    answer_type: AnswerType
    required: bool = False
    visible: bool = True
    value: Any = None


class QuestionnaireCompleteness(StrictModel):
    """Deterministic completeness and validation summary."""

    complete: bool
    completeness_percentage: Decimal = Field(ge=0, le=100)
    required_total: int = Field(ge=0)
    required_answered: int = Field(ge=0)
    missing_required_keys: list[str]
    invalid_answer_keys: list[str]


RiskFactorName = Literal[
    "quality_management",
    "information_security",
    "business_continuity",
    "document_validity",
    "delivery_capability",
]


class RiskFactor(StrictModel):
    """A normalized risk signal where 0 is best and 100 is worst."""

    name: RiskFactorName
    score: Decimal = Field(ge=0, le=100)


class RecalculateRiskRequest(StrictModel):
    """Versioned deterministic risk-calculation job."""

    job: JobMetadata
    assessment_id: UUID
    calculation_version: Literal["supplier-risk-v1"] = "supplier-risk-v1"
    factors: list[RiskFactor] = Field(min_length=5, max_length=5)
    unresolved_critical_findings: int = Field(default=0, ge=0, le=100)
    documents_expiring_within_30_days: int = Field(default=0, ge=0, le=100)

    @model_validator(mode="after")
    def validate_factor_set(self) -> RecalculateRiskRequest:
        expected = {
            "quality_management",
            "information_security",
            "business_continuity",
            "document_validity",
            "delivery_capability",
        }
        supplied = [factor.name for factor in self.factors]
        if len(set(supplied)) != len(supplied):
            raise ValueError("risk factors must be unique")
        if set(supplied) != expected:
            raise ValueError("all supplier-risk-v1 factors are required")
        return self


class RiskContribution(StrictModel):
    """Transparent contribution from one risk factor."""

    score: Decimal
    weight: Decimal
    contribution: Decimal


class RiskResult(StrictModel):
    """Versioned risk output ready to become an immutable risk evaluation."""

    assessment_id: UUID
    calculation_version: str
    total_score: Decimal = Field(ge=0, le=100)
    risk_level: Literal["low", "medium", "high", "critical"]
    scoring_breakdown: dict[str, RiskContribution]
    adjustments: dict[str, Decimal]


class ReportDocument(StrictModel):
    """Document summary included in a generated report."""

    name: str = Field(min_length=1, max_length=150)
    status: str = Field(min_length=1, max_length=50)
    expiry_date: date | None = None


class ReportFinding(StrictModel):
    """Supplier-safe finding summary included in a generated report."""

    finding_number: int = Field(ge=1)
    severity: Literal["low", "medium", "high", "critical"]
    title: str = Field(min_length=1, max_length=200)
    status: str = Field(min_length=1, max_length=50)


class GenerateAssessmentReportRequest(StrictModel):
    """Private demonstration report generation job."""

    job: JobMetadata
    assessment_id: UUID
    buyer_name: str = Field(min_length=1, max_length=200)
    supplier_name: str = Field(min_length=1, max_length=200)
    program_name: str = Field(min_length=1, max_length=200)
    program_version: int = Field(ge=1, le=10_000)
    assessment_status: str = Field(min_length=1, max_length=50)
    completeness_percentage: Decimal = Field(ge=0, le=100)
    documents: list[ReportDocument] = Field(default_factory=list, max_length=100)
    findings: list[ReportFinding] = Field(default_factory=list, max_length=100)
    corrective_action_status: str | None = Field(default=None, max_length=100)
    decision: Literal["approved", "conditionally_approved", "rejected", "deferred"] | None = None
    generated_at: datetime


class JobResponse(StrictModel):
    """Common envelope for idempotent JSON processing responses."""

    job_id: str
    status: Literal["succeeded"]
    idempotent_replay: bool
    result: dict[str, Any]
