# Recruiter Walkthrough

## Five-minute path

1. Read the [30-second overview](../../README.md#30-second-overview).
2. Review the [target architecture](../../README.md#target-architecture).
3. Inspect the
   [relationship authorization model](../architecture/relationship-authorization.md).
4. Review [versioning and immutability](../architecture/versioning-and-immutability.md).
5. Open the [threat model](../security/threat-model.md).
6. Inspect the [synthetic fixture scenario](../../tests/fixtures/README.md).
7. Check [TEST_REPORT.md](../../TEST_REPORT.md) and
   [DEPLOYMENT_REPORT.md](../../DEPLOYMENT_REPORT.md) for actual evidence.

## What this slice demonstrates

- Product decomposition of a buyer-supplier compliance workflow.
- Awareness that shared rows can still contain party-private fields.
- Explicit state and version modeling.
- Security-first Storage and signed URL design.
- Durable background-job and retry reasoning.
- A test plan centered on negative authorization cases.
- Truthful separation between target design and completed evidence.

## Review questions

Technical reviewers may ask:

- How does Supplier X remain isolated from Supplier Y under the same buyer?
- How are buyer-internal columns excluded from supplier API results?
- What happens to an assessment when version 2 of a program is published?
- How is an evidence replacement linked to the reviewed prior version?
- What prevents duplicate invitation acceptance or duplicate queue results?
- Why are Edge Functions and FastAPI both present?
- Which claims are currently verified?

Answers are documented in [PORTFOLIO_NOTES.md](../../PORTFOLIO_NOTES.md).

## Current evidence boundary

At this stage, this repository slice proves documentation quality, architecture
reasoning, and synthetic fixture design. It does not yet prove executable RLS,
working uploads, passing tests, public deployment, CI, or production use.
