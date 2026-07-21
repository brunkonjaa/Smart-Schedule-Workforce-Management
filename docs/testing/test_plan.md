# Test Plan

This plan describes the checks used for the current Smart Schedule workflow. The important distinction is between automated route tests, local database checks, and manual browser evidence. They prove different things.

## Automated test result

The current Phase 4 local migrated database run passes:

```text
29 test suites passed
236 tests passed
Time: 48.662 seconds
```

This local run was completed on 21 July 2026 against migrations 001 to 027. Screenshot `139` remains the earlier 14-suite result and screenshot `176` remains the 19-suite checkpoint. Screenshot `186` records the new totals after the Phase 4 branch added the Populate-next-week contract suite.

The suites cover authentication, Admin, staff, leave, shifts, assignments, rota, Populate next week, password reset, password migration, shift swaps, Employee Summary, Audit Log, rate limiting, middleware, browser-output security, timezone behavior, database configuration and NodyChat HTTP/WebSocket boundaries. The test database needs all current migrations before the full suite runs.

Run it from `backend/`:

```powershell
npm test
```

Jest sets `NODE_ENV=test`. The environment loader then uses `backend/local-evidence.env`, so the local suite writes only to `smart_schedule_local`. A `DATABASE_URL` supplied by GitHub Actions still takes precedence, which keeps the CI PostgreSQL service separate as well.

Coverage is reproducible with:

```powershell
npm run test:coverage
```

The current backend result is 77.26% statements, 62.56% branches, 86.34% functions and 78.24% lines. `backend/jest.config.js` enforces minimum global thresholds of 70% statements, 55% branches, 80% functions and 70% lines. The detailed scope and limits are in [backend_coverage.md](backend_coverage.md).

## What is checked automatically

1. valid and invalid login
2. session lookup and logout
3. protected route `401` and wrong-role `403` responses
4. staff creation, duplicate email, update, active state, and validation
5. leave date validation, creation, approval, rejection, withdrawal, and ownership
6. shift validation, create, update, delete, and manager access
7. assignment creation, duplicate protection, leave, role, inactive staff, overlap, touching shift, weekly shift, and weekly hour rules
8. contract-hour warning output
9. rota week, department, staff visibility, and manager action behavior
10. password reset generic response, token expiry, single-use behavior, and manager request visibility
11. shift swap creation, past-shift rejection, open/targeted requests, target acceptance, manager approval/rejection, ownership, and conflict checks
12. NodyChat workplace membership, direct-room reuse, unread clearing, outsider denial/no insert, and self-conversation rejection
13. WebSocket cross-origin denial, unauthenticated denial, authenticated history, and closure after account deactivation
14. Admin invitation, passkey boundary, reviewer exception, final-Admin rule and session/passkey revocation
15. Employee Summary field selection, hours, future shifts, access events, print request and pagination
16. append-only Audit Log routes, stable pagination and role restrictions
17. PWA cache limits, output text insertion, CSP, CSRF, request-size errors, cookie settings and rate-limit groups
18. Ireland-local date boundaries, overnight shifts and both 2026 daylight-saving changes
19. Populate next week as a draft-only source pattern, including role, leave, conflict and weekly-limit rules before explicit approval

## Local database checks

Use `backend/local-evidence.env`, never the normal hosted `.env`, for reset or seed work:

```powershell
npm run local:evidence:check
npm run local:evidence:all
npm run db:seed:demo-history:reset
npm run db:seed:staff-history
```

The seed data has 24 Irish-named active staff across Bar, Floor, Kitchen, and Kitchen Porter. It creates Monday-Friday shifts, avoids double shifts in the same day, and gives the selected staff overview account twelve previous weeks.

## Manual workflow checks

1. manager logs in and checks the weekly rota
2. staff logs in and sees the full roster without manager edit actions
3. staff submits time off and the manager approves or rejects it
4. manager creates a shift and assigns a matching active staff member
5. the rota shows leave markers, filled shifts, department tabs, and the manager next-week draft
6. staff starts a future-shift swap, chooses a person or open request, and sees the shared request page
7. the target accepts and the manager approves the swap
8. forgot password creates a manager-visible request and a reset link in the configured email output
9. overview shows previous weeks worked, time off, swap requests, and the route back to the main rota
10. the footer opens its email and phone links when the pointer reaches the bottom reveal area

## Evidence rules

Screenshots belong under `assets/screenshots/tests/`, use one project-wide number sequence, and must not show passwords, connection strings, tokens, or unrelated browser tabs. Raw test-menu logs stay local unless a selected output is needed as report evidence.

## Current automated and live evidence

The GitHub Actions workflow completed successfully for baseline `main` commit `ca970a6c6ab8fdde93672630dead098f6bf0388c` in run `29860448346`. The workflow creates PostgreSQL 16, applies the migration chain, runs the coverage tests, checks production dependencies and uploads the coverage report. Screenshot `180` records the earlier PR-triggered Phase 1 to 3 run. The Phase 4 PR run is pending until this branch is pushed. The live manager/staff browser, keyboard and focus checks passed at 1920 x 855, 1024 x 768 and 390 x 844. Actual 200% Chrome zoom also passed at a measured 960 x 427 CSS viewport with device pixel ratio 2 and no page-level horizontal overflow. The manager assignment dialog rejected 17:00 to 10:00, returned focus to Start time and left the future rota cell OFF. The fresh hosted staff sign-in and rota, Time Off, swap, rota-history and NodyChat reads passed on 18 July 2026.

The warm hosted login page produced a valid mobile Lighthouse navigation result of 99 Performance, 91 Accessibility, 96 Best Practices and 90 SEO. That run exposed two invisible autofill-decoy inputs, a skipped heading level at the narrow layout and a missing meta description. Commit `4a67646a58982e58d542b9fbfba07c470f424b26` removed the decoys, connected the real fields to standard autocomplete purposes, corrected the heading and added the description. The post-fix desktop login snapshot then passed Accessibility at 100 and SEO at 100; Best Practices stayed at 96 because the deliberate unauthenticated `/api/v1/auth/me` request returns `401`. The manager Rota snapshot passed 17/17 Accessibility and 4/4 Best Practices checks. Two later navigation retries returned Lighthouse `NO_NAVSTART`, so they are recorded as trace failures rather than zero performance results and were not kept as evidence.

The hosted manager Rota also approved and saved 61 generated assignments for the following week; screenshot `145` records the saved confirmation and populated department view. The assignment dialog rejected a shift that overlapped or touched an existing shift; screenshot `146` records the conflict message before any change was saved.

Manager passkey registration reached Chrome's browser-managed WebAuthn confirmation prompt on the hosted application. Screenshot `147` records the relying-party domain, account and explicit Create/Cancel choice without exposing a credential or secret.
