# Backend Coverage Result

## Current run

I ran the coverage command on 20 July 2026 against the guarded `smart_schedule_local` PostgreSQL database after migrations 001 to 022 were confirmed.

```powershell
npm run test:coverage
```

Jest sets `NODE_ENV=test`, so `backend/src/config/env.js` loads `local-evidence.env` for this local run. That keeps route and WebSocket test records in `smart_schedule_local` instead of the hosted Neon database. GitHub Actions supplies its own `DATABASE_URL`, which takes precedence over the local file.

The screenshot `139` run passed 14 suites and 91 tests in 20.142 seconds with all four global thresholds active. The time is kept as evidence for that run, not as a fixed performance claim.

| Measure | Covered | Enforced minimum |
| --- | ---: | ---: |
| Statements | 72.99% | 70% |
| Branches | 57.63% | 55% |
| Functions | 81.67% | 80% |
| Lines | 73.61% | 70% |

The minimums are deliberately below the measured result rather than being set to a number the current suite cannot pass. They stop a large unexplained drop while still leaving the uncovered work visible.

## What the percentage means

Coverage applies to backend JavaScript under `backend/src/`, excluding `server.js` and operational scripts. It includes route, middleware, configuration and service modules. The migration runner is included and currently has no direct Jest coverage, so its zero result lowers the global percentage instead of being hidden.

The strongest covered service areas include assignments, rota, chat, password reset, audit records and security events. The weaker areas are passkey failure branches, email-provider failures, some authentication endpoints, migration-runner branches and less common WebSocket message/error paths.

Coverage does not prove that a tested assertion is correct, that the browser layout works or that the hosted service behaves like localhost. It is used beside the 91 assertions, migration checks, manual workflow evidence and dependency audit. It is not presented as a replacement for those checks.

## CI use

`.github/workflows/backend-checks.yml` creates a clean PostgreSQL 16 service, installs from `package-lock.json`, applies every migration, runs the coverage command and runs `npm audit --omit=dev`. The first remote run passed for commit `8ed7c28c1b7f3e33377dc1012378676f31ee0931` on 20 July 2026. It completed in 55 seconds and uploaded the coverage report. Screenshot `140` records the job steps and green result.
