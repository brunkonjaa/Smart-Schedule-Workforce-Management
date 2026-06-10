# Progress Log

## Purpose

This file records what changed, why it changed, and what comes next. Older entries stay here even if the project later moved in a different direction.

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

## Entry Template

```md
## YYYY-MM-DD

### Snapshot
- Phase:
- Sprint:
- Status:

### What Changed
1.
2.

### Why It Changed
1.
2.

### Evidence
1.

### Next Steps
1.
2.
```

## 2026-05-27

### Snapshot

- Phase: Planning
- Sprint: Sprint 0
- Status: Project direction chosen and first docs created

### What Changed

1. Chose Smart Schedule as the project.
2. Wrote the first full set of planning, design, and testing docs.

### Why It Changed

1. The project needed a clear direction before any build work started.
2. A document-first start made the scope easier to see.

### Evidence

1. Initial planning docs in `docs/`

### Next Steps

1. Check the stack choices
2. Tighten the proposal

## 2026-05-28

### Snapshot

- Phase: Planning
- Sprint: Sprint 0
- Status: Early stack lock added

### What Changed

1. The repo was aligned around `HTML/CSS/JavaScript + Node.js/Express + MySQL`.
2. Session-based auth was kept.

### Why It Changed

1. That version matched the earlier planning direction.
2. It removed the first round of stack drift.

### Evidence

1. Earlier versions of `technology_stack.md`
2. `D-09` in `decision_log.md`

### Next Steps

1. Finish the proposal
2. Start implementation after review

## 2026-06-04

### Snapshot

- Phase: Planning realignment
- Sprint: Sprint 0
- Status: Repo docs corrected before implementation

### What Changed

1. The repo stack changed from `MySQL` to `PostgreSQL`.
2. Hosting direction changed to `Neon Free` and `Render Free Web Service`.
3. The scope was reduced to the core rota MVP.
4. Older features like swaps, reports, and smart suggestions were moved out of the immediate build path.
5. Core docs were rewritten so they all say the same thing.

### Why It Changed

1. The proposal and repo had stopped matching.
2. The wider version was becoming too large for a clean first implementation pass.
3. It made more sense to fix the docs now than build from mixed assumptions.

### Evidence

1. `D-10` and `D-11` in `decision_log.md`
2. Updated planning, design, requirements, and testing docs

### Next Steps

1. Create the PostgreSQL schema and migration files
2. Set up the Node.js backend
3. Start Sprint 1 from the current docs only

## 2026-06-04

### Snapshot

- Phase: Planning cleanup
- Sprint: Sprint 0
- Status: Duplicate markdown docs reduced

### What Changed

1. Removed overlapping markdown files that repeated scope, testing, or report content.
2. Kept only the docs needed for implementation and tracking.

### Why It Changed

1. Too many docs were saying the same thing.
2. The final report will cover the bigger explanations later.

### Evidence

1. `D-12` in `decision_log.md`
2. Reduced doc list in `README.md`

### Next Steps

1. Create the first PostgreSQL migration
2. Scaffold the Express backend

## 2026-06-09

### Snapshot

- Phase: Sprint 1 foundation build
- Sprint: Sprint 1 - Foundation
- Status: Frontend shell completed

### What Changed

1. Built the frontend shell for overview, login, staff, availability, leave, shifts, assignments, and rota pages.
2. Added top navigation, manager and staff role switching, light and dark theme switching, and smooth page transitions.
3. Reworked the pages around compact controls, tables, forms, and action-first layouts.
4. Captured frontend shell screenshots and saved them in the repo evidence folder.

### Why It Changed

1. The project needed a stable UI structure before backend wiring starts.
2. The main screens now show what each workflow will look like without waiting for live data.
3. This gives the project something clear to demo and connect later backend work to.

### Evidence

1. `frontend/public/index.html`
2. `frontend/src/pages/page-config.js`
3. `frontend/src/components/layout.js`
4. `frontend/src/scripts/app.js`
5. `frontend/src/styles/main.css`
6. `assets/screenshots/tests/frontend-shell/`

### Next Steps

1. Add the PostgreSQL connection layer
2. Add the migration structure

## 2026-06-10

### Snapshot

- Phase: Sprint 1 tracking
- Sprint: Sprint 1 - Foundation
- Status: Sprint started and evidence organized

### What Changed

1. Started Sprint 1 in Jira.
2. Marked the completed frontend shell work, screenshot capture, and progress note tasks as done.
3. Moved screenshot evidence into simple numbered folders for backend setup, frontend shell, and Jira process proof.

### Why It Changed

1. The sprint board now matches the real project state.
2. Evidence is easier to find for the report and lecturer review.
3. The remaining Sprint 1 work is now clearly limited to database connection and migrations.

### Evidence

1. `assets/screenshots/tests/backend-setup/`
2. `assets/screenshots/tests/frontend-shell/`
3. `assets/screenshots/tests/jira/009_sprint-1-board.png`

### Next Steps

1. Build the PostgreSQL connection layer
2. Create the first migration structure
