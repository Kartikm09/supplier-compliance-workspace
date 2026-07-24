# Synthetic Fixture Catalogue

All fixture data is fictional, deterministic, and safe for a public portfolio.
It must not be represented as customer, employer, supplier, or production data.

## Scenario

| Party | Type | Role in scenario |
| --- | --- | --- |
| Apex Components Group | Buyer | Publishes and reviews Standard Supplier Qualification |
| Nova Plastics Ltd. | Supplier | Completes the primary qualification workflow |
| Greenline Packaging Works | Supplier | Proves cross-supplier isolation |
| Meridian Buyer Sandbox | Buyer | Proves cross-buyer isolation |

The scenario progresses from a missing required answer through submission,
document replacement, a finding, corrective action, conditional approval, and an
expiry reminder.

## Files

| File | Purpose |
| --- | --- |
| `identifiers.json` | Stable UUID registry shared across fixtures |
| `organizations.csv` | Fictional buyer and supplier organizations |
| `memberships.csv` | Personas and roles without credentials |
| `relationships.csv` | Buyer-supplier relationship states |
| `qualification_program_v1.json` | Published questionnaire and evidence requirements |
| `assessment_scenario.json` | Draft, failed submission, successful submission, and review states |
| `assessment_responses.csv` | Completed response values for the Nova assessment |
| `document_versions.csv` | Immutable evidence version history |
| `findings_and_actions.json` | Finding, timeline, and corrective action |
| `approval_and_risk.json` | Buyer-internal risk result and conditional decision |
| `queue_jobs.json` | Safe opaque background-job messages |
| `access_cases.json` | Expected allow/deny authorization cases |
| `supplier_import.csv` | CSV import, duplicate-detection, and validation cases |

## Determinism rules

- UUIDs do not carry credentials or security meaning.
- Timestamps use UTC and are fixed.
- Emails use the reserved `.invalid` domain.
- File contents are sourced from
  [`../sample-documents`](../sample-documents/README.md).
- No fixture contains a password, invitation token, signed URL, tax identifier,
  private key, or service credential.
- `expected_outcome` fields describe test assertions, not observed test results.

## Intended use

Fixtures may be loaded into local seed tooling, pgTAP setup, Pytest, Deno tests,
and Playwright scenarios. Tests should create Auth users from runtime
environment values and map them to the stable persona IDs rather than committing
passwords.

## Validation

JSON files must parse with a standard JSON parser. CSV files must have a stable
header and consistent field count. Referential integrity is checked by a local
documentation validation command and later by database constraints.
