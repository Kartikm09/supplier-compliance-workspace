"""Supplier CSV mapping and deduplication tests."""

from __future__ import annotations

from uuid import uuid4

import pytest

from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.imports import find_duplicate, import_suppliers
from supplier_compliance_api.models import (
    CanonicalSupplierField,
    ImportSuppliersRequest,
    JobMetadata,
    SupplierRecord,
)

MAPPING = {
    "Company": CanonicalSupplierField.LEGAL_NAME,
    "Registration": CanonicalSupplierField.REGISTRATION_NUMBER,
    "Country": CanonicalSupplierField.COUNTRY_CODE,
    "Email": CanonicalSupplierField.CONTACT_EMAIL,
}


def request(
    csv_text: str,
    *,
    mapping: dict[str, CanonicalSupplierField] | None = None,
    existing: list[SupplierRecord] | None = None,
) -> ImportSuppliersRequest:
    return ImportSuppliersRequest(
        job=JobMetadata(job_id=f"import-{uuid4()}"),
        csv_text=csv_text,
        field_mapping=mapping or MAPPING,
        existing_suppliers=existing or [],
    )


def run_import(value: ImportSuppliersRequest, *, max_rows: int = 100) -> object:
    return import_suppliers(value, max_rows=max_rows, max_bytes=100_000)


def test_maps_valid_csv_and_normalizes_country() -> None:
    result = run_import(
        request("Company,Registration,Country,Email\nNova Plastics,NP-001,gb,ops@nova.test\n")
    )
    assert result.total_rows == 1
    assert result.accepted_rows == 1
    assert result.accepted[0].country_code == "GB"


def test_detects_duplicate_against_existing_registration() -> None:
    existing = SupplierRecord(
        legal_name="Nova Plastics Ltd",
        registration_number="NP-001",
        country_code="GB",
    )
    result = run_import(
        request(
            "Company,Registration,Country,Email\nNova Plastics,NP001,GB,ops@nova.test\n",
            existing=[existing],
        )
    )
    assert result.duplicate_rows == 1
    assert result.issues[0].matched_existing_name == "Nova Plastics Ltd"


def test_detects_duplicate_inside_same_import_by_name_and_country() -> None:
    result = run_import(
        request(
            "Company,Registration,Country,Email\n"
            "Greenline Packaging,,DE,one@greenline.test\n"
            " greenline-packaging ,,de,two@greenline.test\n"
        )
    )
    assert result.accepted_rows == 1
    assert result.duplicate_rows == 1


def test_invalid_email_is_a_row_issue_not_a_batch_failure() -> None:
    result = run_import(
        request("Company,Registration,Country,Email\nNova Plastics,NP-1,GB,not-an-email\n")
    )
    assert result.invalid_rows == 1
    assert result.issues[0].code == "invalid_supplier"


def test_invalid_country_is_a_row_issue() -> None:
    result = run_import(
        request("Company,Registration,Country,Email\nNova Plastics,NP-1,GBR,ops@nova.test\n")
    )
    assert result.invalid_rows == 1
    assert "country_code" in result.issues[0].message


def test_rejects_mapping_to_same_canonical_field_twice() -> None:
    invalid_mapping = {
        "Company": CanonicalSupplierField.LEGAL_NAME,
        "Alias": CanonicalSupplierField.LEGAL_NAME,
        "Country": CanonicalSupplierField.COUNTRY_CODE,
    }
    with pytest.raises(DomainError, match="only once"):
        run_import(request("Company,Alias,Country\nNova,Nova,GB\n", mapping=invalid_mapping))


def test_rejects_missing_required_mapping() -> None:
    mapping = {
        "Company": CanonicalSupplierField.LEGAL_NAME,
        "Email": CanonicalSupplierField.CONTACT_EMAIL,
    }
    with pytest.raises(DomainError, match="country_code"):
        run_import(request("Company,Email\nNova,ops@nova.test\n", mapping=mapping))


def test_rejects_mapped_header_missing_from_csv() -> None:
    with pytest.raises(DomainError, match="source columns"):
        run_import(request("Company,Country\nNova,GB\n"))


def test_rejects_nul_character() -> None:
    with pytest.raises(DomainError, match="control characters"):
        run_import(request("Company,Registration,Country,Email\nNova,\x00,GB,ops@nova.test\n"))


def test_rejects_csv_over_size_limit() -> None:
    value = request("Company,Registration,Country,Email\nNova,NP-1,GB,ops@nova.test\n")
    with pytest.raises(DomainError, match="size limit") as error:
        import_suppliers(value, max_rows=100, max_bytes=10)
    assert error.value.status_code == 413


def test_rejects_csv_over_row_limit() -> None:
    csv_text = (
        "Company,Registration,Country,Email\n"
        "Nova,NP-1,GB,one@nova.test\n"
        "Greenline,GL-1,DE,two@greenline.test\n"
    )
    with pytest.raises(DomainError, match="row limit"):
        run_import(request(csv_text), max_rows=1)


def test_find_duplicate_returns_none_for_distinct_supplier() -> None:
    candidate = SupplierRecord(
        legal_name="Nova Plastics",
        registration_number="NP-1",
        country_code="GB",
    )
    existing = SupplierRecord(
        legal_name="Greenline Packaging",
        registration_number="GL-1",
        country_code="DE",
    )
    assert find_duplicate(candidate, [existing]) is None
