# Deployment Guide

> **Status:** Target deployment procedure. No public URL or hosted application
> status is asserted here. Verified outcomes belong in
> [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md).

## Deployment principles

- Use a dedicated Supabase project for this application.
- Apply every database change through versioned SQL migrations.
- Run database and security tests locally before pushing hosted changes.
- Keep server secrets in provider-managed environment storage.
- Deploy frontend, Edge Functions, and FastAPI as separately verifiable units.
- Do not purchase or upgrade a service without explicit approval.
- Stop before any operation that could damage unrelated resources.

## Environment separation

| Environment | Purpose | Data |
| --- | --- | --- |
| Local | Development and destructive reset tests | Generated fictional data only |
| Preview | Pull-request UI/API checks where supported | Isolated fictional fixtures |
| Hosted portfolio | Stable recruiter demonstration | Fictional seeded organizations and users |

Production-like does not mean production-used. The public portfolio environment
must continue to be described as a reference implementation.

## Required tooling

- Node.js and npm versions pinned by repository metadata
- Python version pinned by service metadata
- Supabase CLI
- Docker with Compose
- Git
- authenticated Supabase CLI
- authenticated frontend host, if available
- authenticated container host, if available
- authenticated GitHub CLI, if publication is requested

Record exact versions in the deployment report.

## Environment variables

Only names and purpose belong in documentation:

| Variable | Consumer | Sensitivity |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Web | Publishable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Web | Publishable |
| `VITE_API_BASE_URL` | Web | Publishable |
| `SUPABASE_URL` | FastAPI and functions | Configuration |
| `SUPABASE_SECRET_KEY` | FastAPI only | Secret |
| `INTERNAL_API_TOKEN` | Edge/worker to FastAPI | Secret |
| `DEMO_BUYER_ADMIN_EMAIL` | Seed tooling | Private configuration |
| `DEMO_BUYER_ADMIN_PASSWORD` | Seed tooling | Secret |
| `DEMO_SUPPLIER_ADMIN_EMAIL` | Seed tooling | Private configuration |
| `DEMO_SUPPLIER_ADMIN_PASSWORD` | Seed tooling | Secret |
| `ALLOWED_ORIGINS` | Edge and API | Configuration |

Do not commit actual values. Prefer platform secret stores over plaintext files.

## Local rollout

The intended sequence, after implementation exists:

```bash
cp .env.example .env
supabase start
supabase db reset
supabase test db

npm ci
npm run format:check
npm run lint
npm run typecheck
npm test

python -m venv services/api/.venv
services/api/.venv/bin/pip install -r services/api/requirements-dev.txt
services/api/.venv/bin/python -m pytest services/api

docker compose build
docker compose up -d
```

Verify local Auth, database, functions, Storage, web, and FastAPI health before
hosted deployment.

## Supabase rollout

1. Confirm the linked project is dedicated to Supplier Compliance Workspace.
2. Compare local and remote migration histories.
3. Review SQL for destructive operations and grants.
4. Run local reset and pgTAP.
5. Push migrations.
6. Create private evidence and report buckets through migrations or documented
   idempotent setup.
7. Deploy shared Edge Function code and each function.
8. Store function secrets through Supabase secret management.
9. Configure durable queues and bounded consumers.
10. Configure low-frequency Cron reminders and cleanup.
11. Configure private Realtime authorization.
12. Generate TypeScript database types from the hosted schema.
13. Seed fictional data through controlled tooling.
14. Verify RLS and field confidentiality using real hosted user sessions.

Example command shapes:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --dry-run
supabase db push
supabase functions deploy
supabase gen types typescript --linked
```

The project reference and secrets must not be committed.

## FastAPI rollout

The target deployment is a container with:

- nonroot runtime user
- pinned dependencies
- health and readiness endpoints
- memory and CPU limits where supported
- server-only Supabase and internal credentials
- structured logs
- outbound timeouts

Verification:

```bash
curl --fail --silent "$API_URL/health"
curl --fail --silent "$API_URL/ready"
curl --fail --silent "$API_URL/version"
```

If no authenticated provider is available, build and run the image locally,
record the exact blocker, and do not claim a public API deployment.

## Frontend rollout

1. Build with publishable Supabase configuration only.
2. Scan generated assets for server credentials.
3. Deploy to an authenticated static host.
4. Configure Supabase Auth Site URL and approved redirects.
5. Set the allowed frontend origin in Edge and FastAPI configuration.
6. Test protected routes, refresh behavior, and organization switching.

```bash
npm --workspace apps/web run build
npm --workspace apps/web run preview
```

If no authenticated provider is available, retain a verified production build
and document the blocker.

## Queue and Cron rollout

Before enabling schedules:

- create queues idempotently
- set visibility timeout above expected worker duration
- set bounded maximum attempts
- configure dead-letter retention and review ownership
- ensure job payloads contain no protected content
- verify idempotency with duplicate messages
- use a conservative Cron frequency
- alert on growing queue age and dead-letter count

## Realtime rollout

- authorize private channel joins through database policy
- broadcast only minimal status events
- test buyer, supplier, unrelated party, and suspended relationship
- verify reconnect triggers authoritative refetch

## Storage rollout

- confirm buckets are private
- test list, upload, download, replacement, and delete separately
- verify exact-record signed URL generation
- verify arbitrary path and cross-relationship denial
- use short expirations
- inspect object paths for sanitized filenames and correct relationship IDs

## Release gates

Publication requires:

- local quality gates pass
- hosted RLS and private-field tests pass
- Storage and signed URL checks pass
- Edge, API, web, and E2E checks pass
- secret and dependency scans pass
- screenshots contain no credentials or signed URLs
- README status matches reality
- deployment and test reports are updated

## Rollback

### Application

- Redeploy the last verified frontend and API artifacts.
- Keep database migrations forward-only where possible.
- Disable a faulty Edge Function or Cron schedule without deleting historical
  data.

### Database

- Prefer a corrective migration.
- Do not reset or restore a hosted project without explicit approval and a
  verified backup plan.
- Preserve program versions, submitted snapshots, evidence versions, findings,
  decisions, and audit events.

### Queue

- Pause consumers.
- Preserve messages and dead-letter metadata.
- Fix idempotency or processing code.
- Replay only a bounded, reviewed set.

## Post-deployment smoke test

1. Sign in as buyer administrator.
2. Open the Apex dashboard.
3. Invite a supplier.
4. Accept as Nova.
5. Complete and submit an assessment.
6. Upload and retrieve an authorized private document.
7. Review, replace evidence, raise a finding, and submit corrective action.
8. Record a conditional approval.
9. Generate a demonstration report.
10. Confirm a reminder job creates a notification.
11. Confirm Greenline cannot access Nova data or files.
12. Confirm Nova cannot access buyer-internal fields.

Record evidence in [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md), not in commit
messages or unsupported claims.
