"""Safe supplier CSV mapping and duplicate detection."""

from __future__ import annotations

import csv
import io
import re
from collections.abc import Iterable

from pydantic import ValidationError

from supplier_compliance_api.errors import DomainError
from supplier_compliance_api.models import (
    CanonicalSupplierField,
    ImportIssue,
    ImportSuppliersRequest,
    SupplierImportResult,
    SupplierRecord,
)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def import_suppliers(
    request: ImportSuppliersRequest,
    *,
    max_rows: int,
    max_bytes: int,
) -> SupplierImportResult:
    """Map a bounded CSV into canonical records and identify duplicates."""

    encoded_size = len(request.csv_text.encode("utf-8"))
    if encoded_size > max_bytes:
        raise DomainError(
            "csv_too_large", "The CSV exceeds the configured size limit.", status_code=413
        )
    if "\x00" in request.csv_text:
        raise DomainError("invalid_csv", "The CSV contains unsupported control characters.")

    mapped_fields = list(request.field_mapping.values())
    if len(mapped_fields) != len(set(mapped_fields)):
        raise DomainError("invalid_field_mapping", "Each canonical field may be mapped only once.")
    required = {
        CanonicalSupplierField.LEGAL_NAME,
        CanonicalSupplierField.COUNTRY_CODE,
    }
    if not required.issubset(set(mapped_fields)):
        raise DomainError(
            "invalid_field_mapping",
            "Mappings for legal_name and country_code are required.",
        )

    reader = csv.DictReader(io.StringIO(request.csv_text, newline=""))
    if reader.fieldnames is None:
        raise DomainError("invalid_csv", "The CSV does not contain a header row.")
    missing_headers = set(request.field_mapping).difference(reader.fieldnames)
    if missing_headers:
        raise DomainError(
            "invalid_field_mapping",
            "One or more mapped source columns are missing.",
            details={"missing_columns": sorted(missing_headers)},
        )

    accepted: list[SupplierRecord] = []
    issues: list[ImportIssue] = []
    known_records = list(request.existing_suppliers)
    total_rows = 0
    duplicate_rows = 0
    invalid_rows = 0

    for row_number, raw_row in enumerate(reader, start=2):
        total_rows += 1
        if total_rows > max_rows:
            raise DomainError("too_many_csv_rows", "The CSV exceeds the configured row limit.")
        try:
            candidate = _to_supplier(raw_row, request.field_mapping)
        except (ValidationError, ValueError) as error:
            invalid_rows += 1
            issues.append(
                ImportIssue(
                    row_number=row_number,
                    code="invalid_supplier",
                    message=_validation_message(error),
                )
            )
            continue

        duplicate = find_duplicate(candidate, (*known_records, *accepted))
        if duplicate is not None:
            duplicate_rows += 1
            issues.append(
                ImportIssue(
                    row_number=row_number,
                    code="duplicate_supplier",
                    message="The supplier matches an existing or earlier import record.",
                    matched_existing_name=duplicate.legal_name,
                )
            )
            continue
        accepted.append(candidate)

    return SupplierImportResult(
        accepted=accepted,
        issues=issues,
        total_rows=total_rows,
        accepted_rows=len(accepted),
        duplicate_rows=duplicate_rows,
        invalid_rows=invalid_rows,
    )


def find_duplicate(
    candidate: SupplierRecord,
    existing: Iterable[SupplierRecord],
) -> SupplierRecord | None:
    """Find a duplicate using registration identity or name-and-country identity."""

    candidate_registration = _identity(candidate.registration_number)
    candidate_name = _identity(candidate.legal_name)
    for current in existing:
        current_registration = _identity(current.registration_number)
        if candidate_registration and candidate_registration == current_registration:
            return current
        if (
            candidate_name == _identity(current.legal_name)
            and candidate.country_code == current.country_code
        ):
            return current
    return None


def _to_supplier(
    raw_row: dict[str, str | None],
    mapping: dict[str, CanonicalSupplierField],
) -> SupplierRecord:
    values: dict[str, str | None] = {}
    for source_field, target_field in mapping.items():
        raw_value = raw_row.get(source_field)
        values[target_field.value] = _clean_cell(raw_value)
    email = values.get("contact_email")
    if email and not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("contact_email is not valid")
    return SupplierRecord.model_validate(values)


def _clean_cell(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if CONTROL_CHARACTERS.search(cleaned):
        raise ValueError("a mapped value contains unsupported control characters")
    return cleaned


def _identity(value: str | None) -> str:
    if not value:
        return ""
    return "".join(character.casefold() for character in value if character.isalnum())


def _validation_message(error: ValidationError | ValueError) -> str:
    if isinstance(error, ValidationError):
        first_error = error.errors(include_input=False)[0]
        location = ".".join(str(part) for part in first_error["loc"])
        return f"{location}: {first_error['msg']}"
    return str(error)
