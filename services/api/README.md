# Supplier Compliance API

Internal FastAPI processing service for the Supplier Compliance Workspace. It handles
deterministic document inspection, supplier CSV normalization, questionnaire completeness,
versioned risk scoring, and demonstration assessment-report generation.

## Security boundary

- All processing endpoints require `X-Internal-Token`.
- Request bodies, document text, credentials, and authorization headers are never logged.
- PDF inputs are parsed as data only. Embedded content is never executed and OCR is intentionally
  unsupported.
- Generated reports are returned with `Cache-Control: no-store`; the platform integration must
  persist them only in private Supabase Storage.
- The in-process idempotency registry is a deterministic local adapter, not a durable queue.
  Production queue workers must use PGMQ message IDs and database-backed job records.

## Run locally

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
INTERNAL_API_TOKEN='replace-with-at-least-24-characters' \
  .venv/bin/uvicorn supplier_compliance_api.main:app --reload
```

## Verify

```bash
.venv/bin/ruff check .
.venv/bin/mypy src
.venv/bin/pytest
docker build -t supplier-compliance-api .
```

The OpenAPI document is available at `/docs`. Health, readiness, and version metadata are public;
all `/internal/*` routes are server-to-server only.

