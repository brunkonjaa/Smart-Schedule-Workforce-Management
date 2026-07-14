# Smart Schedule

Smart Schedule is a hospitality workforce management app for building a weekly rota, keeping staff records, handling time off, and dealing with future shift swaps.

The main workflow is now the weekly rota. A manager creates shifts, assigns staff, and checks the warnings before the rota is used. Staff can view the full weekly roster, open their assigned shift menu, request a swap, and check their own history and leave requests.

## Current repo state

The working build includes:

1. plain HTML, CSS, and JavaScript frontend
2. Node.js and Express backend
3. PostgreSQL database and ordered SQL migrations
4. server-side sessions with `express-session` and `connect-pg-simple`
5. bcrypt password checking
6. manager and staff roles with backend authorization checks
7. staff create, list, edit, deactivate, and filter workflow
8. leave request submit, list, withdraw, approve, and reject workflow
9. shift create, edit, list, and delete workflow
10. assignment create, change, and remove workflow
11. hard checks for duplicate shifts, role mismatch, approved leave, inactive staff, overlapping or touching shifts, and weekly limits of five shifts or forty hours
12. contract-hour warnings when a save is allowed but goes above the staff contract
13. weekly rota with Bar, Floor, Kitchen, and Kitchen Porter tabs
14. manager rota actions and staff read-only rota access
15. rule-based recommendation results for one open shift
16. password reset request and single-use reset token flow
17. manager-only password request view
18. future shift swap request, target acceptance, and manager approval or rejection
19. audit writes for manager shift and assignment changes
20. demo seed data with Irish names, filled weekday shifts, and twelve previous weeks of history

The audit log has no viewing page yet. Hosted deployment and formal UAT evidence also still need a final pass. These are the remaining gaps, not missing foundation work.

## Important route groups

The backend is mounted under `/api/v1`:

1. `/auth` for login, logout, current session, password change, and password reset
2. `/staff` for manager staff management
3. `/leave-requests` for time off
4. `/shifts` for shift records and recommendations
5. `/assignments` for manager assignment changes
6. `/rota` for the weekly rota response
7. `/shift-swaps` for staff swap requests and manager decisions

## Local setup

From `backend/`:

```powershell
npm install
npm run db:migrate
npm start
```

The normal `.env` file is used by the backend. For safe local evidence work use `backend/local-evidence.env` and these guarded commands instead:

```powershell
npm run local:evidence:check
npm run local:evidence:all
npm run db:seed:demo-history:reset
npm run db:seed:staff-history
npm run local:evidence:start
```

The local evidence scripts refuse non-local database targets. The demo-history reset creates 24 active Irish-named staff records, weekday rota data, and the current/next week. The staff-history seed gives `alex.byrne@example.com` twelve previous worked weeks for the overview page.

## Testing

Run from `backend/`:

```powershell
npm test -- --runInBand
```

The current local database run has 13 suites and 84 passing tests. The test environment must have migrations `012` to `015` applied as well as the earlier schema files.

## Main project files

1. `backend/` - Express app, routes, services, migrations, tests, and local scripts
2. `frontend/` - shell, pages, services, and responsive styles
3. `database/migrations/` - ordered PostgreSQL schema and data changes
4. `docs/` - build notes, requirements, design, and testing records
5. `assets/screenshots/` - numbered project evidence

## Stack decisions

I kept the frontend plain because the workflows are easier to follow in this project without adding a framework. PostgreSQL was chosen over the earlier MySQL direction so the schema, hosted Neon database, and proposal use the same database story. Render remains the hosted app direction, with the free-tier limits accepted for this semester build.

## Deferred work

The current MVP does not include full automatic scheduling, payroll integration, a native mobile app, multi-branch support, POS integration, reports, or an audit viewing screen. I left these out because the rota, leave, assignment, password recovery, and swap workflow needed to be real first.
