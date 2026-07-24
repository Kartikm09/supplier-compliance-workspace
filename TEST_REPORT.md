# Test Report

**Report date:** 2026-07-24  
**Scope:** Documentation and synthetic fixture slice  
**Product-test status:** Not run

## Summary

This report deliberately does not claim database, Edge Function, FastAPI,
frontend, E2E, Docker, CI, or hosted-test success. Those implementation areas
are outside the current documentation-only slice.

| Test area | Passed | Failed | Skipped or pending |
| --- | ---: | ---: | ---: |
| Database and RLS | 0 | 0 | All pending |
| Edge Functions | 0 | 0 | All pending |
| FastAPI | 0 | 0 | All pending |
| Frontend unit/integration | 0 | 0 | All pending |
| Playwright E2E | 0 | 0 | All pending |
| Docker | 0 | 0 | Build and startup pending |
| Hosted smoke | 0 | 0 | All pending |
| Documentation and fixture validation | 2 checks | 0 | 0 |

## Commands executed

### Portfolio-slice validator

```bash
python3 docs/validation/validate_portfolio_slice.py
```

Observed result:

```text
JSON files parsed: 7
CSV files checked: 6
Markdown files checked: 27
Mermaid blocks checked: 23
Source hash/size rows checked: 4
Authorization cases checked: 14
Validation errors: 0
```

The validator checks parsing, CSV shape, UUID syntax, registered identifier use,
source byte sizes and SHA-256 values, demonstration markings, relative links,
heading anchors, code-fence balance, and recognized Mermaid block types. It does
not render Mermaid or execute product code.

### Markdown lint

```bash
npx --yes markdownlint-cli2@0.20.0 \
  --config docs/.markdownlint-cli2.jsonc \
  README.md ARCHITECTURE.md SECURITY.md DATA_MODEL.md TESTING.md \
  DEPLOYMENT.md DEPLOYMENT_REPORT.md TEST_REPORT.md PORTFOLIO_NOTES.md \
  CHANGELOG.md 'docs/**/*.md' 'tests/**/*.md'
```

Observed result:

```text
markdownlint-cli2 v0.20.0 (markdownlint v0.40.0)
Linting: 27 file(s)
Summary: 0 error(s)
```

The check used the available local Node runtime. The command above is normalized
for portability; the repository should later pin its Node toolchain in root
configuration.

## Product quality gates pending

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
services/api/.venv/bin/python -m pytest services/api
supabase test db
deno test --allow-env supabase/functions
docker compose build
docker compose up -d
```

## Required result detail

When tests exist and execute, update this report with:

- toolchain versions
- commit hash
- exact commands
- individual suite counts
- durations
- failures and fixes
- deliberate skips and reasons
- Docker health evidence
- hosted environment evidence
- remaining risks

## Current limitations

- Documentation can be internally consistent while implementation differs.
- Synthetic fixtures have not yet been consumed by product code.
- No RLS policy, private bucket, function, queue, or Realtime channel is proven
  by this report.
- No public deployment is proven by this report.
- Mermaid blocks were structurally inspected but not rendered by a Mermaid CLI.
