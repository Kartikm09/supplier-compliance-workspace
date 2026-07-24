# Supplier Compliance Workspace - Delivery Plan

## Objective

Build and verify an independent buyer-and-supplier collaboration reference
implementation with relationship-based authorization, versioned qualification
programs, private evidence, assessment review, findings, corrective actions,
decisions, reminders, and auditability.

## Delivery phases

| Phase | Work | Exit gate |
| --- | --- | --- |
| 1. Foundation | Monorepo, contracts, local Supabase configuration, CI | Install, format, and static checks run locally |
| 2. Data and security | Relational model, constraints, RLS helpers, field-safe views, private Storage | pgTAP buyer, supplier, and cross-relationship tests pass |
| 3. Versioned qualification | Program versions, questions, requirements, assessments, response snapshots | Immutability and version-locking tests pass |
| 4. Collaboration workflow | Invitations, uploads, submissions, reviews, findings, corrective actions, decisions | State and authorization tests pass |
| 5. Processing | Document metadata, text-PDF handling, risk rules, reports, queues, reminders | Pytest and deterministic fixture tests pass |
| 6. Product UI | Buyer and supplier portals, program builder, assessment, documents, review, findings, decision | Vitest and role-visibility tests pass |
| 7. End-to-end QA | Reproducible fictional scenario, browser tests, screenshots, security review | Full scenario and confidentiality-denial tests pass |
| 8. Deployment | Dedicated Supabase project, Edge Functions, web/API deployment where authenticated | Hosted smoke checks pass or exact provider blocker is recorded |
| 9. Publication | Secret scan, documentation reconciliation, clean commits, GitHub repository | Public URL resolves and reports match reality |

## Quality gates

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
python -m pytest
supabase test db
deno test
docker compose build
```

No gate is marked complete from configuration alone. Results are recorded only
after commands are executed and inspected.

## Scope controls

- All companies, contacts, identifiers, questionnaires, and PDFs are fictional.
- Supplier evidence and generated reports use private Storage only.
- No OCR or paid AI service is required.
- Internal notes and risk calculations are separated from supplier-visible
  records at both query and policy boundaries.
- No billing change, paid service, or destructive operation is authorized.
- Hosted status is stated conservatively in `DEPLOYMENT_REPORT.md`.

## Completion evidence

- `TEST_REPORT.md` records commands, counts, failures, skips, and limitations.
- `SECURITY.md` records relationship-RLS, field confidentiality, Storage,
  dependency, and secret checks.
- `DEPLOYMENT_REPORT.md` lists only verified resources.
- `PORTFOLIO_NOTES.md` contains truthful interview-ready explanations.
