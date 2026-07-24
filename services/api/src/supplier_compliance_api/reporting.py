"""Private PDF assessment report generation."""

from __future__ import annotations

import hashlib
import html
import re
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from supplier_compliance_api.models import GenerateAssessmentReportRequest

CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def generate_assessment_report(request: GenerateAssessmentReportRequest) -> bytes:
    """Generate a deterministic, clearly marked demonstration PDF."""

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=25 * mm,
        bottomMargin=20 * mm,
        title="Supplier Compliance Assessment Report - Demonstration Data",
        author="Supplier Compliance Workspace",
        invariant=1,
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DemoBanner",
            parent=styles["Heading2"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#9F1239"),
            backColor=colors.HexColor("#FFE4E6"),
            borderPadding=8,
            spaceAfter=14,
        )
    )
    story: list[Any] = [
        Paragraph("DEMONSTRATION DATA", styles["DemoBanner"]),
        Paragraph("Supplier Compliance Assessment Report", styles["Title"]),
        Spacer(1, 8),
        _summary_table(request),
        Spacer(1, 14),
        Paragraph("Document Summary", styles["Heading2"]),
        _document_table(request),
        Spacer(1, 14),
        Paragraph("Findings Summary", styles["Heading2"]),
        _finding_table(request),
        Spacer(1, 14),
        Paragraph("Corrective Action and Decision", styles["Heading2"]),
        Paragraph(
            _safe(
                f"Corrective action status: {request.corrective_action_status or 'Not applicable'}"
            ),
            styles["BodyText"],
        ),
        Paragraph(
            _safe(f"Decision: {request.decision or 'No final decision recorded'}"),
            styles["BodyText"],
        ),
        Spacer(1, 16),
        Paragraph(
            "This independently designed portfolio report contains fictional demonstration data "
            "and is not a real supplier certification or approval record.",
            styles["Italic"],
        ),
    ]
    document.build(
        story,
        onFirstPage=_draw_page_marker,
        onLaterPages=_draw_page_marker,
    )
    return output.getvalue()


def report_digest(content: bytes) -> str:
    """Return a stable report checksum for private object metadata."""

    return hashlib.sha256(content).hexdigest()


def _summary_table(request: GenerateAssessmentReportRequest) -> Table:
    rows = [
        ["Buyer", _clean(request.buyer_name)],
        ["Supplier", _clean(request.supplier_name)],
        ["Program", _clean(request.program_name)],
        ["Program version", str(request.program_version)],
        ["Assessment status", _clean(request.assessment_status)],
        ["Completion", f"{request.completeness_percentage}%"],
        ["Generated at", request.generated_at.isoformat()],
        ["Assessment ID", str(request.assessment_id)],
    ]
    table = Table(rows, colWidths=[42 * mm, 115 * mm], repeatRows=0)
    table.setStyle(_base_table_style())
    return table


def _document_table(request: GenerateAssessmentReportRequest) -> Table:
    rows: list[list[str]] = [["Document", "Status", "Expiry"]]
    rows.extend(
        [
            _clean(document.name),
            _clean(document.status),
            document.expiry_date.isoformat() if document.expiry_date else "Not supplied",
        ]
        for document in request.documents
    )
    if len(rows) == 1:
        rows.append(["No documents recorded", "-", "-"])
    table = Table(rows, colWidths=[75 * mm, 40 * mm, 42 * mm], repeatRows=1)
    table.setStyle(_base_table_style(header=True))
    return table


def _finding_table(request: GenerateAssessmentReportRequest) -> Table:
    rows: list[list[str]] = [["No.", "Severity", "Finding", "Status"]]
    rows.extend(
        [
            str(finding.finding_number),
            _clean(finding.severity),
            _clean(finding.title),
            _clean(finding.status),
        ]
        for finding in request.findings
    )
    if len(rows) == 1:
        rows.append(["-", "-", "No findings recorded", "-"])
    table = Table(rows, colWidths=[15 * mm, 28 * mm, 78 * mm, 36 * mm], repeatRows=1)
    table.setStyle(_base_table_style(header=True))
    return table


def _base_table_style(*, header: bool = False) -> TableStyle:
    commands: list[tuple[Any, ...]] = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ]
        )
    return TableStyle(commands)


def _draw_page_marker(canvas: Canvas, document: Any) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#9F1239"))
    canvas.drawString(18 * mm, 285 * mm, "DEMONSTRATION DATA")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawRightString(192 * mm, 12 * mm, f"Page {document.page}")
    canvas.restoreState()


def _safe(value: str) -> str:
    return html.escape(_clean(value), quote=True)


def _clean(value: str) -> str:
    return CONTROL_CHARACTERS.sub(" ", value).strip()
