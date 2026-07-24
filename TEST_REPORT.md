# Test Report

**Report date:** 2026-07-24

**Deployed source commit:** `48b87b2866cbf58c560533c4ce9a0d4f269c0fc8`

**Data:** Synthetic demonstration fixtures only

## Summary

| Area | Environment | Passed | Failed | Skipped |
| --- | --- | ---: | ---: | ---: |
| PostgreSQL and RLS | Local clean reset | 227 | 0 | 0 |
| PostgreSQL and RLS | Hosted project | 227 | 0 | 0 |
| Edge Functions | Local Deno | 21 | 0 | 0 |
| FastAPI | Local Pytest | 84 | 0 | 0 |
| React | Local Vitest | 26 | 0 | 0 |
| Browser workflows | Local desktop and mobile | 9 | 0 | 1 |
| Browser workflows | Hosted desktop and mobile | 9 | 0 | 1 |
| Platform workflow | Local Supabase and API | 1 full flow | 0 | 0 |
| Hosted security smoke | Hosted Supabase | 1 focused flow | 0 | 0 |
| Documentation validator | Local | 1 | 0 | 0 |
| npm audit | Local | 1 | 0 | 0 |
| pip-audit | Local | 1 | 0 | 1 local package |
| Secret scan | Standard build | 293 files | 0 findings | 0 |
| Containers | Local Docker | 2 healthy images | 0 | 0 |

The single browser skip is intentional: the mobile-navigation assertion is
skipped in the desktop project and executed successfully in the mobile project.
`pip-audit` skipped only the repository's unpublished local package, which is
not available on PyPI; all third-party dependencies it could audit passed.
The separately packaged Sites build also passed a 296-file scan.

## Toolchains

| Tool | Verified version |
| --- | --- |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| TypeScript | 6.0.3 |
| Python | 3.12.13 locally; 3.11.13 container |
| PostgreSQL | 17.6 local |
| Supabase CLI | 2.109.1 |
| Deno | 2.9.4 |
| Docker | 29.6.2 |
| Git | 2.50.1 |

## Commands executed

```bash
make verify
npx --yes supabase@latest test db
npx --yes deno test --config supabase/functions/deno.json \
  --allow-env supabase/functions
services/api/.venv/bin/pytest services/api
npm test --prefix apps/web
npm test --prefix tests/e2e
node scripts/verify-platform.mjs
node scripts/verify-hosted.mjs
node scripts/check-secrets.mjs
services/api/.venv/bin/pip-audit --local
docker compose build
docker compose up -d
```

Hosted pgTAP used an SSL connection to the dedicated project. Hosted browser
tests used the public Sites URL and real hosted Auth sessions.

## What was exercised

### Database and RLS

- required schema, constraints, indexes, and safe helper functions
- program publication immutability and assessment version locking
- document version history and submission snapshots
- buyer, supplier, reviewer, contributor, and viewer permissions
- cross-buyer and cross-supplier isolation
- internal note and internal risk confidentiality
- role escalation prevention and suspended relationship behavior
- append-only audit events
- private Storage and Realtime authorization
- legal and illegal state transitions
- duplicate invitation and finding-number concurrency protections

### Edge Functions

- invitation creation and one-time acceptance
- document upload reservation, finalization, and exact-record signing
- assessment validation and transactional submission
- finding creation and corrective-action submission
- approval decision controls
- queue payload allowlists, secret redaction, and structured errors
- malformed input, unauthorized calls, and cross-tenant denial

### FastAPI

- supplier CSV mapping and duplicate detection
- PDF metadata and text extraction
- MIME and expiry validation
- deterministic risk scoring
- idempotent document, risk, and report jobs
- demonstration PDF generation
- internal endpoint authentication
- health, readiness, and version endpoints

### Browser

- buyer dashboard and complete qualification record
- supplier dashboard and assessment
- buyer-only fields absent from supplier views
- direct cross-tenant resource denial
- reviewer navigation and role-specific controls
- mobile navigation
- hosted screenshots for nine recruiter-facing states

## End-to-end workflow evidence

`scripts/verify-platform.mjs` completed the full local scenario: Auth,
invitation, acceptance, relationship RLS, private Realtime, incomplete
submission denial, evidence upload, queue processing, private signed URLs,
review, finding, corrective action, decision, report generation, and audit
history.

`scripts/verify-hosted.mjs` verified hosted Auth, anonymous denial,
cross-supplier RLS, buyer-internal field protection, Edge authorization,
private Storage, rejected private-channel access, and actual authorized
Broadcast delivery. Its temporary notification was removed in cleanup.

## Container evidence

- API and web build contexts excluded local dependencies and compiler state.
- API runs as an unprivileged user and reports `/health`, `/ready`, and
  `/version`.
- Nginx reports healthy and serves SPA deep links.
- The API image contains fixed `pip 26.1.2`.
- Both Compose services reached `healthy` and were stopped cleanly.

## Remaining limitations

- Hosted queue consumers cannot call FastAPI until a public container provider
  is authenticated and configured.
- External email delivery is intentionally absent; notification records are
  testable in-app.
- No load, chaos, backup-restore, malware-scanning, or OCR test is claimed.
- GitHub CI status is recorded separately after publication.
