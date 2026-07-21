# Phase 5 release record

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

- Source commit: pending until the Phase 5 commit exists.
- Pull-request workflow URL, duration and `backend-coverage` artifact: pending.
- Merged `main` commit and workflow: pending.
- Render-reported `releaseCommit`: pending.
- Neon status through migration `027`: pending until the target is checked again after deployment.
- Hosted login, JavaScript and CSS response check: pending.

These values stay pending until they actually exist. An older Phase 4 workflow or Render timestamp is not Phase 5 evidence.
