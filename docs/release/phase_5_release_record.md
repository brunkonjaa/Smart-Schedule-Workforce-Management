# Phase 5 release record

This checkpoint connects one exact source tree to local PostgreSQL, GitHub Actions, Render and Neon. It exists because a successful page load does not identify which commit is actually running.

## Why this checkpoint exists

Phase 5 freezes the feature set and checks one source tree through local PostgreSQL, GitHub Actions, Render and Neon. I added one narrow operational field to `/health`: `releaseCommit`. Render already provides the deployed SHA through `RENDER_GIT_COMMIT`, but the app had no safe way to prove which build answered the request. The helper accepts only a full 40-character hexadecimal value. Local or malformed values return `null`.

This is not another scheduling feature. It is there because an HTTP 200 and a changed timestamp can show that a deployment happened, but neither one proves the exact Git commit.

## Local release gate - 21 July 2026

I checked the database target before each database action. `backend/.env` points to Neon, so I did not use it for the empty-database build. I loaded the ignored `backend/local-evidence.env`, confirmed its host was `localhost`, created a uniquely named temporary database, and removed that database after the check.

| Check | Result |
|---|---|
| Empty local PostgreSQL build | Migrations `001` through `027` applied in order |
| Empty database status | All 27 migration files reported `APPLIED`; no file was pending |
| Local evidence database | Already up to date through migration `027` |
| `npm run lint` | Passed |
| `npm test` | 30 suites and 243 tests passed |
| `npm run test:coverage` | 30 suites and 243 tests passed |
| Coverage | 77.43% statements, 62.65% branches, 86.75% functions and 78.41% lines |
| `npm run security:benchmark` | Four concurrent Argon2id operations passed; 19,456 KiB memory, time cost 2, parallelism 1 |
| `npm audit --omit=dev` | Zero known production dependency vulnerabilities |

Screenshot `189` records the fresh local rerun without a database URL, password, token or environment value.

The Phase 5 instruction mentions migrations `001` through `026`. The current repo also contains `027_allow_overnight_shifts.sql`, so stopping at `026` would leave the real project one migration behind. The release gate uses the current ordered chain through `027`.

## Exact checkpoint evidence

- Source commit: `a0303bc1677ad0d94aefb90ffd58facacbef1d30`.
- Pull-request workflow: run `29864595561` passed that exact SHA in 66 seconds and uploaded `backend-coverage`.
- Merged `main` commit: `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`.
- Merged workflow: run `29864800275` passed the merge SHA in 71 seconds and uploaded `backend-coverage`.
- Render-reported `releaseCommit`: `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`.
- Render root timestamp: `Tue, 21 Jul 2026 20:16:18 GMT`.
- Neon status: migrations `001` through `027` reported `APPLIED`, with no pending migration.
- Hosted login: fresh headless Edge context returned HTTP 200 and displayed the form, email input, password input and Sign in button with zero page errors.
- Hosted frontend: all 21 referenced JavaScript and CSS responses matched the files at merge `14e66cf`; `smart-schedule-static-v12` was still served.

Screenshot `190` records the exact pull-request workflow and artifact. Screenshot `191` records the merged workflow, exact Render SHA, Neon migration count, browser login result and frontend content comparison. The connection string, login details, cookies, tokens and secrets are omitted.

## Completion result

Phase 5 is complete. The merged commit `14e66cf` passed GitHub Actions and the hosted `/health` response reports the same full SHA while connected to the up-to-date Neon database. The evidence-only follow-up does not change `backend/`, so it does not replace that application deployment.
