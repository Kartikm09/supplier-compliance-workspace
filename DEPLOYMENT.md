# Deployment Guide

This guide describes the reproducible release path used by Supplier Compliance
Workspace. Verified outcomes are in [DEPLOYMENT_REPORT.md](DEPLOYMENT_REPORT.md).

## Environments

| Environment | Purpose | Data |
| --- | --- | --- |
| Local | Destructive reset, integration, and worker tests | Synthetic fixtures |
| Hosted portfolio | Recruiter demonstration | Synthetic seeded organizations |

The hosted portfolio is a reference implementation, not a customer production
system.

## Configuration

Commit only `.env.example`. Required variable groups are:

| Variable | Consumer | Sensitivity |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Web | Publishable |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Web | Publishable |
| `VITE_API_BASE_URL` | Web | Publishable |
| `SUPABASE_URL` | API and functions | Configuration |
| `SUPABASE_SECRET_KEY` | FastAPI | Secret |
| `INTERNAL_API_TOKEN` | FastAPI and queue dispatcher | Secret |
| `INTERNAL_FUNCTION_TOKEN` | Queue function | Secret |
| `ALLOWED_ORIGINS` | Edge and API | Configuration |
| `E2E_*_PASSWORD` | Test user setup | Secret |

## Local verification

```bash
cp .env.example .env
make setup
make db-start
make db-reset
make test
make build
node scripts/verify-platform.mjs
docker compose build
docker compose up -d
```

Verify the API endpoints:

```bash
curl --fail http://127.0.0.1:8001/health
curl --fail http://127.0.0.1:8001/ready
curl --fail http://127.0.0.1:8001/version
```

Stop services cleanly:

```bash
docker compose down
```

## Supabase rollout

1. Confirm the CLI is linked to the dedicated project.
2. Review migrations and run a clean local reset.
3. Run `supabase test db`.
4. Push migrations and inspect remote migration history.
5. Configure environment-controlled fictional Auth users.
6. Store function secrets through Supabase secret management.
7. Deploy each Edge Function.
8. Verify private buckets, queue definitions, Cron schedules, and Realtime
   authorization.
9. Run hosted pgTAP and `scripts/verify-hosted.mjs`.
10. Set the Auth Site URL and exact callback allowlist.

Never reset a hosted project or expose its database password.

## Web rollout

The production build includes only publishable browser values.

```bash
npm ci --prefix packages/contracts
npm ci --prefix apps/web
npm run build --prefix packages/contracts
npm run build:sites --prefix apps/web
node scripts/check-secrets.mjs
```

The validated source is committed, pushed to the Sites source repository,
packaged, saved as a version, and then deployed. After deployment:

1. confirm the root and SPA deep links return HTML
2. verify Auth redirects
3. run desktop and mobile Playwright against the public URL
4. recapture credential-free screenshots

## FastAPI rollout

Deploy `services/api/Dockerfile` only to an authenticated container provider.
Set secrets in the provider manager, never in image layers or source.

Required checks:

- container runs as the nonroot `app` user
- `/health`, `/ready`, and `/version` pass
- internal endpoints reject missing or invalid credentials
- Supabase service credentials remain server-only
- timeouts and resource limits are configured

After deployment, update `INTERNAL_API_URL` for Edge Functions and rerun the
hosted queue and report workflow. Until then, the placeholder URL is
intentionally non-routable.

## Rollback

- Redeploy the previous saved web version.
- Prefer forward-only corrective SQL migrations.
- Pause queue consumers without deleting messages.
- Preserve assessments, document versions, findings, decisions, and audit
  history.
- Never reset hosted data without explicit approval and a recovery plan.

## Release gates

- local and hosted pgTAP pass
- Edge, API, frontend, and browser tests pass
- private Storage and Realtime denial cases pass
- dependency and secret scans pass
- Docker images build and reach healthy state
- README, test report, and deployment report match observed reality
- no paid plan or billing change is accepted without approval
