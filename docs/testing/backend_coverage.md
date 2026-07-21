# Backend Coverage Result

Coverage shows which backend lines and branches the automated suite reached. It helps find untested paths, but it does not prove the business rule is correct or the browser is usable. I keep it beside route assertions, migration checks and manual evidence rather than treating the percentage as the whole test result.

## Current run

I reran the coverage command on 21 July 2026 against the guarded local PostgreSQL database after migrations 001 to 027 were confirmed.

```powershell
npm run test:coverage
```

Jest sets `NODE_ENV=test`, so `backend/src/config/env.js` loads `local-evidence.env` for this local run. That keeps route and WebSocket test records in `smart_schedule_local` instead of the hosted Neon database. GitHub Actions supplies its own `DATABASE_URL`, which takes precedence over the local file.

The final Phase 6 run passed 30 suites and 243 tests with all four global thresholds active. Screenshot `139` is the earlier 14-suite run, `176` is the 19-suite checkpoint, `186` records Phase 4, and `192` records the final gate. Keeping those numbers separate shows how the suite grew instead of making an older screenshot look current.

| Measure | Covered | Enforced minimum |
| --- | ---: | ---: |
| Statements | 77.43% | 70% |
| Branches | 62.65% | 55% |
| Functions | 86.75% | 80% |
| Lines | 78.41% | 70% |

The minimums are deliberately below the measured result rather than being set to a number the current suite cannot pass. They stop a large unexplained drop while still leaving the uncovered work visible.

## What the percentage means

Coverage applies to backend JavaScript under `backend/src/`, excluding `server.js` and operational scripts. It includes route, middleware, configuration and service modules. The migration runner is included and currently has no direct Jest coverage, so its zero result lowers the global percentage instead of being hidden.

The strongest covered service areas include assignments, rota, password reset, audit records and the main Admin account rules. The weaker areas are passkey failure branches, email-provider failures, some authentication/Admin validation branches, migration-runner branches and less common WebSocket message/error paths.

Coverage does not prove that a tested assertion is correct, that the browser layout works or that the hosted service behaves like localhost. It is used beside the 243 tests, migration checks, manual workflow evidence and dependency audit. It is not presented as a replacement for those checks.

## CI use

`.github/workflows/backend-checks.yml` creates a clean PostgreSQL 16 service, generates an isolated CI pepper, applies every migration, runs coverage, measures the four-operation Argon2id path and runs `npm audit --omit=dev`. Earlier baseline and Phase 4 runs remain in the evidence trail. The deployed Phase 5 merge passed run `29864800275` with 30 suites and 243 tests, and the Phase 6 source passed run `29867189927` with its coverage artifact. Both exact checkpoints passed the enforced thresholds.
