"""Validate documentation links and synthetic portfolio fixtures.

This validator uses only the Python standard library. It checks documentation
and fixture integrity; it does not test application behavior.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
import uuid
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"
SAMPLE_DOCUMENTS = ROOT / "tests" / "sample-documents"
ROOT_DOCUMENTS = (
    "README.md",
    "ARCHITECTURE.md",
    "SECURITY.md",
    "DATA_MODEL.md",
    "TESTING.md",
    "DEPLOYMENT.md",
    "DEPLOYMENT_REPORT.md",
    "TEST_REPORT.md",
    "PORTFOLIO_NOTES.md",
    "CHANGELOG.md",
)
MERMAID_TYPES = {
    "flowchart",
    "sequenceDiagram",
    "stateDiagram-v2",
    "erDiagram",
}


def github_slug(value: str) -> str:
    """Return the simple GitHub-style slug used by headings in this project."""

    normalized = unicodedata.normalize("NFKD", value).lower().strip()
    normalized = re.sub(r"[^\w\- ]", "", normalized)
    return re.sub(r"\s+", "-", normalized)


def validate_uuid_fields(value: Any, errors: list[str], path: str = "$") -> None:
    """Recursively validate fields named id or ending in _id."""

    if isinstance(value, dict):
        for key, item in value.items():
            child = f"{path}.{key}"
            if (
                (key == "id" or key.endswith("_id"))
                and item is not None
                and isinstance(item, str)
            ):
                try:
                    uuid.UUID(item)
                except ValueError:
                    errors.append(f"invalid UUID at {child}: {item}")
            validate_uuid_fields(item, errors, child)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            validate_uuid_fields(item, errors, f"{path}[{index}]")


def validate_json(
    json_files: list[Path], errors: list[str]
) -> dict[str, Any]:
    """Parse JSON fixtures and validate UUID-shaped fields."""

    parsed: dict[str, Any] = {}
    for path in json_files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            parsed[path.name] = data
            validate_uuid_fields(data, errors, path.name)
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    return parsed


def validate_csv(csv_files: list[Path], errors: list[str]) -> None:
    """Check CSV field counts, blank rows, and UUID-shaped columns."""

    for path in csv_files:
        with path.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.reader(handle))
        if not rows:
            errors.append(f"{path.relative_to(ROOT)} is empty")
            continue

        width = len(rows[0])
        for line_number, row in enumerate(rows[1:], 2):
            if not row or not any(field.strip() for field in row):
                errors.append(
                    f"{path.relative_to(ROOT)}:{line_number} is a blank record"
                )
            elif len(row) != width:
                errors.append(
                    f"{path.relative_to(ROOT)}:{line_number} has "
                    f"{len(row)} fields, expected {width}"
                )

        with path.open(newline="", encoding="utf-8") as handle:
            for line_number, record in enumerate(csv.DictReader(handle), 2):
                if not record or not any(
                    (item or "").strip() for item in record.values()
                ):
                    continue
                for key, item in record.items():
                    if (
                        key
                        and (key == "id" or key.endswith("_id"))
                        and item
                    ):
                        try:
                            uuid.UUID(item)
                        except ValueError:
                            errors.append(
                                f"{path.relative_to(ROOT)}:{line_number} "
                                f"invalid UUID in {key}: {item}"
                            )


def validate_markdown(
    markdown_files: list[Path], errors: list[str]
) -> Counter[str]:
    """Validate relative links, heading anchors, fences, and diagram types."""

    link_pattern = re.compile(r"!?(?:\[[^\]]*\])\(([^)]+)\)")
    mermaid_types: Counter[str] = Counter()

    for path in markdown_files:
        text = path.read_text(encoding="utf-8")
        if "\t" in text:
            errors.append(f"{path.relative_to(ROOT)} contains a tab")
        if text.count("```") % 2:
            errors.append(
                f"{path.relative_to(ROOT)} has an unbalanced code fence"
            )

        for block in re.findall(
            r"```mermaid\n(.*?)\n```", text, re.DOTALL
        ):
            diagram_type = block.splitlines()[0].split()[0]
            mermaid_types[diagram_type] += 1
            if diagram_type not in MERMAID_TYPES:
                errors.append(
                    f"{path.relative_to(ROOT)} has unknown Mermaid type: "
                    f"{diagram_type}"
                )

        for raw_target in link_pattern.findall(text):
            target = raw_target.strip().strip("<>")
            if target.startswith(("http://", "https://", "mailto:")):
                continue
            if target.startswith("#"):
                linked_path = path
                fragment = target[1:]
            else:
                file_part, separator, fragment = target.partition("#")
                linked_path = (path.parent / file_part).resolve()
                if not linked_path.exists():
                    errors.append(
                        f"{path.relative_to(ROOT)} has missing relative link: "
                        f"{raw_target}"
                    )
                    continue
                if not separator:
                    continue

            if fragment and linked_path.suffix.lower() == ".md":
                headings = [
                    github_slug(match.group(1))
                    for match in re.finditer(
                        r"^#{1,6}\s+(.+?)\s*$",
                        linked_path.read_text(encoding="utf-8"),
                        re.MULTILINE,
                    )
                ]
                if fragment not in headings:
                    errors.append(
                        f"{path.relative_to(ROOT)} has missing heading "
                        f"#{fragment} in {linked_path.relative_to(ROOT)}"
                    )

    return mermaid_types


def validate_document_sources(errors: list[str]) -> int:
    """Compare recorded source sizes and hashes to source files."""

    row_count = 0
    metadata_path = FIXTURES / "document_versions.csv"
    with metadata_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if not row or not any(
                (item or "").strip() for item in row.values()
            ):
                continue
            row_count += 1
            source = SAMPLE_DOCUMENTS / row["source_file"]
            content = source.read_bytes()
            if len(content) != int(row["source_byte_size"]):
                errors.append(f"{row['source_file']} size mismatch")
            if hashlib.sha256(content).hexdigest() != row["source_sha256"]:
                errors.append(f"{row['source_file']} SHA-256 mismatch")

    for source in sorted(SAMPLE_DOCUMENTS.glob("*")):
        if (
            source.is_file()
            and source.name != "README.md"
            and "DEMONSTRATION DATA"
            not in source.read_text(encoding="utf-8")
        ):
            errors.append(
                f"{source.relative_to(ROOT)} lacks demonstration marking"
            )
    return row_count


def validate_catalogue(
    parsed_json: dict[str, Any],
    json_files: list[Path],
    csv_files: list[Path],
    errors: list[str],
) -> int:
    """Check unique case keys and use of registered identifiers."""

    cases = parsed_json["access_cases.json"]["cases"]
    case_keys = [case["case_key"] for case in cases]
    if len(case_keys) != len(set(case_keys)):
        errors.append("access_cases.json contains duplicate case_key values")

    fixture_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in [*json_files, *csv_files]
        if path.name != "identifiers.json"
    )
    for group, values in parsed_json["identifiers.json"].items():
        for name, value in values.items():
            if value not in fixture_text:
                errors.append(
                    f"identifier {group}.{name} is not used outside the registry"
                )
    return len(case_keys)


def main() -> int:
    """Run all portfolio-slice validation checks."""

    errors: list[str] = []
    json_files = sorted(FIXTURES.glob("*.json"))
    csv_files = sorted(FIXTURES.glob("*.csv"))
    markdown_files = sorted(
        [ROOT / name for name in ROOT_DOCUMENTS]
        + list((ROOT / "docs").rglob("*.md"))
        + list((ROOT / "tests").rglob("*.md"))
    )

    parsed_json = validate_json(json_files, errors)
    validate_csv(csv_files, errors)
    mermaid_types = validate_markdown(markdown_files, errors)
    source_rows = validate_document_sources(errors)
    authorization_cases = validate_catalogue(
        parsed_json, json_files, csv_files, errors
    )

    print(f"JSON files parsed: {len(json_files)}")
    print(f"CSV files checked: {len(csv_files)}")
    print(f"Markdown files checked: {len(markdown_files)}")
    print(
        "Mermaid blocks checked: "
        f"{sum(mermaid_types.values())} ({dict(mermaid_types)})"
    )
    print(f"Source hash/size rows checked: {source_rows}")
    print(f"Authorization cases checked: {authorization_cases}")
    print(f"Validation errors: {len(errors)}")
    for error in errors:
        print(f"- {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
