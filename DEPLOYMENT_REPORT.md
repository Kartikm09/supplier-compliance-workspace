# Deployment Report

**Report date:** 2026-07-24  
**Application:** Supplier Compliance Workspace  
**Status:** Public web and Supabase deployed; public FastAPI pending

## Verified resources

| Resource | Status | Location |
| --- | --- | --- |
| Public web application | Deployed and browser-tested | [supplier-compliance-workspace.zw386.chatgpt.site](https://supplier-compliance-workspace.zw386.chatgpt.site) |
| Supabase project | `ACTIVE_HEALTHY` | `supplier-compliance-workspace`, `eu-central-1` |
| Supabase project reference | Configured | `rtcsafigttuebpetaprz` |
| PostgreSQL migrations | Applied | 7 versioned migrations |
| Hosted pgTAP | Passed | 227 tests |
| Edge Functions | Deployed | 11 functions |
| Auth | Verified | Four environment-controlled fictional users |
| Private Storage | Verified | Evidence and report buckets are private |
| Private Realtime | Verified | Authorized Broadcast delivered; cross-tenant join denied |
| Queues and Cron | Schema deployed | Hosted worker completion blocked by missing public FastAPI |
| FastAPI image | Built and healthy | Local Docker only |
| GitHub repository | Public and verified | [Kartikm09/supplier-compliance-workspace](https://github.com/Kartikm09/supplier-compliance-workspace) |
| GitHub Actions | Passing | Web, API, database/Edge, and container jobs |
| Secret review | Passed | Standard and Sites source/build scans |

## Frontend deployment

- URL: [https://supplier-compliance-workspace.zw386.chatgpt.site](https://supplier-compliance-workspace.zw386.chatgpt.site)
- Access: public
- Saved Sites version: 1
- Deployed source: `48b87b2866cbf58c560533c4ce9a0d4f269c0fc8`
- Supabase Auth Site URL and callback allowlist: configured
- Edge Function allowed origin: configured for the public URL and local ports
- Hosted Playwright: 9 passed, 1 intentional desktop skip

## Supabase deployment

Hosted migrations provide:

- organization and relationship authorization
- versioned programs, assessments, responses, and evidence
- findings, corrective actions, risk evaluations, and decisions
- private buckets and Storage policies
- transactional state machines and audit history
- durable queues, retry metadata, dead-letter handling, and Cron schedules
- private Broadcast authorization and minimal change triggers
- supplier-safe views for protected fields

The hosted seed contains only Apex Components Group, Nova Plastics Ltd.,
Greenline Packaging Works, and other clearly fictional records. Passwords and
server credentials are environment-controlled and are not committed.

## Deployed Edge Functions

1. `create-supplier-invitation`
2. `accept-supplier-invitation`
3. `create-document-upload`
4. `finalize-document-upload`
5. `submit-assessment`
6. `create-finding`
7. `submit-corrective-action`
8. `record-approval-decision`
9. `get-signed-document-url`
10. `generate-assessment-report`
11. `process-queues`

## FastAPI status

No authenticated Render, Railway, Fly.io, or equivalent container provider was
available. The service is therefore not represented as publicly deployed.

Verified locally:

- 84 Pytest tests
- strict Ruff and mypy checks
- nonroot Python 3.11.13 image
- fixed `pip 26.1.2`
- healthy `/health`, `/ready`, and `/version`
- document, risk, CSV import, and PDF report processing

The hosted `INTERNAL_API_URL` is set to an explicit non-routable placeholder so
background jobs fail visibly and retain retry state rather than silently
pretending to complete.

## Security and test status

- Local pgTAP: 227 passed
- Hosted pgTAP: 227 passed
- Deno: 21 passed
- Pytest: 84 passed
- Vitest: 26 passed
- Local Playwright: 9 passed, 1 intentional skip
- Hosted Playwright: 9 passed, 1 intentional skip
- npm audit: 0 vulnerabilities
- pip-audit: 0 known third-party vulnerabilities
- Secret scan: 0 findings across 293 standard-build files and 296 Sites-build
  files
- Docker: API and web images built and reached healthy state

See [TEST_REPORT.md](TEST_REPORT.md) and [SECURITY.md](SECURITY.md).

## Remaining manual deployment step

1. Authenticate a container provider.
2. Deploy `services/api/Dockerfile`.
3. Store `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `INTERNAL_API_TOKEN` in the
   provider secret manager.
4. Replace the hosted `INTERNAL_API_URL` placeholder.
5. Rebuild the web app only if the public API base becomes browser-facing.
6. Run the complete hosted queue, report, and reminder workflow.

No billing change or paid service was accepted.
