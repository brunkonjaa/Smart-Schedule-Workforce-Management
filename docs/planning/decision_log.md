# Decision Log

## Purpose

This file records project decisions, reversals, and trade-offs. Some older decisions stay here on purpose. They show progress.

## Decision Format

1. Problem
2. Options considered
3. Selected option
4. Reason for selection
5. Drawbacks accepted
6. Status

## Decisions

### D-01 Project Selection

Problem:
The project needed a realistic software problem with enough technical depth.

Options considered:

1. Smart Schedule
2. Hospitality Training Portal
3. Web Accessibility Auditor

Selected option:
`Smart Schedule`

Reason for selection:
It has clear user roles, linked data, and real workflow problems.

Drawbacks accepted:
Scheduling logic adds complexity.

Status:
Active

### D-02 Scope Control

Problem:
The project needed to stay buildable within the semester.

Options considered:

1. Broad workforce platform
2. Tight MVP

Selected option:
`Tight MVP`

Reason for selection:
It is better to finish the main workflow than half-build many features.

Drawbacks accepted:
Some useful features stay out of scope.

Status:
Active

### D-03 Backend Technology

Problem:
The backend needed REST endpoints, auth, role checks, and business logic.

Options considered:

1. Java Spring Boot
2. Node.js with Express
3. Firebase backend services

Selected option:
`Node.js with Express`

Reason for selection:
It is enough for the project and does not add framework overhead.

Drawbacks accepted:
The project needs its own folder discipline.

Status:
Active

### D-04 Frontend Technology

Problem:
The frontend needed forms, role-based views, and API calls.

Options considered:

1. Plain HTML, CSS, and JavaScript
2. React
3. Express server-rendered templates

Selected option:
`HTML, CSS and JavaScript`

Reason for selection:
It is enough for the UI and keeps the build simple.

Drawbacks accepted:
Frontend JavaScript needs to stay organized.

Status:
Active

### D-05 Original Database Choice

Problem:
The project needed a relational database.

Options considered:

1. MySQL
2. PostgreSQL
3. MongoDB

Selected option:
`MySQL`

Reason for selection:
It matched the earlier planning direction and was easy to justify from the database module.

Drawbacks accepted:
The repo later split into two directions because some newer docs had already moved toward PostgreSQL.

Status:
Superseded by `D-10`

### D-06 Original Smart Feature Direction

Problem:
The project wanted one stronger feature beyond plain CRUD.

Options considered:

1. Full auto-scheduler
2. Constraint-aware suggestion engine
3. No smart feature

Selected option:
`Constraint-aware suggestion engine`

Reason for selection:
It looked like a good middle ground at the time.

Drawbacks accepted:
It widened the scope.

Status:
Deferred by `D-11`

### D-07 Security Direction

Problem:
The project needed basic security without becoming an enterprise IAM project.

Options considered:

1. Minimal login only
2. Practical security controls
3. Heavy enterprise-style security stack

Selected option:
`Practical security controls`

Reason for selection:
It covers the important parts: hashed passwords, backend RBAC, validation, and testable access control.

Drawbacks accepted:
Advanced controls like MFA stay out of scope.

Status:
Active

### D-08 Delivery Approach

Problem:
The project could become fragmented if each layer was built in isolation.

Options considered:

1. Database first, then backend, then frontend
2. Vertical slices

Selected option:
`Vertical slices`

Reason for selection:
It makes each sprint more testable and easier to demo.

Drawbacks accepted:
Planning has to stay tight.

Status:
Active

### D-09 Original Stack Lock

Problem:
Earlier drafts had mixed stack ideas.

Options considered:

1. Continue with React, Spring Boot, and PostgreSQL
2. Use HTML/CSS/JavaScript, Node.js/Express, and MySQL
3. Mix old and new directions

Selected option:
`HTML/CSS/JavaScript + Node.js/Express + MySQL`

Reason for selection:
It removed drift at that stage.

Drawbacks accepted:
The decision did not last because the proposal and repo later moved again.

Status:
Superseded by `D-10`

### D-10 Database and Hosting Revision

Problem:
The repo docs and the current proposal no longer matched.

Options considered:

1. Keep MySQL and rewrite the proposal back
2. Move the repo to PostgreSQL and match the proposal
3. Keep both versions in different docs

Selected option:
`PostgreSQL + Neon Free + Render Free Web Service`

Reason for selection:
This matches the current proposal. It also gives a cleaner hosted setup for the semester project.

Drawbacks accepted:
This means some older docs become historical rather than current.

Status:
Active

### D-11 MVP Tightening Before Implementation

Problem:
The repo had grown into a larger system than the proposal.

Options considered:

1. Build the larger version with swaps, reports, suggestions, and audit-heavy flows
2. Tighten the MVP to core rota workflows
3. Drop too much and make the project too small

Selected option:
`Core rota MVP`

Reason for selection:
The tighter version is more realistic and still strong enough for the project.

Drawbacks accepted:
Some earlier ideas move into deferred work.

Status:
Active

### D-12 Documentation Reduction

Problem:
The repo had too many overlapping markdown files. A lot of that content would be explained again in the final report.

Options considered:

1. Keep the full document set
2. Keep only build-facing docs
3. Delete almost all docs

Selected option:
`Keep only build-facing docs`

Reason for selection:
The repo should help implementation, not repeat the future report.

Drawbacks accepted:
Some background notes and duplicate summaries are removed from the active repo structure.

Status:
Active
