# Backend Coverage Result

## Current run

I reran the coverage command on 21 July 2026 against the guarded local PostgreSQL database after migrations 001 to 027 were confirmed.

```powershell
npm run test:coverage
```

Jest sets `NODE_ENV=test`, so `backend/src/config/env.js` loads `local-evidence.env` for this local run. That keeps route and WebSocket test records in `smart_schedule_local` instead of the hosted Neon database. GitHub Actions supplies its own `DATABASE_URL`, which takes precedence over the local file.

The Phase 4 run passed 29 suites and 236 tests in 48.662 seconds with all four global thresholds active. Screenshot `139` is still evidence for the earlier 14-suite run and screenshot `176` is the later 19-suite checkpoint. Screenshot `186` records the exact Phase 4 rerun instead of relabelling either older result.

| Measure | Covered | Enforced minimum |
| --- | ---: | ---: |
| Statements | 77.26% | 70% |
| Branches | 62.56% | 55% |
| Functions | 86.34% | 80% |
| Lines | 78.24% | 70% |

The minimums are deliberately below the measured result rather than being set to a number the current suite cannot pass. They stop a large unexplained drop while still leaving the uncovered work visible.

## What the percentage means

Coverage applies to backend JavaScript under `backend/src/`, excluding `server.js` and operational scripts. It includes route, middleware, configuration and service modules. The migration runner is included and currently has no direct Jest coverage, so its zero result lowers the global percentage instead of being hidden.

The strongest covered service areas include assignments, rota, password reset, audit records and the main Admin account rules. The weaker areas are passkey failure branches, email-provider failures, some authentication/Admin validation branches, migration-runner branches and less common WebSocket message/error paths.

Coverage does not prove that a tested assertion is correct, that the browser layout works or that the hosted service behaves like localhost. It is used beside the 236 tests, migration checks, manual workflow evidence and dependency audit. It is not presented as a replacement for those checks.

## CI use

`.github/workflows/backend-checks.yml` creates a clean PostgreSQL 16 service, generates an isolated CI pepper, applies every migration, runs coverage, measures the four-operation Argon2id path and runs `npm audit --omit=dev`. Run `29860448346` passed on baseline `main` commit `ca970a6c6ab8fdde93672630dead098f6bf0388c`. Screenshot `180` records the PR-triggered Phase 1 to 3 run. The Phase 4 pull-request run is still pending until the branch is pushed, so the 29-suite result remains local evidence at this point.
