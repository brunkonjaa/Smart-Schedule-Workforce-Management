# Smart Schedule

Smart Schedule is the hospitality workforce management app I built for creating a weekly rota, keeping staff records, recording time off, and processing shift swaps.

The weekly rota is the main workflow now. I changed it this way because the earlier separate assignment and availability screens made ordinary rota work feel split up. A manager can work from the weekly table, open the actions for a shift, assign staff and check warnings. Staff see the full roster as well, but they do not get the manager assignment controls.

Hosted app: [Smart Schedule on Render](https://smart-schedule-workforce-management.onrender.com)

Render is using its free service tier, so the first load can take longer if the service has gone to sleep.

## Current build

The current build includes:

1. plain HTML, CSS and JavaScript frontend
2. Node.js and Express backend
3. PostgreSQL with ordered migrations `001` to `026`
4. Neon for the hosted database and Render for the live app
5. server-side sessions using `express-session` and `connect-pg-simple`
6. peppered Argon2id for new and changed passwords, with a silent upgrade after a correct legacy bcrypt login
7. separate Admin, Manager and Staff roles with the checks enforced again in the backend
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
19. a manager audit-log page split into 25-record pages for Rota activity and append-only Employee access records
20. serializable assignment transactions and a staff-week lock so two requests cannot quietly save conflicting assignment results at the same time
21. installable PWA files for supported phone browsers
22. demo seed data with 24 Irish-named staff, filled weekday shifts and twelve previous weeks of rota history
23. NodyChat with one `WORKPLACE` room, two-person `DIRECT` conversations, per-conversation unread state and session-authenticated WebSocket updates
24. a manager-only Employee Summary opened from Rota, Staff, Time Off, Swap Requests and reliable Audit Log employee links
25. a narrow Admin workspace for invitations, account state, session/passkey revocation and recent security events
26. normal Admin passkey setup, 30-minute idle/eight-hour absolute sessions, and protection against disabling the final active non-review Admin
27. one feature-flagged submission reviewer exception where password change and passkey setup stay available but optional for that account only

Weekly availability submission was removed from the final workflow in migration `014_remove_weekly_availability.sql`. Staff should not have to fill in another weekly availability form just so the rota can be created. Approved leave, active status, role matching, shift overlap and weekly limits still stay in the assignment checks because those are the rules that stop an invalid rota being saved.

## Populate next week

`Populate next week` is available to managers from the rota. First it copies the current week's shift pattern into a preview for the next seven days. It then suggests eligible staff and shows any shifts it could not fill.

Nothing from this preview is saved straight away. The manager can check the suggestions first, try the population again, or approve the draft. This is useful for getting the next week started, but it is not full automatic scheduling and the manager is still responsible for the final rota.

## Current check

The pushed accessibility-fix checkpoint is `4a67646a58982e58d542b9fbfba07c470f424b26`, committed on 20 July 2026 at 19:11:49 +01:00. It includes the WebSocket lifetime tests, backend coverage thresholds, PostgreSQL-backed GitHub Actions workflow and the hosted Lighthouse corrections. The backend workflow is green for that pushed checkpoint.

The Employee Summary work was pushed in `304a8c62b7c88c1ad2288f822849c87e359ad4cb`. Migration `023` only extends the allowed `audit_logs` action and entity values, so no staff or rota rows had to be rewritten. Evidence through `158` covers that work and the current Neon size/compute checks.

The Admin and pepper work is included in this source checkpoint but has not been deployed yet. Migrations `024` to `026` are applied to the guarded local database used by the test and evidence commands. Migration `026` keeps proper Irish names and changes the four original seed accounts to Gmail-format addresses with the deliberate `fake` marker. The current local run passes `144` tests across `19` suites, and `npm audit --omit=dev` reports zero known production dependency vulnerabilities. The four-operation local Argon2id measurement used 19,456 KiB, time cost 2 and parallelism 1. The measured batch was 85.7 ms for hashes and 97.0 ms for verification, with a 76 MiB observed peak RSS increase. That is local evidence only. GitHub Actions and the free Render instance still need their own measurements before the settings can be treated as hosted evidence.

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
8. `/audit-logs` for separately paged manager Rota activity and Employee access records
9. `/chat` for authenticated chat bootstrap, people, direct-conversation creation and message writes; live open/read/send updates use `/ws/chat`
10. `/admin` for administrator invitations, account state, passkeys, session revocation and sanitized security events

## Local setup

Start from the repo root:

```powershell
Copy-Item .env.example backend/.env
Set-Location backend
npm install
npm run db:migrate
npm start
```

The values copied from `.env.example` are placeholders. Set the local PostgreSQL connection, a proper session secret, the current password pepper version and its matching pepper environment variable before running the app. The first-Admin bootstrap value is temporary and should be removed after the fixed Admin account has been created and checked. Do not print any of these values. Keep `backend/.env` out of Git.

## Local evidence setup

The local evidence workflow has its own environment file so it does not need to use the normal hosted or development database settings.

From `backend/`:

```powershell
Copy-Item local-evidence.env.example local-evidence.env
npm run local:evidence:check
npm run local:evidence:all
npm run local:identity:audit
npm run local:evidence:start
```

`local:evidence:check` and the other `local:evidence:*` commands refuse a database URL that does not point to `localhost`, `127.0.0.1` or `::1`.

`local:identity:audit` checks the same guarded local database without printing credentials or setup values. The current result is 41 Irish-named demo identities using name-based Gmail-format addresses with `fake` in the local part, plus the one fixed owner account. It also fails if a person name is missing or an implementation label is used as a name.

The local chat and generated audit evidence can be cleared without touching Neon:

```powershell
npm run local:chat:reset
npm run local:audit:reset
```

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

The current local result is `19` passed suites and `144` passed tests. Screenshot `139` is still an earlier coverage run, so I have not relabelled it as evidence for this checkpoint. The test database needs migrations through `026_normalize_seed_account_addresses.sql`. `admin-routes.test.js` covers the separate role boundary, bootstrap, invitation state, reviewer exception, final-Admin rule and invalidated sessions. `password-security.test.js` covers bcrypt upgrade, independent Argon2id hashes, breach lookup privacy and the missing-production-pepper failure. `admin-frontend-contract.test.js` checks the new narrow interface and reviewer wording. The earlier Manager, Staff, Employee Summary, rota, audit and chat suites still run in the same complete command.

`npm run test:coverage` currently reports 73.21% statements, 57.41% branches, 82.9% functions and 74.27% lines. The limitations are recorded in `docs/testing/backend_coverage.md`. `.github/workflows/backend-checks.yml` defines the same migration, coverage, production dependency-audit and Argon2id measurement path for GitHub Actions, but that updated workflow has not run remotely yet.

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
