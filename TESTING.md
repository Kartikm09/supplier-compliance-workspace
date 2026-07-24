# Testing Strategy

> **Execution status:** Product tests are not yet available in this repository
> slice. The sections below define required coverage and commands. Actual
> commands, counts, failures, and skips must be written to
> [TEST_REPORT.md](TEST_REPORT.md) after execution.

## Quality model

The test strategy prioritizes:

1. authorization and confidentiality
2. workflow correctness and immutability
3. private-file controls
4. deterministic processing
5. role-appropriate user experience
6. deployment reproducibility

No frontend test can substitute for PostgreSQL authorization tests, and no unit
test can substitute for a hosted cross-tenant smoke test.

## Test layers

| Layer | Tool | Primary responsibility |
| --- | --- | --- |
| Database | pgTAP | Schema, constraints, helper functions, RLS, state transitions |
| Edge Functions | Deno test | Token flows, transactional commands, signed URLs, structured errors |
| FastAPI | Pytest | Import, document handling, risk, reports, internal auth, idempotency |
| Frontend | Vitest and React Testing Library | Routes, validation, role controls, safe rendering, failure states |
| End to end | Playwright | Complete buyer/supplier scenario and direct-access denials |
| Static quality | TypeScript, ESLint, Ruff, type checker | Type, style, and unsafe-pattern checks |
| Security | Secret and dependency scanners | Credential leakage and known vulnerable dependencies |
| Containers | Docker Compose | Build, startup, health, and environment separation |
| Hosted smoke | Playwright and API probes | Deployed Auth, RLS, Storage, functions, queues, and URLs |

## Test identities

Tests should create users from environment variables or local Auth setup:

| Persona | Organization | Role | Purpose |
| --- | --- | --- | --- |
| Apex owner | Apex Components Group | `BUYER_OWNER` | Programs, members, decisions |
| Apex admin | Apex Components Group | `BUYER_ADMIN` | Invitations and operations |
| Apex reviewer | Apex Components Group | `BUYER_REVIEWER` | Reviews, findings, verification |
| Nova owner | Nova Plastics Ltd. | `SUPPLIER_OWNER` | Relationship and final submission |
| Nova contributor | Nova Plastics Ltd. | `SUPPLIER_CONTRIBUTOR` | Responses and documents |
| Greenline contributor | Greenline Packaging Works | `SUPPLIER_CONTRIBUTOR` | Cross-supplier denial |
| Unrelated buyer | Fictional isolated buyer | `BUYER_VIEWER` | Cross-buyer denial |

No password belongs in fixtures or source control.

## Synthetic fixtures

[`tests/fixtures/README.md`](tests/fixtures/README.md) defines deterministic
fixture IDs and expected outcomes. Fixture groups include:

- organizations, memberships, and relationships
- program version, questions, options, and document requirements
- draft and submitted assessment data
- document metadata and replacement history
- findings and corrective actions
- approval, notification, and queue jobs
- denied cross-tenant access attempts

[`tests/sample-documents`](tests/sample-documents/README.md) contains source
material for generating safe text-based test PDFs. The source files are not
evidence of parser or PDF-generation success.

## Database tests

### Structure and constraints

- expected tables, columns, primary keys, and foreign keys
- valid role and status values
- organization-type consistency
- unique buyer-supplier relationship
- unique program-version and stable keys
- one response per assessment-question pair
- unique document-version number
- valid response type for each question
- sequential finding-number safety under concurrent attempts

### Versioning

- draft program definitions can be edited by authorized buyer roles
- published definitions reject insert, update, and delete changes
- new assessments use the active version
- existing assessments retain their original version
- submitted snapshots reject modification
- document replacement creates a new version
- risk recalculation creates a new evaluation
- decisions remain historically visible

### RLS and grants

For every applicable table and view, test:

- anonymous denial
- active buyer access to its own relationship
- unrelated buyer denial
- active supplier access to its own relationship
- unrelated supplier denial
- suspended relationship denial
- viewer read-only behavior
- reviewer assignment restrictions
- supplier contributor draft-edit boundary
- supplier denial for buyer-internal fields
- role-escalation denial
- direct audit mutation denial

Tests must exercise the same role and claims used by Supabase clients rather than
only calling helpers as a privileged database user.

### State transitions

- every legal transition
- every illegal backward transition
- stale-current-state conflict
- duplicate terminal action
- unauthorized actor
- audit event created in the same transaction
- rollback leaves no partial records

## Edge Function tests

Each function requires success, validation, unauthorized, cross-tenant, stale
state, duplicate, and safe-error tests where relevant.

| Function area | Required cases |
| --- | --- |
| Invitation | Authorized creation, unauthorized creation, expired token, invalid token, reused token, concurrent acceptance |
| Document upload | Correct relationship, wrong relationship, invalid MIME, oversized file, arbitrary path, finalize missing object |
| Assessment submission | Missing required response, missing document, wrong version, successful snapshot, duplicate submit |
| Finding | Assigned reviewer, unassigned reviewer, internal/supplier text separation, sequential number |
| Corrective action | Correct supplier, unrelated supplier, invalid finding state, duplicate submission |
| Decision | Authorized buyer, unresolved blocking finding, duplicate decision, supplier denial |
| Signed URL | Exact authorized version, cross-tenant denial, arbitrary-path denial, expired relationship |

Tests must assert that error responses do not expose token hashes, private paths,
internal notes, stack traces, or account-enumeration details.

## FastAPI tests

### Import

- supported CSV mapping
- unknown column handling
- duplicate supplier detection
- invalid rows reported without partial silent import
- deterministic dry-run result

### Documents

- valid small text-based PDF
- malformed PDF
- unsupported MIME type
- extension and signature mismatch
- size and page limit
- metadata and SHA-256
- expiry rule
- duplicate processing idempotency
- parser timeout or bounded failure
- no extracted text in logs

### Risk and reports

- deterministic risk score from fixture responses
- versioned calculation
- missing input behavior
- private scoring not returned through supplier-safe contract
- report contains demonstration marking
- report omits buyer-internal fields when supplier-safe variant is requested
- duplicate report job does not create duplicate versions

### Service boundary

- `/health`, `/ready`, and `/version`
- missing or invalid internal credential
- correlation ID propagation
- safe validation and error responses
- dependency timeout behavior

## Frontend tests

- protected routes and organization selector
- buyer versus supplier navigation
- role-based commands while preserving server-side enforcement
- program builder version state
- conditional question visibility
- response autosave and validation
- document upload/version status
- supplier view never renders internal fields
- finding response and decision summary
- loading, empty, stale, unauthorized, and error states
- keyboard navigation, labels, focus, and dialog behavior

## Playwright workflow

The critical E2E test should:

1. Sign in as an Apex buyer administrator.
2. Create or open the qualification program.
3. Publish version 1.
4. Invite Nova.
5. Accept as Nova.
6. Complete most responses.
7. Confirm incomplete submission is blocked.
8. Complete the missing response and upload documents.
9. Submit successfully.
10. Review as Apex and request document replacement.
11. Replace the document as Nova.
12. Raise a finding as Apex.
13. Submit corrective action as Nova.
14. Verify and conditionally approve as Apex.
15. Generate and authorize a private report.
16. Sign in as Greenline and attempt Nova direct URLs.
17. Confirm relationship, document, internal-note, and risk-score denial.

The run must use generated credentials held outside source control and clean up
only its own test data.

## Intended commands

Commands must be reconciled with actual project scripts before use:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e

services/api/.venv/bin/python -m pytest services/api
services/api/.venv/bin/ruff check services/api

supabase start
supabase db reset
supabase test db
deno test --allow-env supabase/functions

docker compose build
docker compose up -d
docker compose ps
```

## Hosted verification

After deployment:

- exercise Auth with separate buyer and supplier sessions
- verify direct PostgREST cross-tenant requests fail
- verify private objects cannot be listed or downloaded across relationships
- verify exact signed URLs expire
- invoke each Edge Function against hosted data
- process at least one queue job and one scheduled reminder
- verify private Realtime subscription denial
- inspect built frontend assets for server secrets
- verify health and readiness endpoints
- confirm public URLs resolve

Local passing tests do not prove hosted configuration.

## Test-report rules

[TEST_REPORT.md](TEST_REPORT.md) must include:

- date, commit, and environment
- exact commands
- counts by layer
- failures and resolutions
- deliberate skips with reasons
- test duration where useful
- Docker and hosted status
- known limitations

Do not report:

- a configured workflow as passing CI
- a skipped hosted test as passing
- a created project as a deployed application
- a screenshot as functional verification
