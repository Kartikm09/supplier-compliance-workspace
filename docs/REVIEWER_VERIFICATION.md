# Reviewer verification — 18 September 2026

This is local synthetic evidence, not a hosted-service certification. The full
account inventory and raw campaign logs remain private.

Baseline commit: `709020679a847da2fb8e89c08f2953e325c8d913`.

| Check | Original baseline | Final local result |
| --- | --- | --- |
| API pytest | 84 passed | 94 passed |
| React component tests | 26 passed | 30 passed |
| Web formatting, ESLint, TypeScript and build | passed | passed |
| API Ruff formatting/lint and mypy | passed | passed (15 source files) |
| Dedicated Playwright lab | not present | 10 passed |
| Local Cloudflare Sites build | not run | passed |
| npm dependency audit | 12 advisories: 9 high, 3 moderate | 0 advisories |
| Secret scanner and documentation validator | passed | passed |

The browser run used Playwright 1.61.1, Chromium 149.0.7827.55 on macOS arm64,
a fresh isolated browser profile, bundled Liberation Sans fonts, en-GB, UTC,
reduced motion and the fixed fixture clock. Viewport captures and exact browser
metadata are in `screenshots/reviewer/darwin-arm64/`. The 390×844 detail image
shows the same page scrolled to its evidence panel. Platform baselines remain
separate. The four PNG hashes match between the full browser suite and a
separate screenshot-only run. No screenshot comparison threshold was loosened.

Native execution used a fresh HOME/environment and macOS Seatbelt file/network
restrictions; the browser received only loopback application URLs and a read-only
allowance for the matching cached browser runtime. Package lifecycle hooks were
disabled. Required native package archives were checked against lockfile SHA-512
integrity before extraction. This is an isolation measure for reviewed public
code, not an arbitrary hostile-code sandbox claim.

Docker validation initially stalled on this low-memory host. Concurrent native
runs also hit the existing five-second test timeout. The unchanged original suite
passed with one worker; final checks were run sequentially. No test timeout was
raised to hide these failures.

## Dependency repair

The audit identified pre-existing advisories. The direct fixes are
`react-router-dom` 7.18.4, `vitest` 4.1.11 and `@cloudflare/vite-plugin` 1.55.0;
compatible transitive fixes are recorded in the lockfile. The plugin retains
Vite 6/7/8 support. Its named local container-image feature is opt-in and the
repository configuration does not enable it. The normal and Sites builds both
passed; no deployment command was run.

Official release notes: [React Router](https://github.com/remix-run/react-router/releases/tag/react-router%407.18.4),
[Vitest](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11),
[Cloudflare Vite plugin](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare%2Fvite-plugin%401.55.0).

## Limits

The existing hosted E2E suite needs Supabase and runtime credentials and was not
run against the live site. Hosted identity, RLS, Storage and Edge behavior are not
established by the fixture API. Existing database/edge/container CI jobs remain
intact and their GitHub results must be checked before merge. The repository's
new reviewer job captures Linux browser evidence separately from these macOS
captures. The fixture identity selectors are public and are not authentication
for a deployed service.
