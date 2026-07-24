# Architecture

> **Document status:** Target architecture. Components and flows described here
> require implementation and test evidence before they are marked operational.

## Architectural goals

The Supplier Compliance Workspace is designed around six constraints:

1. A record may be shared by exactly one buyer-supplier relationship.
2. The two parties have different permissions and different field visibility.
3. Published requirements and submitted evidence must retain history.
4. private documents must never rely on obscurity or public URLs.
5. Transactional business commands require server-side authorization.
6. Slow or retryable processing must not hold open browser requests.

## System context

```mermaid
flowchart TB
    BuyerTeam[Buyer organization team]
    SupplierTeam[Supplier organization team]
    App[Supplier Compliance Workspace]
    Mail[Optional email provider]
    GitHub[GitHub Actions]

    BuyerTeam -->|Programs, reviews, findings, decisions| App
    SupplierTeam -->|Profiles, responses, evidence, corrective actions| App
    App -->|Optional invitation and reminder delivery| Mail
    GitHub -->|Build, test, and deployment checks| App
```

An email provider is optional. Notification records remain testable without
external delivery.

## Component view

```mermaid
flowchart LR
    subgraph Browser
        Web[React application]
        Query[TanStack Query cache]
        Client[Supabase JS client]
    end

    subgraph Supabase
        Auth[Auth]
        Edge[Edge Functions]
        DB[(PostgreSQL)]
        RLS[RLS and controlled functions]
        Objects[(Private Storage)]
        Broadcast[Private Realtime Broadcast]
        Jobs[(PGMQ queues)]
        Scheduler[Cron]
    end

    subgraph Processing
        FastAPI[FastAPI service]
        Importer[CSV import]
        Docs[Document validation and extraction]
        Risk[Risk calculation]
        Reports[PDF report generation]
    end

    Web --> Query
    Query --> Client
    Client --> Auth
    Client --> DB
    Client --> Edge
    Client <--> Broadcast
    DB --> RLS
    Edge --> RLS
    Edge --> Objects
    Edge --> Jobs
    Scheduler --> Jobs
    Jobs --> FastAPI
    FastAPI --> Importer
    FastAPI --> Docs
    FastAPI --> Risk
    FastAPI --> Reports
    FastAPI --> DB
    FastAPI --> Objects
```

## Responsibility boundaries

| Component | Owns | Does not own |
| --- | --- | --- |
| React application | Navigation, accessible forms, drafts, query cache, role-aware controls | Authorization decisions, secret handling, arbitrary signed URLs |
| PostgreSQL | Relationships, RLS, constraints, immutable history, state transitions, audit records | Heavy PDF parsing or external delivery |
| Edge Functions | Authenticated commands, one-time tokens, exact-resource signed URLs, queue submission | Long-running document processing |
| FastAPI | Imports, deterministic validation, document metadata, text extraction, risk calculation, reports | Browser authentication UX or ordinary row CRUD |
| Queues and Cron | Durable handoff, retries, reminders, dead-letter routing | Business authorization without revalidation |
| Realtime | Small invalidation or status messages | Authoritative state or secret-bearing payloads |

## Authorization model

Access to relationship-owned data requires a valid path:

```mermaid
flowchart LR
    User[Authenticated user]
    Member[Active organization membership]
    Party{Buyer or supplier party?}
    Relationship[Active supplier relationship]
    Assignment[Optional reviewer or contributor assignment]
    Visibility[Row and field visibility]
    Allowed[Authorized operation]

    User --> Member
    Member --> Party
    Party --> Relationship
    Relationship --> Assignment
    Assignment --> Visibility
    Visibility --> Allowed
```

For example, a supplier user reading a finding must be an active member of the
supplier organization on that relationship. The finding must be supplier
visible, and buyer-internal fields must be absent from the supplier-facing query
shape. See
[relationship-authorization.md](docs/architecture/relationship-authorization.md).

## Core sequences

### Invitation acceptance

```mermaid
sequenceDiagram
    actor Buyer as Buyer admin
    actor Supplier as Supplier user
    participant Edge as Edge Function
    participant DB as PostgreSQL

    Buyer->>Edge: Create supplier invitation
    Edge->>DB: Verify buyer role
    Edge->>Edge: Generate token and hash
    Edge->>DB: Store hash, prefix, expiry, and audit event
    Edge-->>Buyer: Return one-time invitation link
    Supplier->>Edge: Accept token while authenticated
    Edge->>DB: Lock invitation and validate hash/expiry/status
    Edge->>DB: Create supplier membership and relationship atomically
    Edge->>DB: Mark invitation accepted and append audit events
    Edge-->>Supplier: Return relationship summary
```

The plaintext token is never persisted or logged.

### Document upload and processing

```mermaid
sequenceDiagram
    actor Contributor as Supplier contributor
    participant Edge as Edge Function
    participant Storage as Private Storage
    participant DB as PostgreSQL
    participant Queue as Document queue
    participant API as FastAPI worker

    Contributor->>Edge: Request upload for a requirement
    Edge->>DB: Verify relationship, role, type, and size
    Edge->>DB: Create pending document version
    Edge-->>Contributor: Return controlled upload information
    Contributor->>Storage: Upload exact object
    Contributor->>Edge: Finalize upload
    Edge->>Storage: Verify object metadata
    Edge->>DB: Mark uploaded and enqueue idempotently
    Edge->>Queue: Send document-version ID
    API->>Queue: Read with visibility timeout
    API->>Storage: Download exact private object
    API->>API: Validate, hash, and extract safe text metadata
    API->>DB: Mark ready or rejected
    API->>Queue: Archive success or retry failure
```

### Assessment submission and review

```mermaid
sequenceDiagram
    actor Supplier as Supplier admin
    participant Edge as Submit function
    participant DB as PostgreSQL
    actor Reviewer as Buyer reviewer

    Supplier->>Edge: Submit assessment
    Edge->>DB: Lock assessment
    Edge->>DB: Verify program version and active relationship
    Edge->>DB: Validate required responses and ready documents
    Edge->>DB: Persist submission snapshot and transition to submitted
    Edge->>DB: Create review task and audit event
    Edge-->>Supplier: Submission accepted
    Reviewer->>DB: Open assigned supplier-safe snapshot
    Reviewer->>DB: Record document review and buyer-internal notes
    Reviewer->>DB: Create finding through controlled command
```

### Finding, corrective action, and decision

```mermaid
sequenceDiagram
    actor Reviewer as Buyer reviewer
    actor Supplier as Supplier contributor
    participant Command as Controlled command
    participant DB as PostgreSQL
    participant Queue as Notification queue

    Reviewer->>Command: Raise supplier-visible finding
    Command->>DB: Allocate finding number and append audit atomically
    Command->>Queue: Enqueue supplier notification
    Supplier->>Command: Submit corrective action
    Command->>DB: Validate assignment and finding state
    Command->>DB: Transition to response_submitted
    Reviewer->>Command: Verify corrective action
    Command->>DB: Transition finding to verified
    Reviewer->>Command: Record conditional approval
    Command->>DB: Ensure blocking findings are resolved
    Command->>DB: Append immutable decision and assessment transition
```

## State machines

### Assessment

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> in_progress
    in_progress --> submitted
    in_progress --> withdrawn
    submitted --> under_review
    under_review --> changes_requested
    changes_requested --> resubmitted
    resubmitted --> under_review
    under_review --> approved
    under_review --> conditionally_approved
    under_review --> rejected
    draft --> withdrawn
    approved --> [*]
    conditionally_approved --> [*]
    rejected --> [*]
    withdrawn --> [*]
```

### Finding

```mermaid
stateDiagram-v2
    [*] --> open
    open --> response_required
    response_required --> response_submitted
    response_submitted --> verification_required
    verification_required --> verified
    verification_required --> rejected
    rejected --> response_required
    verified --> closed
    closed --> [*]
```

### Document version

```mermaid
stateDiagram-v2
    [*] --> pending_upload
    pending_upload --> uploaded
    uploaded --> processing
    processing --> ready
    processing --> rejected
    ready --> superseded
    rejected --> superseded
    superseded --> [*]
```

### Supplier relationship

```mermaid
stateDiagram-v2
    [*] --> invited
    invited --> active
    active --> suspended
    suspended --> active
    active --> terminated
    suspended --> terminated
    terminated --> [*]
```

Critical transitions should execute in a transaction that locks the current row,
verifies the actor and current state, writes related timeline or audit records,
and rejects duplicate terminal actions.

## Versioning and immutability

```mermaid
flowchart LR
    Program[Qualification program]
    V1[Program version 1 - published]
    V2[Program version 2 - draft]
    Assessment[Assessment locked to V1]
    Snapshot[Submission snapshot]
    Document[Logical document]
    D1[Document version 1]
    D2[Document version 2]

    Program --> V1
    Program --> V2
    V1 --> Assessment
    Assessment --> Snapshot
    Document --> D1
    Document --> D2
    D1 -. superseded by .-> D2
```

Published definitions, submitted snapshots, document versions, risk
evaluations, and approval decisions are historical records. New information is
appended with lineage rather than rewriting prior evidence.

## Queue architecture

| Queue | Producer | Consumer | Idempotency key | Dead-letter trigger |
| --- | --- | --- | --- | --- |
| `document_processing` | Finalize-upload command | FastAPI document worker | Document-version ID plus hash | Maximum processing attempts |
| `risk_recalculation` | Submission or relevant review change | FastAPI risk worker | Assessment ID plus calculation version | Repeated deterministic or transient failure |
| `report_generation` | Authorized report command | FastAPI report worker | Assessment ID plus decision version | Repeated generation or storage failure |
| `notification_delivery` | Domain commands and Cron | Notification worker | Notification ID | Maximum provider delivery attempts |

The target policy is:

- Messages become invisible during processing, not deleted on read.
- A successful worker archives or deletes the message only after committing the
  result.
- A failure records a bounded error summary and increments attempts.
- Transient errors use exponential backoff with jitter.
- Permanent validation failures move directly to a reviewable dead-letter
  record.
- Workers re-check authorization-relevant resource state before action.
- Correlation IDs connect queue, API, audit, and application logs.

Exact visibility timeouts and attempt limits must be set from measured worker
behavior and recorded in deployment configuration.

## Realtime design

Private topics:

- `buyer:{buyer_org_id}:relationships`
- `relationship:{relationship_id}:assessment`
- `relationship:{relationship_id}:findings`
- `organization:{organization_id}:notifications`

Broadcast payloads contain identifiers, event type, status, and timestamp only.
They exclude internal notes, risk breakdowns, document contents, signed URLs,
tokens, and full record snapshots. After reconnection, the web app invalidates
queries and refetches PostgreSQL-authoritative data.

## Failure handling

| Failure | Behavior |
| --- | --- |
| Invalid invitation token | Generic rejection without account enumeration |
| Incomplete assessment | Transaction aborted with field-safe validation details |
| Storage metadata mismatch | Version remains non-ready and is quarantined for review |
| Document parser failure | Bounded error recorded; content omitted from logs |
| Queue worker timeout | Message becomes visible for a later bounded retry |
| Realtime disconnect | UI marks stale state, reconnects, and refetches |
| Report upload failure | Report job retries without creating duplicate report versions |
| Authorization failure | Generic denial, structured audit signal where appropriate |

## Observability

Target logs are structured JSON with:

- event name
- service and version
- correlation ID
- resource type and opaque resource ID
- outcome and bounded error code
- duration

Logs must never include invitation tokens, signed URLs, passwords, service keys,
document contents, unrestricted questionnaire answers, or internal notes.

## Decisions

Architecture decisions are recorded in [`docs/decisions`](docs/decisions/README.md):

- Relationship-based authorization
- Edge Function and FastAPI responsibility split
- Immutable, versioned compliance records

## Known limitations

- This architecture is not implementation evidence.
- A Supabase project being available does not prove migrations, RLS, Storage,
  functions, Cron, queues, or Realtime are configured.
- PDF processing is restricted to small text-based demonstration files and is
  not a hardened malware-analysis sandbox.
- External email delivery is optional and not required for workflow tests.
- Scaling targets, availability objectives, and retention periods require actual
  load and operational data.
