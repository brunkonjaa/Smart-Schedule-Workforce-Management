# Decision Log

## Why This File Exists

This file records the main project decisions, including the ones that later changed.

I kept the older decisions in here on purpose. They show how the repo moved from an earlier direction into the current one instead of pretending the final version appeared fully formed.

## Decision Format

Each decision keeps the same parts:

1. problem
2. options considered
3. selected option
4. reason for selection
5. drawback accepted
6. status

## Decisions

### D-01 Project Selection

Problem:
I needed a project that was realistic enough to have linked workflows, roles, and relational data, but still small enough to finish in a semester.

Options considered:

1. Smart Schedule
2. Hospitality Training Portal
3. Web Accessibility Auditor

Selected option:
`Smart Schedule`

Reason for selection:
This one had the best mix of user roles, workflow logic, and database structure. It also fits hospitality well, so the use case does not feel forced.

Drawback accepted:
Scheduling logic adds more moving parts than a plain CRUD app.

Status:
Active

### D-02 Scope Control

Problem:
The idea could get too wide very easily.

Options considered:

1. broad workforce platform
2. tight MVP

Selected option:
`Tight MVP`

Reason for selection:
It made more sense to finish the main rota flow properly than to spread time across too many half-built features.

Drawback accepted:
Some useful ideas had to move out of scope.

Status:
Active

### D-03 Backend Technology

Problem:
The backend needed routing, session auth, role checks, and business logic without adding a heavy framework cost.

Options considered:

1. Java Spring Boot
2. Node.js with Express
3. Firebase backend services

Selected option:
`Node.js with Express`

Reason for selection:
This was enough for the project and simpler to move through step by step.

Drawback accepted:
I have to keep my own folder structure and conventions tidy.

Status:
Active

### D-04 Frontend Technology

Problem:
The frontend needed forms, views for two roles, and API integration later on.

Options considered:

1. plain HTML, CSS, and JavaScript
2. React
3. Express server-rendered templates

Selected option:
`HTML, CSS, and JavaScript`

Reason for selection:
This kept the UI easier to control and easier to explain. For the module I did not need a frontend framework just to prove the workflows.

Drawback accepted:
I lose some framework structure and need to stay disciplined in my own code.

Status:
Active

### D-05 Original Database Choice

Problem:
The project needed a relational database decision early on.

Options considered:

1. MySQL
2. PostgreSQL
3. MongoDB

Selected option:
`MySQL`

Reason for selection:
That matched the older planning direction at the time.

Drawback accepted:
The repo later started splitting because newer thinking was already leaning toward PostgreSQL.

Status:
Superseded by `D-10`

### D-06 Original Smart Feature Direction

Problem:
I originally wanted one stronger feature beyond the basic CRUD flows.

Options considered:

1. full auto-scheduler
2. constraint-aware suggestion engine
3. no smart feature

Selected option:
`Constraint-aware suggestion engine`

Reason for selection:
At the time it looked like a middle ground between simple CRUD and a full automatic scheduler.

Drawback accepted:
It widened the project before the base workflow was stable.

Status:
Deferred by `D-11`

### D-07 Security Direction

Problem:
The app needed practical security without turning into an enterprise IAM project.

Options considered:

1. minimal login only
2. practical security controls
3. heavy enterprise-style security stack

Selected option:
`Practical security controls`

Reason for selection:
Hashed passwords, backend role checks, validation, and testable ownership rules are enough for this stage.

Drawback accepted:
Advanced controls like MFA are out of scope.

Status:
Active

### D-08 Delivery Approach

Problem:
The project could become disconnected if I treated each layer like a separate mini-project.

Options considered:

1. database first, then backend, then frontend
2. vertical slices

Selected option:
`Vertical slices`

Reason for selection:
That makes the project easier to demo and easier to verify in smaller chunks.

Drawback accepted:
It only works if the docs, Jira trail, and file sequence stay consistent.

Status:
Active

### D-09 Original Stack Lock

Problem:
Earlier drafts had too many mixed stack ideas.

Options considered:

1. continue with React, Spring Boot, and PostgreSQL
2. use HTML/CSS/JavaScript, Node.js/Express, and MySQL
3. keep mixing old and new directions

Selected option:
`HTML/CSS/JavaScript + Node.js/Express + MySQL`

Reason for selection:
At that stage it reduced some of the drift.

Drawback accepted:
It still was not the final version and had to be revised again.

Status:
Superseded by `D-10`

### D-10 Database And Hosting Revision

Problem:
The repo docs and the proposal stopped matching each other.

Options considered:

1. keep MySQL and rewrite the proposal backward
2. move the repo to PostgreSQL and match the proposal
3. keep both versions alive in different docs

Selected option:
`PostgreSQL + Neon Free + Render Free Web Service`

Reason for selection:
This lined the repo back up with the proposal and gave me a clean hosted direction for the module.

Drawback accepted:
Some older notes became historical instead of current.

Status:
Active

### D-11 MVP Tightening Before Implementation

Problem:
The project had grown into something broader than I could defend and finish cleanly.

Options considered:

1. build the larger version with swaps, reports, suggestions, and more audit-heavy flows
2. tighten the project to the core rota workflow
3. cut too much and weaken the project

Selected option:
`Core rota MVP`

Reason for selection:
This version is still strong enough for the module and much more believable to finish properly.

Drawback accepted:
Earlier ideas moved into deferred work instead of the first build.

Status:
Active

### D-12 Documentation Reduction

Problem:
The repo had too many markdown files saying similar things.

Options considered:

1. keep the full document set
2. keep only build-facing docs
3. delete almost everything

Selected option:
`Keep only build-facing docs`

Reason for selection:
The repo should support implementation. The larger written explanations can live in the final report instead of being repeated everywhere.

Drawback accepted:
Some background notes were dropped from the active repo structure.

Status:
Active

### D-13 Frontend Shell Before Backend Wiring

Problem:
The backend could keep growing without a stable UI target.

Options considered:

1. keep building backend pieces first
2. build the frontend shell first
3. try to build both at the same time

Selected option:
`Build the frontend shell first`

Reason for selection:
That gave me visible target pages for the main workflows before the backend routes existed.

Drawback accepted:
The shell uses preview data and placeholder interactions for now.

Status:
Active

### D-14 Jira For Sprint Tracking

Problem:
The project trail needed something clearer than local notes alone.

Options considered:

1. keep tracking only in local notes
2. use Jira for sprint tracking and ticket status
3. wait and organize that later

Selected option:
`Use Jira for sprint tracking and ticket status`

Reason for selection:
This makes the work sequence easier to prove. It also forces the sprint state to line up with what I say happened in the repo.

Drawback accepted:
It adds admin work around screenshots, ticket state, and naming.

Status:
Active
