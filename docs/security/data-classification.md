# Data Classification

All current fixtures are synthetic. Classification still guides safe design and
prevents a portfolio implementation from normalizing poor handling practices.

## Classes

| Class | Definition | Examples | Handling |
| --- | --- | --- | --- |
| Public | Safe for unauthenticated publication | README, architecture diagrams, fictional feature descriptions | May be committed |
| Internal | Operational metadata with limited sensitivity | Status, safe event type, queue age | Authenticated access; bounded logs |
| Confidential | Organization or relationship business data | Responses, supplier profile, document metadata, findings | RLS, private API, no public URLs |
| Restricted | Security credentials or buyer-only information | Token hashes, internal notes, risk breakdown, service key | Narrow server access; redaction; never browser-visible |

## Field examples

| Data | Class | Supplier-visible? | Loggable? |
| --- | --- | --- | --- |
| Program title | Internal | Yes for invited relationship | Yes, if fictional and bounded |
| Questionnaire response | Confidential | Own relationship | No raw value |
| Document filename | Confidential | Own relationship | Prefer opaque ID |
| Document body | Confidential | Authorized exact object | No |
| Finding description | Confidential | Yes when supplier-facing | No raw text |
| Finding internal note | Restricted | No | No |
| Risk level summary | Confidential | Only if explicitly shared | Bounded code only |
| Risk scoring breakdown | Restricted | No by default | No |
| Invitation token | Restricted | One-time recipient only | Never |
| Invitation token hash | Restricted | No | Never |
| Signed URL | Restricted temporary capability | Exact authorized user | Never |
| Service credential | Restricted | No | Never |
| Correlation ID | Internal | Not normally shown | Yes |

## Data minimization

- Queue messages store opaque IDs, not business content.
- Realtime events contain identifiers and status, not record snapshots.
- Audit old/new values use an allowlist and redact protected fields.
- Analytics use aggregated counts where possible.
- Input and output summaries exclude document and free-text bodies.

## Fixture rules

- Use reserved/example domains or non-email labels.
- Use deterministic fake UUIDs.
- Mark documents "Demonstration Data."
- Avoid real tax IDs, registration numbers, addresses, phone numbers, and
  signatures.
- Never copy real client questionnaires or certificates.

## Retention

Retention policy remains pending. The design should separately define:

- operational data retention
- document retention
- audit retention
- queue and dead-letter retention
- generated report retention
- user-requested deletion and legal hold behavior

No automatic destructive cleanup should be enabled before policy and recovery
requirements are verified.
