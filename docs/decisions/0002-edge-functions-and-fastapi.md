# ADR 0002: Edge Functions and FastAPI

**Status:** Accepted design  
**Date:** 2026-07-24

## Context

The project requires both short identity-sensitive commands and heavier
document/report processing. Putting all work in the browser, database, or one
server runtime would blur security and operational boundaries.

## Decision

Use Supabase Edge Functions for short authenticated commands close to Auth,
PostgreSQL, and Storage. Use FastAPI workers for imports, document processing,
risk calculation, and report generation. Connect asynchronous work with durable
queues.

## Consequences

- Edge Functions re-use Supabase identity and issue short transactions.
- FastAPI keeps server credentials and parsing libraries outside the browser.
- Queue contracts require versioning and idempotency.
- Two runtimes require shared contracts and coordinated observability.
- Ordinary CRUD should not be duplicated in FastAPI without a security or
  processing reason.

## Alternatives considered

### Edge Functions only

Rejected because document parsing and report generation can exceed practical
request/runtime limits and need Python libraries.

### FastAPI only

Rejected because one-time invitation, signed URL, and submission commands benefit
from close integration with Supabase Auth and transactional database functions.

### Synchronous processing

Rejected because user requests would own long-running, retryable work and become
harder to recover safely.
