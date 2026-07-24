# ADR 0001: Relationship-Based Authorization

**Status:** Accepted design  
**Date:** 2026-07-24

## Context

Buyer and supplier users collaborate on the same assessments and documents, but
unrelated suppliers connected to one buyer must remain isolated. Some fields are
buyer-only even when the row is shared.

## Decision

Authorize shared data through an explicit `supplier_relationship_id` plus active
membership, organization type, role, relationship status, and assignment. Enforce
row access in PostgreSQL. Enforce protected-column confidentiality through
restricted grants and supplier-safe views or controlled functions.

## Consequences

- Policies are more complex than single-tenant filtering.
- Shared tables need a direct, indexed relationship path.
- Negative RLS tests become a release gate.
- Supplier API contracts cannot expose buyer base-table shapes.
- Suspension can block access while preserving historical records.

## Alternatives considered

### Browser-selected organization only

Rejected because route state and hidden controls are not authorization
boundaries.

### Duplicate every shared record into buyer and supplier copies

Rejected because copies can diverge and weaken auditability.

### Service-only API with no database RLS

Rejected for this reference project because defense in depth and direct Supabase
reads are explicit goals. Elevated server code still receives independent
authorization checks.
