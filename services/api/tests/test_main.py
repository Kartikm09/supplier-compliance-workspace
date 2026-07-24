"""FastAPI integration tests for protected processing workflows."""

from __future__ import annotations

import base64
import hashlib
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from supplier_compliance_api import __version__


def document_payload(content: bytes, *, job_id: str = "document-api-job") -> dict[str, object]:
    return {
        "job": {"job_id": job_id},
        "document_version_id": str(uuid4()),
        "file_name": "fictional-certificate.pdf",
        "mime_type": "application/pdf",
        "content_base64": base64.b64encode(content).decode(),
        "expected_sha256": hashlib.sha256(content).hexdigest(),
        "issue_date": "2026-01-01",
        "expiry_date": "2027-12-31",
        "rules": {
            "requires_issue_date": True,
            "requires_expiry_date": True,
            "minimum_validity_days": 60,
            "reference_date": "2026-07-24",
        },
    }


def risk_payload(*, job_id: str = "risk-api-job") -> dict[str, object]:
    return {
        "job": {"job_id": job_id},
        "assessment_id": str(uuid4()),
        "calculation_version": "supplier-risk-v1",
        "factors": [
            {"name": "quality_management", "score": 10},
            {"name": "information_security", "score": 20},
            {"name": "business_continuity", "score": 30},
            {"name": "document_validity", "score": 40},
            {"name": "delivery_capability", "score": 50},
        ],
        "unresolved_critical_findings": 0,
        "documents_expiring_within_30_days": 1,
    }


def import_payload(*, job_id: str = "import-api-job") -> dict[str, object]:
    return {
        "job": {"job_id": job_id},
        "csv_text": ("Company,Registration,Country,Email\nNova Plastics,NP-001,GB,ops@nova.test\n"),
        "field_mapping": {
            "Company": "legal_name",
            "Registration": "registration_number",
            "Country": "country_code",
            "Email": "contact_email",
        },
        "existing_suppliers": [],
    }


def report_payload(*, job_id: str = "report-api-job") -> dict[str, object]:
    return {
        "job": {"job_id": job_id},
        "assessment_id": str(uuid4()),
        "buyer_name": "Apex Components Group",
        "supplier_name": "Nova Plastics Ltd.",
        "program_name": "Standard Supplier Qualification",
        "program_version": 1,
        "assessment_status": "conditionally_approved",
        "completeness_percentage": "100",
        "documents": [
            {
                "name": "Fictional quality certificate",
                "status": "accepted",
                "expiry_date": "2026-08-15",
            }
        ],
        "findings": [
            {
                "finding_number": 1,
                "severity": "medium",
                "title": "Business continuity exercise evidence",
                "status": "verified",
            }
        ],
        "corrective_action_status": "accepted",
        "decision": "conditionally_approved",
        "generated_at": datetime(2026, 7, 24, 10, 30, tzinfo=UTC).isoformat(),
    }


def test_health_ready_and_version_are_public(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").json() == {
        "status": "ready",
        "processing": "available",
        "supabase_configured": False,
    }
    assert client.get("/version").json() == {
        "name": "supplier-compliance-api",
        "version": __version__,
    }


@pytest.mark.parametrize(
    "path",
    [
        "/internal/process-document",
        "/internal/recalculate-risk",
        "/internal/generate-assessment-report",
        "/internal/import-suppliers",
    ],
)
def test_internal_endpoints_require_authentication(client: TestClient, path: str) -> None:
    response = client.post(path, json={})
    assert response.status_code == 401
    assert response.json()["detail"] == "Internal token is invalid."


def test_internal_endpoint_rejects_wrong_token(client: TestClient) -> None:
    response = client.post(
        "/internal/recalculate-risk",
        json=risk_payload(),
        headers={"X-Internal-Token": "wrong-token-value-with-24-chars"},
    )
    assert response.status_code == 401


def test_process_document_endpoint(
    client: TestClient,
    auth_headers: dict[str, str],
    make_pdf: Callable[..., bytes],
) -> None:
    response = client.post(
        "/internal/process-document",
        json=document_payload(make_pdf()),
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert not body["idempotent_replay"]
    assert body["result"]["metadata"]["page_count"] == 1
    assert body["result"]["validation"]["valid"]


def test_process_document_is_idempotent(
    client: TestClient,
    auth_headers: dict[str, str],
    make_pdf: Callable[..., bytes],
) -> None:
    payload = document_payload(make_pdf())
    first = client.post("/internal/process-document", json=payload, headers=auth_headers)
    second = client.post("/internal/process-document", json=payload, headers=auth_headers)
    assert first.status_code == second.status_code == 200
    assert not first.json()["idempotent_replay"]
    assert second.json()["idempotent_replay"]
    assert first.json()["result"] == second.json()["result"]


def test_job_id_payload_conflict_returns_409(
    client: TestClient,
    auth_headers: dict[str, str],
    make_pdf: Callable[..., bytes],
) -> None:
    payload = document_payload(make_pdf())
    assert (
        client.post("/internal/process-document", json=payload, headers=auth_headers).status_code
        == 200
    )
    payload["expiry_date"] = "2028-12-31"
    response = client.post("/internal/process-document", json=payload, headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "idempotency_conflict"


def test_document_error_is_structured_and_safe(
    client: TestClient,
    auth_headers: dict[str, str],
    make_pdf: Callable[..., bytes],
) -> None:
    payload = document_payload(make_pdf())
    payload["mime_type"] = "application/zip"
    response = client.post("/internal/process-document", json=payload, headers=auth_headers)
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_mime_type"
    assert "content_base64" not in response.text


def test_recalculate_risk_endpoint(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/internal/recalculate-risk",
        json=risk_payload(),
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert Decimal(response.json()["result"]["total_score"]) == Decimal("30.00")
    assert response.json()["result"]["risk_level"] == "medium"


def test_import_suppliers_endpoint(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/internal/import-suppliers",
        json=import_payload(),
        headers=auth_headers,
    )
    assert response.status_code == 200
    result = response.json()["result"]
    assert result["accepted_rows"] == 1
    assert result["accepted"][0]["legal_name"] == "Nova Plastics"


def test_generate_report_returns_private_pdf(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/internal/generate-assessment-report",
        json=report_payload(),
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store, private"
    assert response.headers["x-content-sha256"] == hashlib.sha256(response.content).hexdigest()
    text = "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages
    )
    assert "DEMONSTRATION DATA" in text


def test_generate_report_reuses_identical_job(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    payload = report_payload()
    first = client.post(
        "/internal/generate-assessment-report",
        json=payload,
        headers=auth_headers,
    )
    second = client.post(
        "/internal/generate-assessment-report",
        json=payload,
        headers=auth_headers,
    )
    assert first.content == second.content
    assert first.headers["x-idempotent-replay"] == "false"
    assert second.headers["x-idempotent-replay"] == "true"


def test_validation_error_does_not_echo_sensitive_input(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    marker = "private-document-content-marker"
    payload = document_payload(b"%PDF-invalid")
    payload["content_base64"] = marker
    response = client.post("/internal/process-document", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "request_validation_failed"
    assert marker not in response.text


def test_correlation_id_is_preserved_when_valid(client: TestClient) -> None:
    correlation_id = str(uuid4())
    response = client.get("/health", headers={"X-Correlation-ID": correlation_id})
    assert response.headers["x-correlation-id"] == correlation_id


def test_invalid_correlation_id_is_replaced(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Correlation-ID": "not-a-uuid"})
    assert response.headers["x-correlation-id"] != "not-a-uuid"
    assert len(response.headers["x-correlation-id"]) == 36


def test_rejects_declared_request_over_limit(client: TestClient) -> None:
    response = client.post(
        "/internal/import-suppliers",
        content=b"{}",
        headers={"Content-Length": str(3 * 1024 * 1024)},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"


def test_invalid_content_length_is_rejected(client: TestClient) -> None:
    response = client.get("/health", headers={"Content-Length": "not-an-integer"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_content_length"
