# Test Plan

This plan describes the checks used for the current Smart Schedule workflow. The important distinction is between automated route tests, local database checks, and manual browser evidence. They prove different things.

## Automated test result

The current local migrated database run passes:

```text
13 test suites passed
84 tests passed
```

The suites cover authentication, staff, leave, shifts, assignments, rota, recommendation scoring/routes, password reset, shift swaps, rate limiting, middleware, and database configuration. The test database needs migrations `001` to `016` before the password-reset and shift-swap suites can run.

Run it from `backend/`:

```powershell
npm test -- --runInBand
```

For the local evidence database in PowerShell:

```powershell
$env:DOTENV_CONFIG_PATH='local-evidence.env'
node -r dotenv/config node_modules/jest/bin/jest.js --runInBand
```

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
10. recommendation eligibility, exclusions, scores, and route authorization
11. password reset generic response, token expiry, single-use behavior, and manager request visibility
12. shift swap creation, open/targeted requests, target acceptance, manager approval/rejection, ownership, and conflict checks

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
5. the rota shows leave markers, filled shifts, open shifts, and department tabs
6. staff starts a future-shift swap, chooses a person or open request, and sees the shared request page
7. the target accepts and the manager approves the swap
8. forgot password creates a manager-visible request and a reset link in the configured email output
9. overview shows previous weeks worked, time off, swap requests, and the route back to the main rota
10. the footer opens its email and phone links when the pointer reaches the bottom reveal area

## Evidence rules

Screenshots belong under `assets/screenshots/tests/`, use one project-wide number sequence, and must not show passwords, connection strings, tokens, or unrelated browser tabs. Raw test-menu logs stay local unless a selected output is needed as report evidence.

## Still to do

Hosted UAT and final cross-browser evidence still need a focused pass. The audit records exist for shift and assignment changes, but there is no audit viewing screen to test yet.
