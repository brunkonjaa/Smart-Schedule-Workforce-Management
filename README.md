# Smart Schedule

Smart Schedule is the hospitality workforce management app I built for creating a weekly rota, keeping staff records, recording time off, and processing shift swaps.

The weekly rota is the main workflow now. I changed it this way because the earlier separate assignment and availability screens made ordinary rota work feel split up. A manager can work from the weekly table, open the actions for a shift, assign staff and check warnings. Staff see the full roster as well, but they do not get the manager assignment controls.

Hosted app: [Smart Schedule on Render](https://smart-schedule-workforce-management.onrender.com)

Render is using its free service tier, so the first load can take longer if the service has gone to sleep.

## Current build

The current build includes:

1. plain HTML, CSS and JavaScript frontend
2. Node.js and Express backend
3. PostgreSQL with ordered migrations `001` to `023`
4. Neon for the hosted database and Render for the live app
5. server-side sessions using `express-session` and `connect-pg-simple`
6. bcrypt password checking, login rate limiting and a passkey second step when a manager has registered one
7. manager and staff roles with the checks enforced again in the backend
8. manager-controlled staff account creation, editing, filtering and deactivation
9. leave request submit, list, withdraw, approve and reject workflow
10. shift create, edit, list and delete workflow
11. assignment create, change and remove workflow
12. hard assignment checks for duplicate shifts, role mismatch, approved leave, inactive staff, overlapping or touching shifts, and weekly limits of five shifts or forty hours
13. contract-hour warnings when an assignment can still be saved but goes above the staff member's contract
14. weekly rota tabs for Bar, Floor, Kitchen and Kitchen Porter
15. a full manager rota and a read-only staff rota, with the manager actions kept inside the shift menu
16. password reset requests and single-use reset links sent through Brevo on the hosted app
17. a manager password-request page that does not expose passwords or reset tokens
18. future shift swaps with target acceptance, manager approval, and a clearly marked demo workplace directions link
19. a manager audit-log page split into Rota activity and append-only Employee access records
20. serializable assignment transactions and a staff-week lock so two requests cannot quietly save conflicting assignment results at the same time
21. installable PWA files for supported phone browsers
22. demo seed data with 24 Irish-named staff, filled weekday shifts and twelve previous weeks of rota history
23. NodyChat with one `WORKPLACE` room, two-person `DIRECT` conversations, per-conversation unread state and session-authenticated WebSocket updates
24. a manager-only Employee Summary opened from Rota, Staff, Time Off, Swap Requests and reliable Audit Log employee links

Weekly availability submission was removed from the final workflow in migration `014_remove_weekly_availability.sql`. Staff should not have to fill in another weekly availability form just so the rota can be created. Approved leave, active status, role matching, shift overlap and weekly limits still stay in the assignment checks because those are the rules that stop an invalid rota being saved.

## Populate next week

`Populate next week` is available to managers from the rota. First it copies the current week's shift pattern into a preview for the next seven days. It then suggests eligible staff and shows any shifts it could not fill.

Nothing from this preview is saved straight away. The manager can check the suggestions first, try the population again, or approve the draft. This is useful for getting the next week started, but it is not full automatic scheduling and the manager is still responsible for the final rota.

## Current check

The pushed accessibility-fix checkpoint is `4a67646a58982e58d542b9fbfba07c470f424b26`, committed on 20 July 2026 at 19:11:49 +01:00. It includes the WebSocket lifetime tests, backend coverage thresholds, PostgreSQL-backed GitHub Actions workflow and the hosted Lighthouse corrections. The backend workflow is green for that pushed checkpoint.

The Employee Summary work is local and not pushed yet. Migration `023` only extends the allowed `audit_logs` action and entity values, so no staff or rota rows had to be rewritten. The current local run passes `116` tests across `16` suites. Evidence now reaches `154`, covering the desktop and mobile summary, selected and later shift grouping, the Employee access log, the A4 print layout, the silent staff denial and the reduced desktop Rota width. I also checked the panel at desktop, tablet and mobile sizes, including focus containment, exact Staff-page scroll return, session expiry, deliberate Logout and the fixed 25-record access pages.

The main code workflows and final report-supporting files are in place. The live manager/staff browser matrix passes at 1920 x 855, 1024 x 768 and 390 x 844, including invalid login, direct manager-route denial for staff, NodyChat focus/Escape and the rota modal focus trap. Chrome was also checked at a real 200% zoom level: the CSS viewport changed from 1920 x 855 to 960 x 427 and no page-level horizontal overflow appeared. A fresh hosted staff sign-in then loaded the rota, Time Off, swap, rota-history and NodyChat endpoints. The hosted login Lighthouse snapshot now passes Accessibility and SEO at 100 after the decoy inputs, heading order and meta description were corrected. Best Practices remains 96 because the public session check deliberately receives `401` when no user is signed in. The authenticated manager Rota snapshot passed every automated Accessibility and Best Practices check.

## Important route groups

The backend is mounted under `/api/v1`:

1. `/auth` for login, logout, current session, password change, password reset and passkeys
2. `/staff` for manager staff management and the protected Employee Summary/print-request routes
3. `/leave-requests` for time off
4. `/shifts` for manager shift records
5. `/assignments` for manager assignment changes
6. `/rota` for the weekly rota response
7. `/shift-swaps` for staff swap requests and manager decisions
8. `/audit-logs` for manager Rota activity and paged Employee access records
9. `/chat` for authenticated chat bootstrap, people, direct-conversation creation and message writes; live open/read/send updates use `/ws/chat`

## Local setup

Start from the repo root:

```powershell
Copy-Item .env.example backend/.env
Set-Location backend
npm install
npm run db:migrate
npm start
```

The values copied from `.env.example` are placeholders. Set the local PostgreSQL connection and a proper session secret before running the migration. Keep `backend/.env` out of Git.

## Local evidence setup

The local evidence workflow has its own environment file so it does not need to use the normal hosted or development database settings.

From `backend/`:

```powershell
Copy-Item local-evidence.env.example local-evidence.env
npm run local:evidence:check
npm run local:evidence:all
npm run local:evidence:start
```

`local:evidence:check` and the other `local:evidence:*` commands refuse a database URL that does not point to `localhost`, `127.0.0.1` or `::1`.

The larger demo-history scripts are separate. They use the normal backend environment, so check `DATABASE_URL` before running them:

```powershell
npm run db:seed:demo-history:reset
npm run db:seed:staff-history
```

The demo-history seed is blocked in production. It also refuses a remote database unless remote demo seeding was deliberately enabled.

## Testing

Run from `backend/`:

```powershell
npm test
```

The current local result is `16` passed suites and `116` passed tests. Screenshot `139` is still the earlier coverage run, so I have not relabelled it as evidence for the new tests. When Jest sets `NODE_ENV=test`, `backend/src/config/env.js` loads `local-evidence.env`, so the local suite uses `smart_schedule_local` instead of the hosted Neon database. An explicit CI `DATABASE_URL` still takes precedence. The test database needs migrations through `023_extend_audit_logs_for_employee_access.sql`. `employee-summary-routes.test.js` covers the manager response, staff denial, retained inactive staff, week totals, 30-day limit, history limits, audit events, print requests and access pagination. `employee-summary-frontend-contract.test.js` checks the route, manager-only links, focus/session rules, responsive sizes and A4 exclusions. The existing chat HTTP and WebSocket tests still run in the same full suite.

`npm run test:coverage` currently reports 72.99% statements, 57.63% branches, 81.67% functions and 73.61% lines. The enforced minimums and limitations are recorded in `docs/testing/backend_coverage.md`. `.github/workflows/backend-checks.yml` defines the same migration, coverage, test and production dependency-audit path for GitHub Actions.

## Main project files

1. `backend/` - Express app, routes, services, tests and local scripts
2. `frontend/` - page setup, frontend services and responsive styles
3. `database/migrations/` - ordered PostgreSQL schema and data changes
4. `docs/` - requirements, design notes, test planning and the project work trail
5. `assets/screenshots/` - numbered local and hosted evidence
6. `scripts/` - the updated Smart Schedule test menu

## Main decisions and limits

I kept the frontend plain because adding a framework this late would add another layer without fixing a rota problem. PostgreSQL was chosen over the earlier MySQL direction so the local database, Neon deployment and final database design all use the same system.

I removed weekly availability instead of carrying an unused page into the final build. On the other hand I kept leave, role matching, active-account checks and weekly assignment limits because the rota still needs those rules before a manager can trust the save.

The app does not include payroll, POS integration, multi-branch support, billing, a native mobile app or fully automatic rota publishing. Those are outside this semester build. `Populate next week` only prepares a rota draft for the manager to review, which was a more believable limit for the project than pretending the program could make every staffing decision on its own.
