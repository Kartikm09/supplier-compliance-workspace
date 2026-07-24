# ADR 0003: Immutable Versioned Records

**Status:** Accepted design  
**Date:** 2026-07-24

## Context

A compliance decision must remain explainable after questionnaires, documents,
risk rules, and supplier answers change.

## Decision

Freeze published program versions. Lock each assessment to one version. Capture
each submission or resubmission as an immutable snapshot. Store every evidence
replacement as a new document version. Append new risk evaluations and approval
decisions rather than rewriting historical rows.

## Consequences

- Historical decisions can be reconstructed.
- Storage use grows and requires a retention policy.
- "Current" data is a projection over version history.
- Version allocation and supersession need transactional controls.
- Test fixtures must identify exact versions, not only logical resources.

## Alternatives considered

### Update records in place

Rejected because prior decisions would silently change meaning.

### Full database snapshot for every event

Rejected as unnecessarily expensive and difficult to query. Domain-level
snapshots preserve the relevant state with explicit lineage.
