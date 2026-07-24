# Documentation Index

This documentation describes the target design for Supplier Compliance
Workspace. It is intentionally separated from test and deployment evidence.

## Architecture

- [Relationship authorization](architecture/relationship-authorization.md)
- [Versioning and immutability](architecture/versioning-and-immutability.md)
- [Queue processing](architecture/queue-processing.md)

## Security

- [Threat model](security/threat-model.md)
- [Data classification](security/data-classification.md)

## Decisions

- [Architecture decision records](decisions/README.md)

## Operations

- [Reviewer workflow](operations/reviewer-workflow.md)
- [Queue and recovery runbook](operations/queue-recovery-runbook.md)

## Portfolio

- [Recruiter walkthrough](portfolio/recruiter-walkthrough.md)

## Screenshots

- [Capture requirements](screenshots/README.md)

## Validation

- [`validate_portfolio_slice.py`](validation/validate_portfolio_slice.py)
  checks fixture structure, UUIDs, source hashes, Markdown links, anchors, and
  diagram fences using the Python standard library.

The root documents remain authoritative for the overall
[architecture](../ARCHITECTURE.md), [security model](../SECURITY.md),
[data model](../DATA_MODEL.md), [testing](../TESTING.md), and
[deployment](../DEPLOYMENT.md).
