"""Private assessment-report generation tests."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

from pypdf import PdfReader

from supplier_compliance_api.models import (
    GenerateAssessmentReportRequest,
    JobMetadata,
    ReportDocument,
    ReportFinding,
)
from supplier_compliance_api.reporting import generate_assessment_report, report_digest


def report_request() -> GenerateAssessmentReportRequest:
    return GenerateAssessmentReportRequest(
        job=JobMetadata(job_id="report-job"),
        assessment_id=uuid4(),
        buyer_name="Apex Components Group",
        supplier_name="Nova Plastics Ltd.",
        program_name="Standard Supplier Qualification",
        program_version=1,
        assessment_status="conditionally_approved",
        completeness_percentage=Decimal("100"),
        documents=[
            ReportDocument(
                name="Fictional quality certificate",
                status="accepted",
                expiry_date=date(2026, 8, 15),
            )
        ],
        findings=[
            ReportFinding(
                finding_number=1,
                severity="medium",
                title="Business continuity exercise evidence",
                status="verified",
            )
        ],
        corrective_action_status="accepted",
        decision="conditionally_approved",
        generated_at=datetime(2026, 7, 24, 10, 30, tzinfo=UTC),
    )


def extract_text(content: bytes) -> str:
    return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)


def test_report_is_valid_pdf_with_demonstration_marking() -> None:
    content = generate_assessment_report(report_request())
    assert content.startswith(b"%PDF-")
    text = extract_text(content)
    assert "DEMONSTRATION DATA" in text
    assert "fictional demonstration data" in text


def test_report_contains_required_operational_summary() -> None:
    text = extract_text(generate_assessment_report(report_request()))
    assert "Apex Components Group" in text
    assert "Nova Plastics Ltd." in text
    assert "Standard Supplier Qualification" in text
    assert "Fictional quality certificate" in text
    assert "Business continuity exercise evidence" in text
    assert "conditionally_approved" in text


def test_report_generation_is_deterministic() -> None:
    request = report_request()
    first = generate_assessment_report(request)
    second = generate_assessment_report(request)
    assert first == second
    assert report_digest(first) == report_digest(second)


def test_report_handles_empty_documents_and_findings() -> None:
    request = report_request().model_copy(update={"documents": [], "findings": []})
    text = extract_text(generate_assessment_report(request))
    assert "No documents recorded" in text
    assert "No findings recorded" in text


def test_report_escapes_markup_in_names() -> None:
    request = report_request().model_copy(update={"supplier_name": "Nova <Test> & Co."})
    text = extract_text(generate_assessment_report(request))
    assert "Nova <Test> & Co." in text
