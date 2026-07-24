# Threat Model

> **Status:** Design-stage threat model. Controls require implementation and
> verification.

## Scope

Protected assets:

- organization membership and roles
- supplier relationships
- questionnaire responses and submission snapshots
- private evidence and generated reports
- buyer-internal notes and risk scoring
- findings, corrective actions, and decisions
- invitation tokens and signed URLs
- audit and queue metadata
- server credentials

Excluded from the portfolio scope:

- real supplier or customer information
- hostile malware-analysis workloads
- OCR
- legal certification
- payment processing
- production email delivery

## Actors

| Actor | Trust level | Security concern |
| --- | --- | --- |
| Anonymous visitor | Untrusted | Business-data discovery and token abuse |
| Authenticated viewer | Partially trusted | Mutation or relationship enumeration |
| Supplier contributor | Partially trusted | Cross-supplier access and buyer-internal disclosure |
| Buyer reviewer | Privileged within assignment | Unassigned review access and decision escalation |
| Organization owner/admin | Tenant privileged | Cross-tenant access remains denied |
| Edge Function | Elevated service | Confused deputy or unsafe arbitrary-resource action |
| FastAPI worker | Elevated service | Credential leakage or unrestricted document processing |
| Optional provider | External | Metadata leakage and availability |
| Developer/deployer | Operationally privileged | Secret handling and destructive migration risk |

## STRIDE analysis

### Spoofing

Threats:

- forged invitation acceptance
- stolen session
- worker endpoint impersonation

Controls:

- Supabase Auth validation
- short-lived, single-use invitation token
- server-only internal service credential
- secure cookie/token practices in the chosen Auth flow
- login and sensitive-command rate limits where supported

### Tampering

Threats:

- editing published questions
- overwriting accepted evidence
- rewriting a decision
- forging an audit event

Controls:

- database immutability triggers or grants
- new version per change
- controlled transactional functions
- ordinary-user audit mutation denied
- object hash and exact document-version metadata

### Repudiation

Threats:

- actor denies submitting, reviewing, or deciding
- asynchronous work loses origin context

Controls:

- actor and organization attribution
- correlation IDs across command, queue, worker, and audit
- immutable submission and decision records
- UTC timestamps generated server-side

### Information disclosure

Threats:

- Supplier Y reads Supplier X through shared buyer
- supplier reads buyer internal note or score
- public or overly broad signed URL
- secret appears in frontend bundle or logs

Controls:

- relationship-aware RLS
- supplier-safe result shapes and restricted base grants
- private Storage and exact-record URL signing
- browser environment allowlist
- structured redaction and generated-asset scan

### Denial of service

Threats:

- oversized upload
- parser resource exhaustion
- repeated queue retry
- expensive unindexed RLS query

Controls:

- byte, type, page, time, and output limits
- bounded retries and dead-letter routing
- indexed ownership paths
- conservative Cron batches
- provider and endpoint rate limits where supported

### Elevation of privilege

Threats:

- user assigns a higher role
- reviewer records final decision
- service credential turns endpoint into unrestricted proxy

Controls:

- controlled membership functions
- explicit action-role maps
- assignment and state checks in database transaction
- derive resource ownership server-side
- narrow `SECURITY DEFINER` and execute grants

## Abuse cases

### Guessing another relationship UUID

Expected outcome: no row returned or generic unauthorized response. The UUID
must not become an oracle revealing organization names.

### Asking to sign a foreign Storage path

Expected outcome: the API accepts a document-version ID, loads the authorized
record, and signs its stored path. A caller-supplied path is rejected.

### Accepting an invitation twice

Expected outcome: one transaction wins the row lock; the other receives an
already-used response without creating duplicate membership or relationships.

### Supplier querying buyer-internal columns directly

Expected outcome: base-table privilege is denied and supplier-safe contracts do
not include those columns.

### Replaying an expired signed URL

Expected outcome: Storage denies the URL after its short expiry. Revocation
before expiry is a known limitation to minimize with short TTLs.

## Verification ownership

| Control | Primary evidence |
| --- | --- |
| RLS and field grants | pgTAP |
| Edge token and signed URL behavior | Deno tests |
| Parser safety and limits | Pytest |
| Browser route/direct-URL denial | Playwright |
| Private Storage | pgTAP plus hosted requests |
| Realtime authorization | database/function tests plus hosted subscription |
| Secret absence | source and built-asset scans |
| Dependency risk | language-specific audit tools |

## Review triggers

Update this model when:

- a new organization role is added
- a protected field is added
- a new Storage bucket or path scheme is introduced
- a service begins processing a new file format
- an external provider is added
- a service-role operation is added
- a queue payload changes
- public sharing is proposed
