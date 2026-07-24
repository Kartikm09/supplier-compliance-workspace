NODE_PATH ?= node
NPM ?= npm
PYTHON ?= python3
SUPABASE ?= npx --yes supabase@latest
DENO ?= npx --yes deno

.PHONY: setup format lint typecheck test build db-start db-reset db-test edge-test api-test web-test e2e docker-build verify

setup:
	cd packages/contracts && $(NPM) ci
	cd apps/web && $(NPM) ci
	$(PYTHON) -m venv services/api/.venv
	services/api/.venv/bin/pip install -e 'services/api[dev]'
	cd tests/e2e && $(NPM) ci

format:
	cd apps/web && $(NPM) run format
	$(DENO) fmt supabase/functions
	services/api/.venv/bin/ruff format services/api

lint:
	cd apps/web && $(NPM) run format:check
	cd apps/web && $(NPM) run lint
	$(DENO) fmt --check supabase/functions
	$(DENO) lint --config supabase/functions/deno.json supabase/functions
	services/api/.venv/bin/ruff format --check services/api
	services/api/.venv/bin/ruff check services/api

typecheck:
	cd packages/contracts && $(NPM) run typecheck
	cd apps/web && $(NPM) run typecheck
	$(DENO) check --config supabase/functions/deno.json supabase/functions/*/index.ts
	services/api/.venv/bin/mypy services/api/src

web-test:
	cd apps/web && $(NPM) test

edge-test:
	$(DENO) test --config supabase/functions/deno.json --allow-env supabase/functions

api-test:
	services/api/.venv/bin/pytest services/api

db-start:
	$(SUPABASE) start

db-reset:
	$(SUPABASE) db reset

db-test:
	$(SUPABASE) test db

e2e:
	cd tests/e2e && $(NPM) test

test: web-test edge-test api-test db-test

build:
	cd packages/contracts && $(NPM) run build
	cd apps/web && $(NPM) run build

docker-build:
	docker compose build

verify: lint typecheck web-test edge-test api-test build
	$(NPM) --prefix apps/web audit --audit-level=high
	$(PYTHON) docs/validation/validate_portfolio_slice.py
