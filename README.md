# Smart Schedule

Smart Schedule is the hospitality workforce management app I built for creating a weekly rota, keeping staff records, recording time off, and processing shift swaps.

The weekly rota is the main workflow now. I changed it this way because the earlier separate assignment and availability screens made ordinary rota work feel split up. A manager can work from the weekly table, open the actions for a shift, assign staff and check warnings. Staff see the full roster as well, but they do not get the manager assignment controls.

Hosted app: [Smart Schedule on Render](https://smart-schedule-workforce-management.onrender.com)

Render is using its free service tier, so the first load can take longer if the service has gone to sleep.

The public `/health` response also includes `releaseCommit`. On Render this is the validated 40-character Git SHA for the running build. Local runs return `null`, which keeps an unset or malformed value from being presented as release evidence.

## Current build

The current build includes:

1. plain HTML, CSS and JavaScript frontend
2. Node.js and Express backend
3. PostgreSQL with ordered migrations `001` to `027`
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

The Admin, peppered-password and Phase 3 security work is now merged and deployed. Pull request `#1` merged the application work as `38f8b4b7ddd0ab440dec3cff3b4cd63664460a6c`. After that merge, Render returned the exact hosted WebSocket origin in CSP, `smart-schedule-static-v12`, connected database health and the authenticated `Secure`, `HttpOnly`, `SameSite=Lax` cookie attributes. Screenshots `181` and `185` record that hosted check without a cookie value or real account password.

Phase 4 was merged through pull request `#3` as `093a12044fe452fe5120d34feef73c9a26467895`. The merged `main` workflow run `29862501251` passed using Node.js 22 and PostgreSQL 16. Because this merge added the Populate-next-week contract test inside the configured `backend/` Render root, it also triggered a hosted build. The root response changed to `Tue, 21 Jul 2026 19:45:35 GMT`, then the exact WebSocket CSP origin, `smart-schedule-static-v12` and connected database health were checked again. Screenshot `188` records this without credentials. The release tag is still pending because no tag name has been chosen.

The Phase 4 local verification passes 29 suites and 236 tests. Coverage is 77.26% statements, 62.56% branches, 86.34% functions and 78.24% lines. ESLint passes, migrations `001` through `027` report applied in the configured verification database, `npm audit --omit=dev` reports zero known production dependency vulnerabilities, and the repository/history secret review is clean. `populate-next-week-frontend-contract.test.js` closes the earlier traceability gap for rule-based draft generation and explicit manager approval.

Phase 5 merged as `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`. GitHub Actions run `29864800275` passed that exact merge and Render now returns the same full SHA from `/health.releaseCommit`. Neon reports migrations `001` through `027` applied. A fresh Edge check loaded the public sign-in form without page errors, and all 21 referenced JavaScript and CSS files matched the same Git commit. Screenshots `189` to `191` record the local gate, exact source workflow and hosted deployment.

The Phase 6 local gate was repeated on 21 July 2026 and still passes 30 suites and 243 tests. Screenshot `192` records the migration count, coverage totals, Argon2id result, production audit and repository secret review. Earlier the same day I checked the required pepper variable names in Render without displaying their values, then removed `FIRST_ADMIN_BOOTSTRAP_TOKEN` after the permanent Admin setup. The Chrome connector later blocked both Render domains, so that environment work was not repeated and the remaining hosted browser matrix stays open in `docs/release/phase_6_release_record.md`.

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

The current local result is `30` passed suites and `243` passed tests. The test database needs migrations through `027_allow_overnight_shifts.sql`. `admin-routes.test.js` covers the separate role boundary, bootstrap, invitation state, reviewer exception, final-Admin rule and invalidated sessions. `password-security.test.js` covers bcrypt upgrade, independent Argon2id hashes, breach lookup privacy and the missing-production-pepper failure. `populate-next-week-frontend-contract.test.js` checks that the rota population remains a reviewable draft, applies the fixed eligibility rules and does not save before manager approval. The Manager, Staff, Employee Summary, rota, audit, swap and chat suites still run in the same complete command.

`npm run test:coverage` currently reports 77.43% statements, 62.65% branches, 86.75% functions and 78.41% lines. The remaining gaps are recorded in `docs/testing/backend_coverage.md` and `docs/release/known_limitations.md`. `.github/workflows/backend-checks.yml` runs migrations, the same coverage command, the Argon2id measurement and the production dependency audit against PostgreSQL 16. Deployed-merge run `29864800275` passed every step with the same 30 suites and 243 tests.

## Final release records

1. `docs/release/final_verification_record.md` - exact environment, commands, totals and pending final SHA
2. `docs/release/traceability_matrix.md` - route, implementation, automated test and evidence mapping
3. `docs/release/final_release_checklist.md` - repository, CI, hosted and tag checks
4. `docs/release/backup_and_recovery.md` - Neon, migrations, accidental deletion, secret rotation and Render recovery
5. `docs/release/known_limitations.md` - final scope, provider and coverage limits
6. `docs/release/phase_6_release_record.md` - final local gate, carried hosted evidence and the hosted items that still need a manual check

## Main project files

1. `backend/` - Express app, routes, services, tests and local scripts
2. `frontend/` - page setup, frontend services and responsive styles
3. `database/migrations/` - ordered PostgreSQL schema and data changes
4. `docs/` - requirements, design notes, test planning, release records and the project work trail
5. `assets/screenshots/` - numbered local and hosted evidence
6. `scripts/` - the updated Smart Schedule test menu

## Main decisions and limits

I kept the frontend plain because adding a framework this late would add another layer without fixing a rota problem. PostgreSQL was chosen over the earlier MySQL direction so the local database, Neon deployment and final database design all use the same system.

I removed weekly availability instead of carrying an unused page into the final build. On the other hand I kept leave, role matching, active-account checks and weekly assignment limits because the rota still needs those rules before a manager can trust the save.

The app does not include payroll, POS integration, multi-branch support, billing, a native mobile app or fully automatic rota publishing. Those are outside this semester build. `Populate next week` only prepares a rota draft for the manager to review, which was a more believable limit for the project than pretending the program could make every staffing decision on its own.

Render free-tier cold starts, Brevo email delivery, Neon recovery-plan limits, Ireland-local wall-clock shifts and remaining test branches are listed in `docs/release/known_limitations.md` instead of being hidden from the final check.
