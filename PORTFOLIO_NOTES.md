# Portfolio Notes

> Use only claims supported by the repository's current evidence. The project is
> an independent reference implementation, not client work or prior production
> deployment.

## One-minute walkthrough

Supplier Compliance Workspace is designed to show how a buyer and its suppliers
can collaborate on qualification without exposing unrelated tenants or
buyer-internal review information. A buyer publishes a versioned questionnaire
and evidence requirements. A supplier accepts an invitation, completes an
assessment, uploads private evidence, responds to findings, and receives a
decision. PostgreSQL remains the authorization boundary, Supabase handles Auth,
Storage, Edge Functions, Realtime, queues, and Cron, and FastAPI handles heavier
document and reporting jobs.

The technically distinctive part is relationship-based access. A supplier record
is not visible merely because a user belongs to some supplier organization. The
user must be an active member of the supplier on the exact buyer-supplier
relationship, the relationship must permit access, the user's role must permit
the action, and protected buyer fields must be excluded from the supplier result
shape.

## Why this project exists

The project demonstrates product and engineering reasoning for a common
enterprise workflow that combines:

- multi-party access control
- versioned requirements and evidence
- private document handling
- asynchronous processing
- auditable state machines
- field-level confidentiality
- reproducible test scenarios

It does not claim real customers, prior production operation, or external
commissioning.

## What was designed in this documentation slice

- buyer and supplier role model
- relationship-based authorization model
- target relational data model
- program, submission, document, risk, and decision versioning
- Edge Function and FastAPI responsibility split
- durable queue, retry, dead-letter, and Cron model
- private Storage and exact-resource signed URL model
- state machines and transaction boundaries
- threat model and security verification checklist
- layered test strategy
- deterministic synthetic fixtures
- deployment and rollback procedure

Application implementation and operational results require separate evidence.

## Interview-ready answers

### How does multi-tenant RLS work?

The intended policies start with `auth.uid()`, require active organization
membership, and then follow the record's indexed relationship to either the buyer
or supplier party. Role and assignment checks narrow mutation rights. Suspended
relationships stop ordinary access while preserving history. Critical commands
run transactionally so authorization, state validation, mutation, and audit
append succeed or fail together.

### Why is relationship access harder than `organization_id` filtering?

A shared assessment has two legitimate parties but very different permissions.
The buyer can review and decide; the supplier can answer and provide evidence.
Other suppliers connected to the same buyer must not see one another. The model
therefore combines two organization identities, relationship status, role,
assignment, workflow state, and field visibility rather than checking one tenant
column.

### How are buyer-internal fields protected?

RLS alone cannot hide selected columns. Supplier-facing reads should use
restricted grants and supplier-safe views or controlled functions that omit
internal notes, scoring breakdowns, and decision rationale. Tests must query
through the same API role and JWT claims used by the browser and assert that the
protected keys are absent, not merely null in the UI.

### How are private documents protected?

Documents use private Storage paths generated from authorized database records.
The client cannot ask the server to sign an arbitrary path. A function resolves
an exact document-version ID, verifies relationship access, then returns a
short-lived signed URL. Replacement inserts a new immutable version rather than
overwriting previously reviewed evidence.

### How does versioning work?

Publishing freezes a program version. An assessment keeps the exact version it
started with, and submission creates an immutable snapshot. Document replacement,
risk recalculation, and later decisions create new versioned records. This keeps
the evidence used for a historical decision reproducible.

### Why use both Edge Functions and FastAPI?

Edge Functions sit close to Supabase Auth and PostgreSQL for short,
identity-sensitive commands such as invitations, submission, findings, and
signed URLs. FastAPI handles longer server-side jobs such as CSV imports, PDF
metadata extraction, deterministic risk calculation, and report generation.
Queues connect the two so a browser request does not own a long-running job.

### How are retries made safe?

Queue messages carry opaque record IDs and correlation IDs. Consumers use a
visibility timeout, commit results before acknowledging, and enforce an
idempotency key based on the resource and operation version. Transient failures
retry with bounded backoff; permanent or exhausted failures become reviewable
dead-letter records.

### How would AI-assisted coding output be reviewed?

AI-generated changes would be treated as untrusted code. I would inspect the
diff, trace authorization and data-flow changes, run format and type checks, run
positive and negative tests, inspect migrations and grants, and verify the
hosted denial cases. A generated test suite or confident explanation is not
accepted as proof without executing it.

### What would change at production scale?

I would add formal retention and recovery objectives, stronger document
isolation and malware scanning, centralized secrets and audit export, load-tested
queue settings, operational alerting, managed email delivery, backup-restore
drills, privacy workflows, and a formal authorization review for each schema
change.

## Honest technical compromises

- OCR and active-content document processing are excluded.
- External email is optional; in-app notification records remain testable.
- Realtime carries minimal invalidation events, not authoritative state.
- Risk scoring is deterministic and transparent rather than dependent on a paid
  AI service.
- Local container isolation is not described as a hardened sandbox.
- Availability, throughput, and recovery targets remain undefined until measured.

## Safe claims today

- Designed a relationship-based authorization and data model for a fictional
  buyer-supplier qualification workspace.
- Documented versioned questionnaires, immutable submission snapshots, private
  evidence handling, findings, corrective actions, and decision workflows.
- Created a layered security and testing strategy with deterministic synthetic
  fixtures and explicit cross-tenant denial cases.

## Claims allowed only after verification

Do not use these until reports contain actual evidence:

- "Implemented and deployed"
- "RLS-protected"
- "All tests pass"
- "Production-ready"
- "Used by customers"
- "CI passing"
- "Secure document processing"
- "Live public application"

## Recruiter-facing project description

> Independently designed a multi-tenant supplier qualification reference
> platform using a React, FastAPI, PostgreSQL, and Supabase architecture. The
> design covers relationship-based authorization, versioned programs and
> evidence, private document workflows, findings, corrective actions, approval
> decisions, durable jobs, and explicit cross-tenant test scenarios. All data is
> synthetic, and implementation/deployment claims are made only after verified
> evidence is recorded.
