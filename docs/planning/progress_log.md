# Progress Log

## Why This File Exists

This is the running build log for the repo.

I use it to record what changed, why I changed it, what evidence exists, and what still had to happen next. Older entries stay here even when the direction later changed, because that is still part of the real project trail.

## Reference Files

1. [technology_stack.md](technology_stack.md)
2. [project_scope.md](project_scope.md)
3. [database_design.md](../design/database_design.md)
4. [database_migration_plan.md](../design/database_migration_plan.md)
5. [api_contract.md](../design/api_contract.md)
6. [requirements_and_acceptance_criteria.md](../requirements/requirements_and_acceptance_criteria.md)
7. [rbac_matrix.md](../requirements/rbac_matrix.md)
8. [test_plan.md](../testing/test_plan.md)
9. [decision_log.md](decision_log.md)

## Entry Shape

Each entry should answer four practical things:

1. what changed
2. why it changed
3. what proves it
4. what comes next

## 2026-07-17

### Snapshot

- Phase: Final workflow cleanup and regression fixes
- Sprint: Final project checks
- Status: recommendation route removed, weekly rota flow kept, and local suite passing

### What Changed

1. I removed the one-shift recommendation route, service and focused tests. It was no longer part of the final rota flow.
2. I kept `Populate next week` because the manager still controls the draft, checks it and decides whether anything gets saved.
3. I fixed the retry state so `Try again` rebuilds the same target week instead of moving another week forward.
4. Past shifts are now rejected when staff try to create a swap request.
5. The rota and swap warning dialogs now keep keyboard focus inside the dialog, close with Escape and return focus to the action that opened them.
6. I added the favicon links and made the Smart Schedule mark return signed-in users to Overview.
7. The Swap Requests page now has a small demo workplace panel. It is clearly marked as a project example and opens Google Maps directions to the general Dublin city centre area.
8. I updated the README, API contract, RBAC table, evidence workflow and test plan so they no longer describe the removed recommendation route as current work.

### Why It Changed

The recommendation feature started as a middle step between manual assignment and automatic scheduling, but it made the final project harder to explain beside `Populate next week`. The weekly draft is enough. It also matches the real manager workflow better because the manager prepares and approves the rota instead of asking the system to choose one person from one open shift.

The smaller fixes came from the final button and workflow checks. They were not new project sections. They were things like a retry moving to the wrong week, a past swap still being accepted, keyboard focus escaping a dialog, and the missing browser icon.

### Drawback Accepted

1. The demo location is not a real premises. The card says this directly and the name and address can be replaced later.
2. Removing the recommendation service reduces the backend test count from the earlier checkpoint. The remaining `82` tests cover the final workflow that is still in the app.
3. The hosted app still needs one check after this commit is deployed.

### Evidence

1. `backend/src/routes/shifts.js`
2. `backend/src/services/shift-swap-service.js`
3. `backend/src/__tests__/shift-swap-routes.test.js`
4. `frontend/src/services/rota-ui.js`
5. `frontend/src/services/swap-requests-ui.js`
6. `frontend/src/scripts/app.js`
7. `frontend/public/index.html`
8. `npm test` - `12` suites and `82` tests passed

### Next Steps

1. let Render deploy this checkpoint
2. check the hosted manager and staff flows again
3. align the final report and evidence references with the final build

## 2026-07-14 - Current documentation and workflow alignment

### What changed

1. password reset request and confirmation routes are now in the auth service, including expiring single-use tokens and a manager-only request list
2. shift swaps now have a real migration, route, service, staff acceptance step, and manager approval/rejection step
3. weekly availability was removed from the live workflow and migration `014_remove_weekly_availability.sql` records that change
4. migration `015_normalize_seed_staff_emails.sql` changes the starter staff emails to `alex.byrne@example.com`, `jamie.murphy@example.com`, and `casey.doyle@example.com`
5. `seed-demo-history.js` creates twelve previous weeks, current/next week rows, weekday shifts, 24 Irish-named staff, and no same-day double shifts in the generated assignments
6. `seed-staff-history.js` adds two previous shifts per week for the staff overview account so the history cards have real local data
7. the overview now combines history into one card, stacks swap requests and time off in the right column, and links back to the main rota
8. the footer is a responsive bottom hover drawer with email and phone links
9. the Time Off page now uses the same responsive card-grid layout as the overview and rota

### Checks

1. local database migrations `001` to `015` applied
2. demo history reset completed with 840 shifts and 840 assignments
3. staff history seed completed with 24 assigned history shifts for Alex Byrne
4. backend local suite passed with 13 suites and 84 tests
5. frontend JavaScript syntax checks passed
6. local `/health` returned `200`

### Still not done

1. no audit log viewing page

## 2026-07-15 - Make seeded email addresses visibly fake

The seeded accounts now use addresses like `alexbyrnefake@gmail.com` and `aoifeosullivanfake@gmail.com`. This is still fake data, but the `fake` part makes that obvious if the login list is shown in a demo.

1. `016_normalize_seed_staff_fake_gmail.sql` updates Alex Byrne, Jamie Murphy, and Casey Doyle in existing databases.
2. `seed-demo-history.js` now creates compact name-based `...fake@gmail.com` addresses and removes both the old `demo.smart-schedule.test` records and the new fake Gmail records during a reset.
3. `seed-staff-history.js` now targets `alexbyrnefake@gmail.com` by default.
4. local PostgreSQL and Neon were migrated through `016` and reseeded with 24 staff, 840 shifts, 840 assignments, and 5 approved leave records.

The demo password remains `DemoStaffPass123!`. These accounts are seed data only and are not real humans.
2. hosted UAT and final cross-browser evidence still need a focused pass
3. the current browser connector was not available for fresh automated screenshots, so visual checks used the running local page and supplied browser captures

### Next

1. finish the documentation and private-note checkpoint
2. run the final targeted checks before committing
3. keep the report files separate from this Markdown update

## 2026-05-27

### Snapshot

- Phase: Planning
- Sprint: Sprint 0
- Status: Project direction chosen and first docs created

### What Changed

1. I chose Smart Schedule as the semester project.
2. I wrote the first planning, design, requirements, and testing docs.

### Why It Changed

1. The project needed a fixed direction before implementation made any sense.
2. Starting from docs first made it easier to see where the scope could get too wide.

### Evidence

1. initial docs under `docs/`

### Next Steps

1. tighten the stack choices
2. review whether the scope was still realistic

## 2026-05-28

### Snapshot

- Phase: Planning
- Sprint: Sprint 0
- Status: Early stack lock recorded

### What Changed

1. The repo was aligned for a while around `HTML/CSS/JavaScript + Node.js/Express + MySQL`.
2. Session-based auth was kept as the authentication direction.

### Why It Changed

1. At that stage I needed one consistent story instead of mixed stack notes.
2. Even though it later changed, it was still a real checkpoint in the project.

### Evidence

1. earlier versions of `technology_stack.md`
2. `D-09` in `decision_log.md`

### Next Steps

1. finish the proposal
2. review whether MySQL still matched the stronger project version

## 2026-06-04

### Snapshot

- Phase: Planning realignment
- Sprint: Sprint 0
- Status: Repo docs corrected before implementation

### What Changed

1. I changed the repo direction from `MySQL` to `PostgreSQL`.
2. I changed the hosting direction to `Neon Free` and `Render Free Web Service`.
3. I cut the scope back to the core rota MVP.
4. I moved swaps, reports, and other wider ideas out of the immediate build path.
5. I rewrote the main docs so they stopped contradicting each other.

### Why It Changed

1. The proposal and the repo had drifted apart.
2. The wider version was getting too large to build cleanly inside the semester.
3. It was better to fix the direction before building on top of the wrong one.

### Evidence

1. `D-10` and `D-11` in `decision_log.md`
2. updated planning, design, requirements, and testing docs

### Next Steps

1. create the PostgreSQL schema and migration files
2. set up the Node.js backend
3. start implementation from the corrected docs only

## 2026-06-04

### Snapshot

- Phase: Planning cleanup
- Sprint: Sprint 0
- Status: Duplicate markdown docs reduced

### What Changed

1. I removed overlapping markdown files that were repeating scope and report content.
2. I kept the repo docs focused on implementation and tracking.

### Why It Changed

1. Too many docs were saying the same thing in slightly different ways.
2. The repo needed to help build the system, not become a second report draft.

### Evidence

1. `D-12` in `decision_log.md`
2. reduced document list in `README.md`

### Next Steps

1. create the first PostgreSQL migration
2. scaffold the Express backend

## 2026-06-09

### Snapshot

- Phase: Sprint 1 foundation build
- Sprint: Sprint 1 - Foundation
- Status: Frontend shell completed

### What Changed

1. I built the frontend shell for overview, login, staff, availability, leave, shifts, assignments, and rota pages.
2. I added top navigation, role switching, theme switching, and page transitions.
3. I shaped the pages around forms, tables, and workflow-first layouts instead of leaving the shell as static screens only.
4. I captured the main frontend shell screenshots and stored them under the repo evidence folder.

### Why It Changed

1. I wanted a visible UI target before backend wiring kept growing by itself.
2. The shell made it easier to see what each workflow page actually needed later.
3. It also gave me something real to demonstrate while the backend was still in foundation work.

### Evidence

1. `frontend/public/index.html`
2. `frontend/src/pages/page-config.js`
3. `frontend/src/components/layout.js`
4. `frontend/src/scripts/app.js`
5. `frontend/src/styles/main.css`
6. `assets/screenshots/tests/frontend-shell/`

### Next Steps

1. add the PostgreSQL connection layer
2. add the migration structure

## 2026-06-10

### Snapshot

- Phase: Sprint 1 tracking
- Sprint: Sprint 1 - Foundation
- Status: Sprint started and evidence organized

### What Changed

1. I started Sprint 1 in Jira.
2. I marked the frontend shell, screenshot capture, and progress-note tasks as done.
3. I moved the evidence screenshots into numbered repo folders.

### Why It Changed

1. The sprint board needed to match the real project state instead of staying behind the repo.
2. The screenshot evidence was getting harder to reference cleanly.

### Evidence

1. `assets/screenshots/tests/backend-setup/`
2. `assets/screenshots/tests/frontend-shell/`
3. `assets/screenshots/tests/jira/009_sprint-1-board.png`

### Next Steps

1. build the PostgreSQL connection layer
2. create the first migration structure

## 2026-06-10

### Snapshot

- Phase: Sprint 1 foundation build
- Sprint: Sprint 1 - Foundation
- Status: PostgreSQL connection layer completed

### What Changed

1. I created the Neon PostgreSQL project for the app.
2. I added local database config through `backend/.env`.
3. I added the PostgreSQL connection module with `pg`.
4. I updated the backend health route so it checks database connectivity.
5. I captured database setup and Jira evidence screenshots.

### Why It Changed

1. The project needed a real database target before schema work started.
2. A live health check removed guesswork before I started writing migrations.
3. It kept the next task focused on schema and migration flow instead of connection troubleshooting.

### Evidence

1. `backend/src/config/env.js`
2. `backend/src/config/db.js`
3. `backend/src/app.js`
4. `assets/screenshots/tests/database-setup/010_neon-project-created.png`
5. `assets/screenshots/tests/database-setup/011_database-url-configured.png`
6. `assets/screenshots/tests/database-setup/012_db-health-check-working.png`
7. `assets/screenshots/tests/jira/013_scrum-6-done.png`
8. `assets/screenshots/tests/jira/014_scrum-7-in-progress.png`

### Next Steps

1. create the migration folder and naming structure
2. add the first migration runner flow

## 2026-06-10

### Snapshot

- Phase: Sprint 1 foundation build
- Sprint: Sprint 1 - Foundation
- Status: Migration structure completed

### What Changed

1. I added a reusable PostgreSQL migration module in the backend.
2. I added CLI scripts to run migrations and check status.
3. I added tracked database structure files for migrations and related notes.
4. I added migration folder guidance so later SQL files follow one naming pattern.

### Why It Changed

1. I needed one stable migration flow before adding any real schema files.
2. Tracking applied filenames in the database keeps later changes ordered and repeatable.
3. This let the next session focus on the schema itself instead of migration plumbing.

### Evidence

1. `backend/src/database/migrations.js`
2. `backend/src/scripts/run-migrations.js`
3. `backend/package.json`
4. `database/migrations/README.md`

### Next Steps

1. add the users schema migration
2. run the first real schema migration against Neon

## 2026-06-10

### Snapshot

- Phase: Sprint transition
- Sprint: Sprint 1 complete, next sprint prepared
- Status: Session 10 evidence captured and board updated

### What Changed

1. I captured migration runner screenshots for the empty migration state.
2. I marked `SCRUM-7` done after checking the migration commands.
3. I completed the first foundation sprint in Jira.
4. I created the next sprint shell for the schema and auth work.

### Why It Changed

1. I wanted clear proof that the migration runner worked before I added actual schema SQL.
2. Jira needed to reflect the completed foundation checkpoint.

### Evidence

1. `assets/screenshots/tests/migrations/015_migration-status-no-files.png`
2. `assets/screenshots/tests/migrations/016_migration-runner-no-files.png`
3. `assets/screenshots/tests/jira/017_sprint-1-all-items-done.png`
4. `assets/screenshots/tests/jira/018_next-sprint-created.png`

### Next Steps

1. add the users schema migration
2. add the staff profiles schema migration

## 2026-06-10

### Snapshot

- Phase: Sprint 2 start
- Sprint: Sprint 2 - Identity and Staff Base
- Status: Sprint started and first schema task moved into progress

### What Changed

1. I renamed the next Jira sprint to match the identity and staff phase.
2. I added the Phase 2 items for users schema, staff profiles schema, seed data, session setup, and login/logout routes.
3. I started Sprint 2 in Jira.
4. I moved `SCRUM-10` into progress.

### Why It Changed

1. The board needed to match the next real work block before coding continued.
2. Keeping one active issue in progress keeps the work trail cleaner.

### Evidence

1. `assets/screenshots/tests/jira/019_sprint-1-completed.png`
2. `assets/screenshots/tests/jira/020_sprint-2-planned.png`
3. `assets/screenshots/tests/jira/021_sprint-2-started.png`
4. `assets/screenshots/tests/jira/022_scrum-10-in-progress.png`

### Next Steps

1. add the users schema migration
2. run it through the backend runner

## 2026-06-10

### Snapshot

- Phase: Sprint 2 schema build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: Users schema migration completed and verified

### What Changed

1. I added the first real SQL migration file for the `users` table.
2. I added `pgcrypto` setup for `gen_random_uuid()`.
3. I added the `users` table with lowercase email, role, and active-state constraints.
4. I applied the migration through the backend runner and checked it against Neon.

### Why It Changed

1. The identity layer needed a base table before staff profiles, sessions, or login routes made sense.
2. I kept the first schema migration narrow so any failure would be easier to isolate and explain.

### Drawback Accepted

1. This checkpoint added structure, not a visible app feature.
2. It was slower to demonstrate than UI work, but it had to happen first.

### Evidence

1. `database/migrations/001_create_users_schema.sql`
2. `npm run db:migrate`
3. `npm run db:migrate:status`
4. verified `users` table columns and constraints through the Neon-backed database

### Next Steps

1. add the staff profiles schema migration
2. capture users migration evidence screenshots

## 2026-06-11

### Snapshot

- Phase: Sprint 2 schema build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: Staff profiles schema migration completed and verified

### What Changed

1. I added the SQL migration file for the `staff_profiles` table.
2. I linked each profile to a `users` record through a unique foreign key.
3. I added contract-hours validation and an active-state index.
4. I applied the migration through the backend runner and checked it on Neon.
5. I captured Jira and pgAdmin evidence for the checkpoint.

### Why It Changed

1. The identity layer needed staff profile records before seed data, sessions, or login work could continue.
2. I kept the schema step separate from seed data because that makes the migration trail easier to explain later.

### Drawback Accepted

1. This still did not add direct user-facing backend behaviour.
2. The table only becomes useful once records exist and auth starts using them.

### Evidence

1. `database/migrations/002_create_staff_profiles_schema.sql`
2. `assets/screenshots/tests/jira/027_scrum-11-in-progress.png`
3. `assets/screenshots/tests/database-setup/028_staff-profiles-table-visible-in-neon.png`
4. `assets/screenshots/tests/database-setup/029_staff-profiles-columns-query.png`
5. `assets/screenshots/tests/migrations/030_staff-profiles-migration-file.png`
6. `assets/screenshots/tests/jira/031_scrum-11-done.png`

### Next Steps

1. add the initial seed data migration
2. verify the inserted records before moving into auth

## 2026-06-11

### Snapshot

- Phase: Sprint 2 seed setup
- Sprint: Sprint 2 - Identity and Staff Base
- Status: Seed migration completed and Jira evidence closed

### What Changed

1. I added the initial seed migration for one manager user, three staff users, and matching staff profile records.
2. I kept the seed file separate from the schema files.
3. I applied the seed migration after the first two schema files were already stable.
4. I finished the Jira and screenshot evidence for the full seed-data checkpoint.

### Why It Changed

1. The next login and staff work needed real sample records instead of empty tables.
2. Keeping seed data in its own migration makes the history more believable and much easier to troubleshoot.

### Drawback Accepted

1. Seed data can go stale later if the schema changes.
2. The Jira proof for this checkpoint was still being finished after the SQL file itself was already in the repo.

### Evidence

1. `database/migrations/003_seed_initial_data.sql`
2. `assets/screenshots/tests/jira/032_scrum-12-in-progress.png`
3. `assets/screenshots/tests/migrations/033_seed-initial-data-file.png`
4. `assets/screenshots/tests/database-setup/034_seeded-users-query-result.png`
5. `assets/screenshots/tests/migrations/035_seed-migration-status-applied.png`
6. `assets/screenshots/tests/jira/036_scrum-12-done.png`
7. seeded `users` and `staff_profiles` records visible through the Neon-backed database

### Next Steps

1. wire `express-session`
2. verify the session store setup against Neon
3. add login and logout routes

## 2026-06-11

### Snapshot

- Phase: Sprint 2 evidence and doc alignment
- Sprint: Sprint 2 - Identity and Staff Base
- Status: schema and seed evidence commit closed and repo docs brought back into line

### What Changed

1. I committed the delayed screenshot evidence for the staff-profiles and seed-data checkpoints.
2. I updated the main repo markdown files so they stopped lagging behind the real migration order.
3. I kept that cleanup separate from the next auth code checkpoint.

### Why It Changed

1. The evidence for `SCRUM-11` and `SCRUM-12` existed already, but it was sitting outside the matching commit trail.
2. I did not want session work to absorb old screenshots and older doc fixes just because they were still in the tree.

### Evidence

1. `assets/screenshots/tests/jira/027_scrum-11-in-progress.png`
2. `assets/screenshots/tests/database-setup/028_staff-profiles-table-visible-in-neon.png`
3. `assets/screenshots/tests/database-setup/029_staff-profiles-columns-query.png`
4. `assets/screenshots/tests/migrations/030_staff-profiles-migration-file.png`
5. `assets/screenshots/tests/jira/031_scrum-11-done.png`
6. `assets/screenshots/tests/jira/032_scrum-12-in-progress.png`
7. `assets/screenshots/tests/migrations/033_seed-initial-data-file.png`
8. `assets/screenshots/tests/database-setup/034_seeded-users-query-result.png`
9. `assets/screenshots/tests/migrations/035_seed-migration-status-applied.png`
10. `assets/screenshots/tests/jira/036_scrum-12-done.png`
11. commit `6f51a0b`

### Next Steps

1. wire PostgreSQL-backed session middleware
2. verify the app still boots cleanly
3. move into login and logout work only after that base is stable

## 2026-06-11

### Snapshot

- Phase: Sprint 2 auth base
- Sprint: Sprint 2 - Identity and Staff Base
- Status: session configuration completed, `SCRUM-13` done, `SCRUM-14` moved into progress

### What Changed

1. I added `backend/src/config/session.js`.
2. I wired `express-session` and `connect-pg-simple` into `backend/src/app.js`.
3. I configured the PostgreSQL-backed store to use `user_sessions` and create the table if missing.
4. I added production proxy handling and a development fallback secret so the app still boots cleanly outside production.

### Why It Changed

1. Login and logout routes needed a real session base first.
2. I wanted to prove the app could boot with the PostgreSQL-backed store before the auth route work started.

### Drawback Accepted

1. This still does not give users a working login flow by itself.
2. The session table is currently library-managed instead of being part of the numbered SQL migration chain.

### Evidence

1. `backend/src/config/session.js`
2. `backend/src/app.js`
3. local `/health` check still returning `{"database":"connected","status":"ok"}`
4. Jira board state with `SCRUM-13` done and `SCRUM-14` in progress

### Next Steps

1. add login and logout routes
2. add auth middleware after the route layer exists
3. keep the next checkpoint narrow instead of mixing it with old Jira evidence

## 2026-06-11

### Snapshot

- Phase: SRS support work
- Sprint: Sprint 2 still active
- Status: minimal Visual Paradigm diagram set exported and copied into the repo

### What Changed

1. I finished the use case diagram for the Smart Schedule actors and core MVP functions.
2. I finished the simplified data model diagram that matches the current repo schema direction.
3. I finished one sequence diagram for assigning staff to a shift.
4. I finished one activity diagram for the same workflow.
5. I copied the exported PNGs into `docs/SRS/diagrams/`.

### Why It Changed

1. The SRS needed real project diagrams, not empty diagram blocks.
2. I kept the set small because the project is still mid-build and I did not want diagram sprawl for features that do not exist yet.

### Drawback Accepted

1. These diagrams are tied to the current MVP and current workflow assumptions.
2. If later route or schema work changes the assignment flow too much, the diagrams will need another pass.

### Evidence

1. `docs/SRS/diagrams/smart_schedule_use_case_diagram.png`
2. `docs/SRS/diagrams/smart_schedule_data_model.png`
3. `docs/SRS/diagrams/smart_schedule_assign_staff_sequence_diagram.png`
4. `docs/SRS/diagrams/smart_schedule_assign_staff_activity_diagram.png`
5. commit `ce56446`

### Next Steps

1. keep the diagram exports in sync if the auth or assignment flow changes later
2. move back to backend login and logout work

## 2026-06-12

### Snapshot

- Phase: Sprint 2 auth route build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: login and logout route checkpoint committed and Jira evidence closed

### What Changed

1. I added `backend/src/routes/auth.js` for login, logout, and session-user lookup.
2. I added `backend/src/services/auth-service.js` so the route layer does not keep all the database and password logic inside one file.
3. I updated the app so the auth routes are mounted under `/api/v1/auth` and added a simple fallback `500` handler.
4. I added backend auth tests under `backend/src/__tests__/auth-routes.test.js`.
5. I committed the Jira and PowerShell evidence screenshots for the full `SCRUM-14` checkpoint.

### Why It Changed

1. The session base was already in place, so this was the first point where identity became a real working backend feature instead of only setup.
2. I kept this checkpoint narrow on purpose. First I wanted login, logout, session lookup, and test proof. The stronger route protection still came after that.

### Drawback Accepted

1. This still did not protect the rest of the business routes because auth middleware and RBAC middleware were still separate checkpoints at that stage.
2. The evidence was mostly backend JSON and Jira proof, not a finished frontend login flow yet.

### Evidence

1. `backend/src/routes/auth.js`
2. `backend/src/services/auth-service.js`
3. `backend/src/__tests__/auth-routes.test.js`
4. `assets/screenshots/tests/jira/037_scrum-13-done-and-scrum-14-in-progress.png`
5. `assets/screenshots/tests/jira/038_scrum-14-done.png`
6. `assets/screenshots/tests/backend-auth/039_login-success-response.png`
7. `assets/screenshots/tests/backend-auth/040_auth-me-success-response.png`
8. `assets/screenshots/tests/backend-auth/041_logout-success-response.png`
9. `assets/screenshots/tests/backend-auth/042_auth-me-after-logout-unauthorized.png`
10. commit `42fa6aa`

### Next Steps

1. add authentication middleware for protected non-auth routes
2. harden the auth entry points before WAN-facing use
3. add role-based access middleware after that

## 2026-06-12

### Snapshot

- Phase: Sprint 2 auth protection build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: authentication middleware and security hardening committed

### What Changed

1. I added shared auth middleware so protected routes can validate the current session user consistently.
2. I tightened remote PostgreSQL security with strict TLS verification and channel binding.
3. I added `helmet()` to the Express app and rate limiting around login.
4. I reduced the session settings to a more moderate idle timeout that still fits usability.
5. I added backend tests for the DB security config and login rate limiting.

### Why It Changed

1. Login routes alone were not enough because the app still needed shared access checks before business routes could be added safely.
2. It was better to harden the auth entry points before I started building more manager-only CRUD features.

### Evidence

1. `backend/src/middleware/auth.js`
2. `backend/src/config/db.js`
3. `backend/src/app.js`
4. `backend/src/__tests__/auth-middleware.test.js`
5. `backend/src/__tests__/db-config.test.js`
6. `backend/src/__tests__/rate-limit.test.js`
7. `assets/screenshots/tests/jira/043_scrum-15-done-and-scrum-16-in-progress.png`
8. `assets/screenshots/tests/backend-auth/044_auth-security-test-suite-passing.png`
9. commit `5d6e371`

### Next Steps

1. add role-based access middleware
2. keep the next checkpoint focused on manager-only access control
3. move into staff CRUD only after that access layer is stable

## 2026-06-12

### Snapshot

- Phase: Sprint 2 access control build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: role-based access middleware committed and Jira updated

### What Changed

1. I added shared role-check middleware for manager-only access control.
2. I expanded the auth middleware tests to cover role rejection and allow paths.
3. I closed the Jira checkpoint for `SCRUM-16`.

### Why It Changed

1. The staff routes were the first real business routes that needed a clean manager-only guard.
2. I wanted one reusable RBAC layer before duplicating role checks inside each route file.

### Evidence

1. `backend/src/middleware/rbac.js`
2. `backend/src/__tests__/auth-middleware.test.js`
3. `assets/screenshots/tests/jira/045_scrum-16-done.png`
4. `assets/screenshots/tests/backend-auth/046_role-middleware-test-suite-passing.png`
5. commit `457ea13`

### Next Steps

1. build the manager staff routes
2. wire the frontend login page into the real auth flow
3. capture the staff-management evidence as one clean checkpoint

## 2026-06-12

### Snapshot

- Phase: Sprint 2 manager staff workflow build
- Sprint: Sprint 2 - Identity and Staff Base
- Status: staff management checkpoint completed and evidence organized

### What Changed

1. I added manager-only `GET`, `POST`, and `PUT` staff routes under `/api/v1/staff`.
2. I added a staff service layer so route validation and transaction logic stay out of the route file.
3. I added a mutation-protection header check for state-changing staff actions and for logout.
4. I wired the login page to the real backend auth routes instead of shell-only state.
5. I wired the manager staff page to the real backend list, create, filter, and edit flows.
6. I added the staff route test suite and kept the broader backend test block green.
7. I organized Jira, frontend, and backend screenshot evidence through `057`.

### Why It Changed

1. Sprint 2 needed one real business slice after the auth and RBAC layers were stable.
2. I kept create, list, edit, and the matching frontend together because splitting them further would have made the current tree less believable and harder to explain.

### Drawback Accepted

1. This checkpoint still leaves availability, leave, shifts, and rota logic for later phases.
2. The current mutation-protection approach is lightweight and intentionally practical for this stage rather than a full CSRF token framework.

### Evidence

1. `backend/src/routes/staff.js`
2. `backend/src/services/staff-service.js`
3. `backend/src/middleware/request-security.js`
4. `backend/src/__tests__/staff-routes.test.js`
5. `frontend/src/services/api-client.js`
6. `frontend/src/services/session-ui.js`
7. `frontend/src/services/staff-manager.js`
8. `assets/screenshots/tests/jira/047_scrum-17-18-19-in-progress.png`
9. `assets/screenshots/tests/backend-auth/048_staff-management-test-suite-passing.png`
10. `assets/screenshots/tests/jira/049_scrum-17-18-19-done.png`
11. `assets/screenshots/tests/frontend-shell/050_login-invalid-credentials.png`
12. `assets/screenshots/tests/frontend-shell/051_staff-records-manager-view-light.png`
13. `assets/screenshots/tests/frontend-shell/052_staff-create-form-filled.png`
14. `assets/screenshots/tests/frontend-shell/053_staff-duplicate-email-error.png`
15. `assets/screenshots/tests/frontend-shell/054_staff-update-saved.png`
16. `assets/screenshots/tests/frontend-shell/055_staff-list-with-inactive-record.png`
17. `assets/screenshots/tests/frontend-shell/056_staff-filter-floor.png`
18. `assets/screenshots/tests/frontend-shell/057_staff-filter-bar.png`
19. local `npm test` run with 5 suites and 21 tests passing

### Next Steps

1. start the `availability_entries` schema next
2. follow that with `leave_requests` because assignment blocking still depends on real leave data
3. keep the next schema checkpoint separate from later shift and rota work

## 2026-06-16

### Snapshot

- Phase: Sprint 2 workflow build
- Sprint: Sprint 2 - Identity and Staff Base still active
- Status: availability, leave, and shifts workflow checkpoint finished locally and evidence organized

### What Changed

1. I added `004_create_availability_entries_schema.sql`, `005_create_leave_requests_schema.sql`, and `006_create_shifts_schema.sql`.
2. I added the backend route and service layers for availability, leave requests, and shifts.
3. I added the matching frontend workflow screens so those pages stopped being shell-only.
4. I added delete support for availability and shifts, and a withdraw path for pending leave requests.
5. I tightened the live UI error wording so the messages are simpler for the end user.
6. I fixed dead page buttons in the shell and made the assignments page usable as a client-side review screen.
7. I organized screenshot evidence `058` to `070` for this checkpoint.
8. I reran the backend test block and the suite now passes locally with `56` tests.

### Why It Changed

1. The project was at the point where the staff base was already stable enough, so the next real step had to be the workflow tables and the first live business screens after staff management.
2. I kept availability first, then leave, then shifts because assignment blocking depends on real availability and leave data before it depends on rota polish.
3. I also did not want the availability, leave, and shifts pages to stay as fake shell views for too long because that makes the project look broader on paper than it is in the repo.

### Drawback Accepted

1. The assignments page is only a client-side review flow right now, not the real assignment engine yet.
2. The rota endpoint and the staff rota view still come later.
3. This checkpoint is bigger than the earlier auth or staff slices, but splitting it again now would make the current repo state harder to explain instead of easier.

### Evidence

1. `database/migrations/004_create_availability_entries_schema.sql`
2. `database/migrations/005_create_leave_requests_schema.sql`
3. `database/migrations/006_create_shifts_schema.sql`
4. `backend/src/routes/availability.js`
5. `backend/src/routes/leave-requests.js`
6. `backend/src/routes/shifts.js`
7. `backend/src/services/availability-service.js`
8. `backend/src/services/leave-request-service.js`
9. `backend/src/services/shift-service.js`
10. `backend/src/services/workflow-service-utils.js`
11. `frontend/src/services/availability-ui.js`
12. `frontend/src/services/leave-ui.js`
13. `frontend/src/services/shifts-ui.js`
14. `frontend/src/services/assignments-ui.js`
15. `assets/screenshots/tests/frontend-workflows/058_availability-save-success.png`
16. `assets/screenshots/tests/frontend-workflows/061_leave-request-submitted-pending.png`
17. `assets/screenshots/tests/frontend-workflows/062_leave-request-approved-manager-view.png`
18. `assets/screenshots/tests/frontend-workflows/068_shift-delete-success.png`
19. `assets/screenshots/tests/frontend-workflows/069_assignments-review-shift-working.png`
20. `assets/screenshots/tests/frontend-workflows/070_assignments-staff-assigned-success.png`
21. `assets/screenshots/tests/backend-workflows/065_workflow-route-test-suite-passing.png`

### Next Steps

1. commit the current workflow checkpoint cleanly
2. add the real `shift_assignments` data layer after that
3. keep the rota layer after the assignment engine is real

## 2026-06-17

### Snapshot

- Phase: Assignment data layer
- Sprint: Sprint 2 - Identity and Staff Base still active
- Status: shift assignment schema added and applied before assignment routes

### What Changed

1. I added `007_create_shift_assignments_schema.sql`.
2. The new table links a shift to one staff profile for the MVP.
3. The table also stores the manager user who made the assignment and the assignment timestamp.
4. I updated the database and scope notes so they stop saying the assignment table is only planned.
5. I applied the migration through the backend migration runner and confirmed it shows as applied.

### Why It Changed

1. The assignment screen was still only a client-side review flow.
2. Before adding assignment routes or conflict checks, the project needed a real table where saved assignments can live.
3. I kept this checkpoint narrow because assignment is the main business layer, and it will be easier to test the API after the schema is stable.

### Drawback Accepted

1. This checkpoint still does not make assignment work from the UI.
2. Leave, overlap, availability, role, and contract-hours rules still need service logic in the next checkpoints.

### Evidence

1. `database/migrations/007_create_shift_assignments_schema.sql`
2. `database/migrations/README.md`
3. `docs/design/database_migration_plan.md`
4. `docs/design/database_design.md`
5. `npm run db:migrate`
6. `npm run db:migrate:status`
7. `npm test`

### Next Steps

1. add the assignment route and service layer
2. add backend conflict checks before wiring the frontend assignment screen
3. keep rota work after saved assignments can be created through the API

## 2026-06-17

### Snapshot

- Phase: Assignment API foundation
- Sprint: Sprint 2 - Identity and Staff Base still active
- Status: basic backend assignment save route added

### What Changed

1. I added `backend/src/services/assignment-service.js`.
2. I added `backend/src/routes/assignments.js`.
3. I mounted the route under `/api/v1/assignments`.
4. A manager can now save one staff assignment for one shift.
5. The route rejects unauthenticated users, staff users, missing mutation-protection headers, invalid UUIDs, and duplicate assignments for the same shift.
6. I added backend tests for the new assignment route.

### Why It Changed

1. The previous checkpoint only added the `shift_assignments` table.
2. This step proves the backend can now write a real assignment record instead of only showing a client-side assignment screen.
3. I kept the conflict rules out of this checkpoint because leave, overlap, availability, role, and contract-hour checks need their own focused tests.

### Drawback Accepted

1. Assignment is still not wired into the frontend screen.
2. The route currently saves an assignment and blocks duplicates, but it does not yet enforce the full scheduling conflict rules.

### Evidence

1. `backend/src/services/assignment-service.js`
2. `backend/src/routes/assignments.js`
3. `backend/src/__tests__/assignment-routes.test.js`
4. `npm test -- assignment-routes.test.js`
5. `npm test`
6. `assets/screenshots/tests/backend-workflows/074_assignment-route-test-suite-passing.png`
7. `assets/screenshots/tests/backend-workflows/075_assignment-api-manager-login-success.png`
8. `assets/screenshots/tests/backend-workflows/076_assignment-api-shift-created.png`
9. `assets/screenshots/tests/backend-workflows/077_assignment-api-create-success.png`
10. `assets/screenshots/tests/backend-workflows/078_assignment-api-duplicate-conflict.png`
11. `assets/screenshots/tests/backend-workflows/079_assignment-route-test-suite-passing.png`

### Next Steps

1. add leave and overlap conflict checks
2. add availability and role conflict checks after that
3. keep frontend assignment wiring after the backend conflict responses are real

## 2026-07-01

### Snapshot

- Phase: Assignment warning and stricter same-day conflict checks
- Sprint: Sprint 2 still active
- Status: contract-hours warning logic added after the rota-first checkpoint

### What Changed

1. I added contract-hours warning output to the assignment save and update flow.
2. The backend now sums the staff member's assigned shift hours for the selected week and compares the projected total with `staff_profiles.contract_hours`.
3. The warning is returned in `warnings[]` on successful assignment responses instead of blocking the save.
4. I tightened the same-day assignment check so a staff member cannot be assigned to `10:00-16:00` and then `16:00-22:00` on the same date.
5. I also updated `seed-demo-history.js` so fake rota history does not generate one person across both a day shift and an evening shift on the same date.
6. I added `db:seed:demo-history:reset` so old fake rota rows can be removed and rebuilt after the seed logic changes.
7. The assignment page and rota cell assignment flow now show the warning after a successful save.
8. I updated the repo docs that were still saying contract-hours warnings were future work.

### Why It Changed

1. Contract hours should warn the manager, not stop them, because extra hours can still happen in hospitality.
2. Back-to-back shifts needed to be blocked because the earlier overlap check allowed exact handovers, and that still creates an unrealistic rota for one person.
3. I did this after the rota-first checkpoint because assignments are now used from both the assignment page and the rota page.

### Drawback Accepted

1. The warning is shown after save, not as a live pre-check while the manager is selecting staff.
2. There is still no audit log record for who changed an assignment beyond the existing assignment fields.

### Evidence

1. `backend/src/services/assignment-service.js`
2. `backend/src/routes/assignments.js`
3. `backend/src/__tests__/assignment-routes.test.js`
4. `backend/src/scripts/seed-demo-history.js`
5. `backend/package.json`
6. `frontend/src/services/assignments-ui.js`
7. `frontend/src/services/rota-ui.js`
8. `npm test -- --runInBand backend/src/__tests__/assignment-routes.test.js`
9. `npm test -- --runInBand`

### Next Steps

1. capture more rota evidence screenshots for mobile and staff read-only view
2. add audit logging foundation
3. keep deployment after the core rota evidence is clearer

## 2026-07-01

### Snapshot

- Phase: Audit logging foundation
- Sprint: Sprint 2 still active
- Status: backend audit records added for manager shift and assignment changes

### What Changed

1. I added `009_create_audit_logs_schema.sql`.
2. The new `audit_logs` table stores the manager user, action, entity type, entity id, short summary, and before/after JSON snapshots.
3. Assignment create, update, and delete now write audit records.
4. Shift create, update, and delete now write audit records.
5. Route tests now check the audit rows directly for assignment and shift changes.
6. I updated the repo docs so audit logging is no longer described as completely missing.

### Why It Changed

1. The rota can now be changed from the manager flow, so the project needs some trail of who changed shifts and assignments.
2. I kept this as backend evidence first because an audit screen would be extra UI work and not needed before deployment or UAT.
3. JSON snapshots are acceptable here because the audit log is mainly proof and debugging support at this stage, not a full reporting module.

### Drawback Accepted

1. There is no audit log viewing page yet.
2. The current audit layer only covers shift and assignment changes, not every staff, availability, or leave action.

### Evidence

1. `database/migrations/009_create_audit_logs_schema.sql`
2. `backend/src/services/audit-log-service.js`
3. `backend/src/services/assignment-service.js`
4. `backend/src/services/shift-service.js`
5. `backend/src/__tests__/assignment-routes.test.js`
6. `backend/src/__tests__/shift-routes.test.js`
7. `npm run db:migrate`
8. `npm test -- --runInBand backend/src/__tests__/assignment-routes.test.js backend/src/__tests__/shift-routes.test.js`

### Next Steps

1. capture more rota evidence screenshots for mobile and staff read-only view
2. start deployment setup after the current backend checkpoint is committed
3. keep audit viewing out unless there is time after deployment and UAT

## 2026-07-02

### Snapshot

- Phase: Manager recommendation flow
- Sprint: Sprint 2 still active
- Status: manager recommendation route, scoring, tests, and rota modal added

### What Changed

1. I added a manager-only recommendation read route at `GET /api/v1/shifts/{shiftId}/recommendations`.
2. I kept it under the shifts route because the manager asks for a recommendation from one selected open shift, not from a separate scheduling module.
3. I reused the current assignment conflict checks first, then ranked only the eligible staff with a small score based on weekly hours and contract hours.
4. I added machine-readable exclusions for inactive staff, role mismatch, approved leave, weekly limits, and overlapping or touching same-day shifts.
5. I added a rota recommendation modal so the manager can open one open shift, review the ranked staff, then hand off to the normal assignment save flow.
6. I added focused recommendation route and service tests, then reran the existing assignment and rota tests plus the full backend suite.

### Why It Changed

1. The rota already worked as the first screen after login, so the next useful step was to cut down manual checking on one open shift without pretending the project had become a full automatic scheduler.
2. I kept the real hard rules inside the assignment service because otherwise the recommendation result and the final assignment save could drift apart.
3. The score had to stay small and explainable. I did not want fake precision or hidden weighting that would be harder to defend in the report.

### Drawback Accepted

1. This still is not automatic rota generation.
2. The recommendation is only a snapshot, so a manager can still get a later conflict if availability, leave, or another assignment changes before save.
3. Manual screenshots and UAT evidence for the new modal still come later, because this checkpoint was the backend and frontend implementation first.

### Evidence

1. `backend/src/services/assignment-service.js`
2. `backend/src/services/shift-recommendation-service.js`
3. `backend/src/routes/shifts.js`
4. `backend/src/__tests__/shift-recommendation-service.test.js`
5. `backend/src/__tests__/shift-recommendation-routes.test.js`
6. `frontend/src/services/rota-ui.js`
7. `frontend/src/styles/main.css`
8. `npm test -- --runInBand backend/src/__tests__/shift-recommendation-service.test.js backend/src/__tests__/shift-recommendation-routes.test.js`
9. `npm test -- --runInBand backend/src/__tests__/assignment-routes.test.js backend/src/__tests__/rota-routes.test.js`
10. `npm test`
11. full backend suite now passes locally with `88` tests

### Next Steps

1. capture useful screenshots for the recommendation modal on desktop and mobile
2. run the manual recommendation scenarios and record the simple evaluation table
3. keep deployment and hosted checks after the current local evidence is in place
