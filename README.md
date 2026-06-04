# Smart Schedule

## Change Note

- Previous version: the repo pointed to `MySQL`, `mysql2`, and a wider MVP with swaps, reports, and audit logging.
- Updated version: the repo now uses `PostgreSQL`, `Neon Free`, and `Render Free Web Service`.

## Project Summary

Smart Schedule is a hospitality rota system for small teams. Managers add staff, review availability, approve or reject leave, and create weekly rotas. Staff log in, submit availability, request leave, and check their shifts.

## Current MVP

1. Login and logout
2. User roles
3. Staff records
4. Availability
5. Leave requests
6. Basic rota creation
7. Staff shift view
8. Basic conflict warnings

## Current Tech Stack

1. Frontend: HTML, CSS, JavaScript
2. Frontend support: Bootstrap, limited use
3. Backend: Node.js with Express
4. Database: PostgreSQL
5. Database hosting: Neon Free
6. Web hosting: Render Free Web Service
7. Authentication: `express-session` and `bcrypt`
8. Session storage: PostgreSQL-backed sessions with `connect-pg-simple`
9. Database access: `pg`
10. Testing: Jest, Supertest, Postman, manual UAT

## Folder Structure

1. `backend/` Node.js and Express app
2. `frontend/` HTML, CSS, and JavaScript app
3. `database/` schema, migrations, and seed files
4. `docs/` planning, architecture, design, requirements, and testing docs
5. `assets/` screenshots and report assets
6. `scripts/` utility scripts
7. `infra/` deployment support files
8. `research/` notes and references
9. `wireframes/` UI sketches
10. `logs/` local log output if needed

## Deployment Plan

1. PostgreSQL database on `Neon Free`
2. Node.js and Express app on `Render Free Web Service`
3. App config through environment variables
4. SSL enabled for the Neon database connection

## Main Documents

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
