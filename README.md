# Smart Schedule

## What This Repo Is

Smart Schedule is a rota and staff coordination project for small hospitality teams.

The idea is simple enough. Managers need one place to keep staff records, check availability, review leave, build weekly shifts, and see the rota without chasing messages or patching things together in spreadsheets. Staff need the smaller side of that, which is mainly login, availability, leave requests, and their own assigned shifts.

Right now this repo is not the full finished system yet. The frontend shell is built, the backend foundation is in place, the Neon database connection is working, the first schema and seed migrations are in the repo, the PostgreSQL-backed session layer is wired, and the manager staff workflow is now the main completed business slice. Availability, leave, shifts, assignments, and rota logic still come after this checkpoint.

## Why The Scope Was Tightened

The earlier version of the project kept drifting wider. It had swaps, reports, audit log ideas, and some smarter scheduling features written into old notes. I cut that back because it was getting too easy to describe and too hard to finish properly.

The current build keeps the base workflow first:

1. identity
2. staff records
3. availability
4. leave
5. shifts
6. assignments
7. rota view

That is enough for the module and it is still a real scheduling problem.

## What Is Actually In The Repo Now

The current repo state is closer to foundation plus setup than to a finished app.

Built now:

1. frontend shell pages in plain `HTML`, `CSS`, and `JavaScript`
2. role switch preview between manager and staff views
3. theme switching and page navigation in the frontend shell
4. backend Express app with JSON handling and a database-backed `/health` route
5. PostgreSQL connection setup using `pg`
6. PostgreSQL-backed session middleware configuration with `express-session` and `connect-pg-simple`
7. migration runner with `up` and `status` commands
8. `users` schema migration
9. `staff_profiles` schema migration
10. initial seed data migration
11. login, logout, and authenticated-session routes under `/api/v1/auth`
12. backend auth service for credential checks and public user shaping
13. shared authentication middleware for protected routes
14. security hardening around TLS, `helmet`, login rate limiting, and session timeout configuration
15. role-based access middleware for manager-only backend routes
16. manager staff routes for create, list, and edit under `/api/v1/staff`
17. live frontend login flow using the real session-backed auth routes
18. live manager staff page wired to backend staff data and update flows
19. mutation-protection headers for logout and state-changing staff requests
20. Jest and Supertest coverage for auth, security, role, and staff route flows
21. exported SRS diagrams under `docs/SRS/diagrams/`

Not built yet:

1. availability routes and persistence
2. leave request routes
3. shift routes
4. assignment logic
5. rota endpoints and role-scoped rota views
6. broader workflow automation beyond auth and staff-management coverage

That distinction matters because a lot of the docs describe the target build shape, not just the already-running code.

## Current Target MVP

These are still the active MVP features I am building toward:

1. login and logout
2. manager and staff roles
3. staff records
4. weekly availability submission
5. leave requests with approve or reject flow
6. shift creation
7. manual assignment
8. staff rota view
9. basic conflict checks

## Current Stack

1. Frontend: `HTML`, `CSS`, `JavaScript`
2. Backend: `Node.js` with `Express`
3. Database: `PostgreSQL`
4. Database host: `Neon Free`
5. Web host target: `Render Free Web Service`
6. Database driver: `pg`
7. Auth direction: `express-session` with `bcrypt`
8. Session storage direction: `connect-pg-simple`
9. Testing plan: `Jest`, `Supertest`, `Postman`, and manual checks
10. Project tracking: Jira

I stayed with plain frontend code on purpose. For this project it keeps the moving parts lower, and it is easier to explain in the report. On the other hand it means I need to keep my own structure tidy instead of leaning on a frontend framework.

## Folder Structure

1. `backend/` Express app, config, database utilities, session config, and scripts
2. `frontend/` shell UI, reusable layout code, and styles
3. `database/` ordered SQL migrations and database notes
4. `docs/` planning, design, requirements, testing files, and SRS support exports
5. `assets/` screenshots and other evidence files
6. `scripts/` helper scripts if needed later
7. `infra/` deployment support files
8. `research/` notes and references
9. `wireframes/` early UI sketches
10. `logs/` local output if I need it during setup

## Screenshot Evidence Rule

All report evidence screenshots stay under `assets/screenshots/`.

Rules:

1. keep screenshots in simple subfolders based on what they show
2. use one number sequence across the whole project
3. keep the number at the start of the filename
4. do not save secrets such as raw passwords or full connection strings in evidence screenshots

Examples:

1. `assets/screenshots/tests/backend-setup/001_backend-health-check-response.png`
2. `assets/screenshots/tests/jira/027_scrum-11-in-progress.png`
3. `assets/screenshots/tests/database-setup/029_staff-profiles-columns-query.png`
4. `assets/screenshots/tests/backend-auth/039_login-success-response.png`

## Hosting Direction

The current hosting plan is still `Neon Free` for the database and `Render Free Web Service` for the app.

I chose that because it is cheap, simple to demonstrate, and enough for the module. The trade-off is obvious as well. Free-tier cold starts and other limits are acceptable for this stage, but I would not describe that setup as production-ready for a real hospitality business.

## Main Docs

1. `docs/planning/technology_stack.md`
2. `docs/planning/project_scope.md`
3. `docs/planning/decision_log.md`
4. `docs/planning/progress_log.md`
5. `docs/design/database_design.md`
6. `docs/design/database_migration_plan.md`
7. `docs/design/api_contract.md`
8. `docs/requirements/requirements_and_acceptance_criteria.md`
9. `docs/requirements/rbac_matrix.md`
10. `docs/testing/test_plan.md`
