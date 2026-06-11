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
3. I shaped the pages around forms, tables, and workflow-first layouts instead of static placeholders only.
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
