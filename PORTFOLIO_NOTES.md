# Portfolio Notes

Supplier Compliance Workspace is an independent proof-of-work project. It is
not client work, is not used by real customers, and contains only synthetic
organizations, users, documents, and workflows.

## One-minute walkthrough

The application lets a buyer publish a qualification program, invite a supplier,
collect versioned responses and private evidence, review a submission, raise
findings, verify corrective actions, and record an approval decision. A supplier
sees only the shared relationship data intended for it. Buyer-internal notes,
risk calculations, and decision rationale remain protected.

The distinctive engineering problem is relationship-based access. A shared
assessment has two legitimate organizations with different permissions, while
every unrelated buyer and supplier must be excluded. PostgreSQL evaluates active
membership, organization type, relationship state, role, assignment, workflow
state, and field visibility.

## What I designed and implemented

- React buyer and supplier portals with role-aware navigation
- PostgreSQL relationship model, constraints, indexes, and state machines
- RLS policies and supplier-safe views
- versioned questionnaires, submissions, documents, risks, and decisions
- private Storage reservations and exact-record signed URLs
- eleven transactional Edge Functions
- private Realtime authorization and minimal Broadcast events
- durable queues, bounded retries, dead-letter handling, and Cron reminders
- FastAPI processing for CSV, PDF metadata, risk, and report generation
- pgTAP, Deno, Pytest, Vitest, Playwright, hosted, and Docker verification
- public web and dedicated Supabase deployment

## Interview-ready answers

### Why is this harder than ordinary tenant filtering?

An assessment belongs to a buyer-supplier relationship, not one simple tenant.
The buyer can review and decide; the supplier can answer and upload evidence.
Other suppliers connected to the same buyer must not see it. Access therefore
combines two organization identities, relationship status, role, assignment,
workflow state, and field confidentiality.

### How are internal fields protected?

RLS filters rows but cannot selectively hide columns. Base-table grants are
restricted and supplier-facing reads use views that remove internal notes,
scoring breakdowns, and decision rationale. Hosted tests query through real
supplier JWTs and verify the protected values are absent.

### How are private files protected?

Clients never submit an arbitrary path for signing. An Edge Function resolves a
document-version ID, verifies relationship access, and signs the server-recorded
private path for a short period. Upload reservations validate MIME type, size,
extension, checksum, and dates. Replacement creates a new immutable version.

### How does versioning work?

Publishing freezes a program version. An assessment retains the exact version it
started with, and submission creates a snapshot. Document replacement, risk
recalculation, and approval decisions append new records rather than rewriting
historical evidence.

### Why use both Edge Functions and FastAPI?

Edge Functions are suited to short, identity-sensitive commands near Supabase
Auth and PostgreSQL. FastAPI handles heavier reusable jobs such as CSV imports,
PDF extraction, deterministic risk calculation, and report generation. Durable
queues keep browser requests independent from worker duration.

### How were AI-assisted changes validated?

Generated code was treated as untrusted. I reviewed diffs, followed
authorization and data flows, ran type and format checks, reset the database,
executed positive and negative tests, inspected migrations and grants, tested
real hosted JWT sessions, scanned source and bundles for secrets, and verified
containers and the public application.

### What would change at production scale?

I would add malware scanning, managed email, formal retention and privacy
workflows, SIEM export, load-tested queue sizing, backup-restore drills, incident
response, SLOs, stronger document isolation, and an external authorization
review.

## Safe resume claims

- Built and deployed a synthetic multi-tenant supplier qualification reference
  application using React, FastAPI, PostgreSQL, and Supabase.
- Implemented relationship-based RLS, private versioned evidence, transactional
  workflows, durable jobs, private Realtime, and append-only audit history.
- Created 227 database tests plus Deno, Pytest, Vitest, Playwright, hosted, and
  Docker verification for cross-tenant access and workflow behavior.

## Safe application answer

I built Supplier Compliance Workspace as an independent public proof-of-work
project. It models a buyer inviting and qualifying suppliers through versioned
questionnaires, private evidence, findings, corrective actions, and decisions.
The key technical challenge was enforcing relationship-based access and hiding
buyer-internal fields from supplier users. I deployed the React app and a
dedicated Supabase backend, verified hosted Auth, RLS, Storage, Edge Functions,
and private Realtime, and documented that the FastAPI worker remains
container-verified but not publicly hosted.

## Honest limitations

- No real customer or external commissioning is claimed.
- FastAPI is not publicly deployed because no authenticated container provider
  was available.
- OCR, malware scanning, email delivery, load testing, and recovery exercises
  are not included.
- The public repository does not contain reusable demo passwords.
- The system is a portfolio reference implementation, not a compliance
  certification product.
