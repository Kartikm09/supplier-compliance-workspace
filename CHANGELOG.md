# Changelog

All notable changes to this independent reference project are documented here.
The format follows Keep a Changelog principles.

## [Unreleased]

### Added

- Dedicated hosted Supabase project with seven migrations.
- Relationship-aware PostgreSQL RLS and supplier-safe views.
- Versioned qualification programs, assessments, responses, documents, risks,
  and approval decisions.
- Private evidence and report buckets with exact-record signed URL functions.
- Eleven authenticated Edge Functions.
- Durable queues, bounded retries, dead-letter handling, and Cron jobs.
- Private Realtime Broadcast authorization and minimal change events.
- FastAPI document, import, risk, and PDF report processing.
- Buyer and supplier React portals with responsive role-aware navigation.
- 227 pgTAP tests, 21 Deno tests, 84 Pytest tests, 26 Vitest tests, and desktop
  and mobile Playwright workflows.
- Hosted RLS, Storage, Edge, Realtime, and browser verification.
- Genuine public-deployment screenshots.
- Docker images, GitHub Actions, secret scanning, and dependency audits.
- Public Sites deployment for the React application.

### Security

- Upgraded and pinned container `pip` to 26.1.2 and `setuptools` to 83.0.0
  after audit findings affected older build tools.
- Restricted supplier reads to protected views.
- Added neutral frontend handling for authorization and not-found errors.
- Excluded local dependencies and compiler metadata from Docker contexts.

### Known limitations

- Public FastAPI deployment awaits an authenticated container provider.
- Hosted queues retain work but cannot complete processing until that service is
  configured.
- External email, OCR, malware scanning, and load testing are outside this
  release scope.
