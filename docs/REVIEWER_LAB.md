# Local supplier reviewer laboratory

This additive module reuses the repository's React/TypeScript, Vite, FastAPI and
synthetic supplier domain. It is separate from the deployed Supabase application.
The local HTTP server enforces the lab's role/tenant/state policies. These checks
do not reverify hosted Supabase RLS, identity providers, Storage or Edge Functions.

All fixture identities, companies, notes and decisions are public synthetic test
data. Fixture identity selectors are not secure authentication. Bind both servers
to loopback and do not deploy this laboratory. Restarting its process resets state.
The existing production API does not import or mount these routes.

## Run

From the repository root, with Node 24 and Python 3.11+:

```sh
npm ci --ignore-scripts --prefix packages/contracts
npm ci --ignore-scripts --prefix apps/web
npm ci --ignore-scripts --prefix tests/e2e
python3 -m venv services/api/.venv
services/api/.venv/bin/pip install -e 'services/api[dev]'
```

In two terminals:

```sh
services/api/.venv/bin/uvicorn supplier_compliance_api.reviewer:app --host 127.0.0.1 --port 8011
npm run dev --prefix apps/web
```

Open `http://127.0.0.1:5174/reviewer.html`. The default contributor submits a
written assessment; the Apex reviewer approves it. A read-only persona cannot
mutate. Greenline can see its own private case and the public handbook, but not
Apex cases or private notes. Browser controls aid navigation; the API independently
checks identity, tenant, role, current version and legal state transition.

## Verification

See [the dated verification record](REVIEWER_VERIFICATION.md) for observed results and limits.

```sh
npm test --prefix apps/web
services/api/.venv/bin/pytest services/api
npm --prefix tests/e2e exec -- playwright install chromium
cd tests/e2e
npm exec -- playwright test --config playwright.reviewer.config.ts
```

Playwright starts fresh loopback servers itself. For pinned Linux browser and
font captures use the supplied Dockerfile:

```sh
docker build -f tests/e2e/reviewer.Dockerfile -t supplier-reviewer:playwright-1.61.1 .
docker run --rm --cap-drop=ALL --security-opt=no-new-privileges --pids-limit=512 \
  --shm-size=1g -v "$PWD:/repo" -w /repo supplier-reviewer:playwright-1.61.1 \
  sh -c 'npm ci --ignore-scripts --prefix packages/contracts && npm ci --ignore-scripts --prefix apps/web && npm ci --ignore-scripts --prefix tests/e2e && python3 -m venv services/api/.venv && services/api/.venv/bin/pip install -e "services/api[dev]" && cd tests/e2e && npm exec -- playwright test --config playwright.reviewer.config.ts'
```

No Docker socket, host credentials, browser profiles or additional directories
are mounted. This is reproducible isolation for trusted synthetic fixtures, not a
hardened environment for hostile submissions.

## Three executable tasks

| Task | Regression and acceptance | Implementation |
| --- | --- | --- |
| T1 stale evidence | The first response is held by an explicit gate; selecting the second case must remain stable when the first completes. Component coverage also uses a transport that ignores cancellation. | `apps/web/src/reviewer/ReviewerLab.tsx`, component test and Playwright T1 |
| T2 accessible approval | Missing evidence produces a labelled error and retains draft state; keyboard submission restores heading focus; a reviewer approves; API calls reject other roles, stale versions and other tenants. | Reviewer component, `services/api/tests/test_reviewer.py`, Playwright T2 |
| T3 derived state | Index 1,000 records once, preserve reference identity and avoid repeated searches. Operation counts are deterministic and are not timing benchmarks. | `indexEvidence`, component test T3 |

The React tests use an injected transport to control response ordering. API and
Playwright authorization tests call the real local ASGI/HTTP implementation.
These test layers are reported separately.

## Visual and legacy evidence

Screenshots are captured at 1920×1080, 1440×900 and 390×844, with Playwright
1.61.1 Chromium, en-GB, UTC, a fixed 2026-09-18T09:00:00Z clock, reduced motion,
and bundled Liberation Sans from the pinned Ubuntu image (unmodified SIL OFL 1.1 fonts with hashes and license in `apps/web/public/reviewer-fonts`). The captures select the untouched Nova safety draft and normalize the other sidebar case to approved through the authorized fixture API, so a screenshot-only run does not depend on the approval test. Captures are stored under platform-specific
`docs/screenshots/reviewer/darwin-arm64/`, `linux-arm64/` or `linux-x64/`; baselines are never shared across platforms. They are real browser
captures of this local fixture, not screenshots of the hosted app. The dimensions
identify the viewport; the small viewport is intentionally scrollable vertically.

`/legacy-review.html` is runnable HTML/CSS. Its expected-negative `?variant=no-op`
keeps the visual button while preventing a state change. The browser compares its initial screenshot bytes with the working fixture and requires identical pixels before checking the failed action. `?variant=screenshot`
replaces the interface with a labelled SVG image that lacks buttons and headings.
The verifier observes those failures as expected negative cases. Similar pixels
cannot establish semantic controls, keyboard accessibility or working actions.
Visual fidelity, semantic behavior and construction are separate dimensions;
this suite does not turn a visual match into an accessibility certification.

## Rendering comparison

Run `node scripts/reviewer-render-lab.mjs --generate` once to generate the static markup artifact. Then `node scripts/reviewer-render-lab.mjs` serves `/render/ssr`, `/render/csr` and `/render/ssg`
on loopback port 5188. React's supported server and client APIs demonstrate:

- SSR computes the initial markup for each request and hydrates it.
- CSR sends an empty root, then creates its content in the browser.
- SSG reads the saved markup from the separate generation command and hydrates it.
  The browser test server injects Vite development scripts; it is not a production static host.

Playwright inspects initial HTTP HTML separately from rendered behavior, clicks
the counter and checks for client errors. The `X-Server-Renders` response header
makes server render counts inspectable. No framework migration is required.

## Decisions

1. **Keep deployment separate:** add an explicit local entry rather than introducing
   insecure fixture selectors into hosted routes. Trade-off: no claim of hosted
   authorization verification from this suite.
2. **Cancel and invalidate obsolete loads:** abort saves transport work; an active
   lifecycle guard also protects against transports that complete after cancellation.
   A case/identity key isolates draft state. Trade-off: a deliberate case change
   discards that panel's unsaved draft.
3. **Index immutable evidence:** a memoized index changes only when the returned
   case list changes, so repeated search/selection renders reuse the active-case lookup. The trade-off is O(n) storage. The 1,000-record test counts 500,500 key reads for repeated linear searches and exactly 1,000 for indexing; it is
   deterministic work evidence and does not claim a universal wall-clock speedup.

## Interview prompts

1. Why is cancellation alone insufficient to prevent stale data from rendering?
2. Which backend checks must be repeated even if the UI hides an approval button?
3. How do version checks distinguish a stale approval from a valid retry?
4. Which accessibility assertions cannot be inferred from a screenshot?
5. What differs between server HTML, hydration and a client-only initial render?
