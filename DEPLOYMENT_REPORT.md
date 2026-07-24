# Deployment Report

**Report date:** 2026-07-24  
**Application:** Supplier Compliance Workspace  
**Report status:** Pending implementation and independent hosted verification

## Current factual status

| Area | Status | Evidence |
| --- | --- | --- |
| Dedicated Supabase project | Pending verification | No project linkage or hosted inspection evidence is recorded in this repository slice |
| Database migrations | Not verified | Application migrations are outside this documentation scope |
| Database tests | Not run | No pgTAP result is recorded |
| Private Storage | Not verified | Bucket and policy state not inspected |
| Edge Functions | Not verified | Deployment and endpoint checks not performed |
| Queues and Cron | Not verified | Hosted queue and schedule state not inspected |
| Realtime authorization | Not verified | No hosted channel test recorded |
| FastAPI | Not deployed or verified in this slice | No public URL asserted |
| Frontend | Not deployed or verified in this slice | No public URL asserted |
| GitHub repository | Not verified in this slice | No public URL asserted |
| Security review | Design documented; execution pending | See [SECURITY.md](SECURITY.md) |
| Product test suite | Not run | See [TEST_REPORT.md](TEST_REPORT.md) |
| Documentation and fixtures | Locally validated | Standard-library integrity validator and Markdown lint; see [TEST_REPORT.md](TEST_REPORT.md) |

## Deployment URLs

| Resource | URL |
| --- | --- |
| Frontend | Pending verified deployment |
| FastAPI | Pending verified deployment |
| Supabase API | Intentionally omitted until deployment owner verifies configuration |
| GitHub | Pending verified publication |

Do not replace these entries with guessed URLs. A URL is added only after it
resolves and its expected protected and public behavior has been checked.

## Edge Functions

Target names:

- `create-supplier-invitation`
- `accept-supplier-invitation`
- `create-document-upload`
- `finalize-document-upload`
- `submit-assessment`
- `create-finding`
- `submit-corrective-action`
- `record-approval-decision`
- `get-signed-document-url`

Deployment status for every function is pending.

## Migration and seed status

- Hosted migration history: pending inspection
- Local clean reset: pending
- Fictional seed: pending execution
- Generated TypeScript types: pending
- Demo users: pending environment-controlled creation

## Verification still required

1. Record toolchain versions and commit hash.
2. Verify the dedicated Supabase project and local link.
3. Run clean local migrations and all pgTAP tests.
4. Deploy and test Edge Functions.
5. Verify private Storage and exact-resource signed URLs.
6. Verify queue retries, dead-letter behavior, and Cron reminders.
7. Build and test FastAPI container.
8. Build and scan the frontend bundle.
9. Run local and hosted E2E workflows.
10. Test cross-buyer, cross-supplier, private-field, and direct-URL denials.
11. Record only observed URLs and results.
12. Reconcile README status before public publication.

## Known deployment blockers

No external-provider blocker was tested in this documentation-only slice.
Deployment ownership must record whether authenticated frontend and FastAPI hosts
are available. Lack of an authenticated host is an acceptable documented
blocker; it is not permission to claim a public deployment.

## Release decision

**Not ready for a verified public release based on this report alone.**

The documentation is designed to support implementation and review, but it does
not substitute for application code, passing tests, secret scans, or hosted
smoke checks.
