# Test Plan

This plan describes the checks used for the current Smart Schedule workflow. The important distinction is between automated route tests, local database checks, and manual browser evidence. They prove different things.

## Automated test result

The current local migrated database run passes:

```text
14 test suites passed
91 tests passed
Time: 20.142 seconds
```

This local run was completed on 20 July 2026 against migrations 001 to 022. Screenshot `139` records the terminal result. It starts from final report-evidence commit `db2837c854291b8965c3f3e4b3d9b1cc9e018527` and includes the current quality pass: five NodyChat route/read-state tests plus four WebSocket authentication/lifetime tests.

The suites cover authentication, staff, leave, shifts, assignments, rota, password reset, shift swaps, rate limiting, middleware, database configuration and NodyChat HTTP/WebSocket boundaries. The test database needs all current migrations before the full suite runs.

Run it from `backend/`:

```powershell
npm test
```

Jest sets `NODE_ENV=test`. The environment loader then uses `backend/local-evidence.env`, so the local suite writes only to `smart_schedule_local`. A `DATABASE_URL` supplied by GitHub Actions still takes precedence, which keeps the CI PostgreSQL service separate as well.

Coverage is reproducible with:

```powershell
npm run test:coverage
```

The current backend result is 72.99% statements, 57.63% branches, 81.67% functions and 73.61% lines. `backend/jest.config.js` enforces minimum global thresholds of 70% statements, 55% branches, 80% functions and 70% lines. The detailed scope and limits are in [backend_coverage.md](backend_coverage.md).

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

## Still to do

The GitHub Actions workflow now defines a clean PostgreSQL 16 migration, coverage, test and production dependency-audit job. It cannot have a visible remote pass until this working tree is committed and pushed. The live manager/staff browser, keyboard and focus checks passed at 1920 x 855, 1024 x 768 and 390 x 844. Actual 200% Chrome zoom also passed at a measured 960 x 427 CSS viewport with device pixel ratio 2 and no page-level horizontal overflow. The manager assignment dialog rejected 17:00 to 10:00, returned focus to Start time and left the future rota cell OFF. The fresh hosted staff sign-in and rota, Time Off, swap, rota-history and NodyChat reads passed on 18 July 2026. A fresh hosted manager sign-in is still open because its current password is not stored in the project files.
