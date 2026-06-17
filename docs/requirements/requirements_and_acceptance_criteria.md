# Requirements And Acceptance Criteria

## How To Read This File

These are the active MVP requirements for the project.

They are not a claim that every requirement is already implemented in the current repo state. Right now the repo has the frontend shell, backend foundation, migrations, seed setup, auth, staff management, availability, leave, and shift routes. The assignment and rota requirements are still the main unfinished backend work.

## User Roles

### Manager

1. logs in
2. creates and updates staff records
3. reviews staff availability
4. reviews leave requests
5. creates shifts
6. assigns staff to shifts
7. views the weekly rota

### Staff

1. logs in
2. submits availability
3. requests leave
4. views own assigned shifts

## Functional Requirements

### FR-01 Authentication And Session Management

Description:
The system must authenticate users and create a secure session.

| ID | Acceptance Criteria |
| --- | --- |
| AUTH-01 | A registered user can log in with valid email and password credentials. |
| AUTH-02 | Invalid credentials return an authentication error without exposing whether the email exists. |
| AUTH-03 | A logged-in user receives a valid authenticated session. |
| AUTH-04 | A logged-in user can log out and the session becomes unusable. |
| AUTH-05 | Protected endpoints reject unauthenticated requests with `401`. |
| AUTH-06 | User role data is available after login for authorization checks. |

### FR-02 Role-Based Access Control

Description:
The backend must enforce `MANAGER` and `STAFF` privileges.

| ID | Acceptance Criteria |
| --- | --- |
| RBAC-01 | Staff users cannot access manager-only endpoints such as staff creation, shift creation, and leave approval. |
| RBAC-02 | Managers can access the routes needed to manage the rota workflow. |
| RBAC-03 | A staff user can access only their own availability, leave requests, and rota view. |
| RBAC-04 | Authorization checks are enforced on the server, not only in the frontend shell. |

### FR-03 Staff Record Management

Description:
Managers must be able to keep a staff list with role and contract-hour data.

| ID | Acceptance Criteria |
| --- | --- |
| STAFF-01 | A manager can create a new staff user account and linked staff profile. |
| STAFF-02 | A manager can edit a staff member's name, primary role, contract hours, phone number, and active status. |
| STAFF-03 | A manager can view a list of staff members. |
| STAFF-04 | A staff user cannot edit another staff member's record. |

### FR-04 Availability Submission

Description:
Staff must be able to submit working availability for a target week.

| ID | Acceptance Criteria |
| --- | --- |
| AV-01 | A staff user can submit availability for a selected `weekStart` date. |
| AV-02 | The system supports more than one availability window on the same day. |
| AV-03 | Availability entries include day, start time, end time, and status. |
| AV-04 | An availability entry with end time before start time is rejected. |
| AV-05 | A staff user can edit or delete their own future availability entries. |
| AV-06 | A manager can view all availability entries for a given week. |

### FR-05 Leave Request Workflow

Description:
Staff must be able to request leave and managers must be able to decide the request.

| ID | Acceptance Criteria |
| --- | --- |
| LR-01 | A staff user can submit a leave request with start date, end date, and reason. |
| LR-02 | A leave request where end date is before start date is rejected. |
| LR-03 | A leave request defaults to `PENDING` when created. |
| LR-04 | A manager can approve a pending leave request. |
| LR-05 | A manager can reject a pending leave request and optionally add a comment. |
| LR-06 | Approved leave blocks rota assignment for matching dates. |
| LR-07 | Staff users can view the status of their own leave requests. |

### FR-06 Shift Creation

Description:
Managers must be able to create shifts before assignment.

| ID | Acceptance Criteria |
| --- | --- |
| SHIFT-01 | A manager can create a shift with date, start time, end time, required role, and optional notes. |
| SHIFT-02 | A shift where end time is before start time is rejected. |
| SHIFT-03 | A shift can exist before any staff member is assigned to it. |
| SHIFT-04 | A manager can edit a shift. |
| SHIFT-05 | A manager can view all shifts for a selected week. |

### FR-07 Shift Assignment And Conflict Warnings

Description:
Managers must be able to assign staff while the system checks the common conflicts first.

| ID | Acceptance Criteria |
| --- | --- |
| ASSIGN-01 | A manager can assign a staff member to an unassigned shift. |
| ASSIGN-02 | The system blocks assignment if the staff member is on approved leave for that date. |
| ASSIGN-03 | The system blocks assignment if the staff member has an overlapping assigned shift. |
| ASSIGN-04 | The system blocks assignment if the staff member is unavailable during the shift time. |
| ASSIGN-05 | The system blocks assignment if the staff member role does not match the shift role. |
| ASSIGN-06 | The system warns the manager when the assignment would exceed contract hours for the week. |
| ASSIGN-07 | The system stores the assignment actor and timestamp. |

### FR-08 Weekly Rota View

Description:
The system must show weekly shifts to the correct user.

| ID | Acceptance Criteria |
| --- | --- |
| ROTA-01 | A manager can view the full rota for a selected week. |
| ROTA-02 | A staff user can view only their own assigned shifts for a selected week. |
| ROTA-03 | The rota view shows shift date, start time, end time, and assigned staff name where relevant. |
| ROTA-04 | The rota can be filtered by week. |

## Deferred Requirements From The Older Draft

These were part of the wider version and can return later if time allows:

1. smart candidate suggestions
2. swap requests
3. reports
4. broader audit logging features
5. rota publication state

## Non-Functional Requirements

1. the system must work on desktop and mobile-width browsers
2. the backend must validate all state-changing input
3. passwords must be hashed with `bcrypt`
4. the application must return meaningful HTTP status codes
5. the project must keep requirement-to-test traceability
6. the app must run locally and in a hosted setup using Render and Neon

## Current Repo Note

Right now the repo already supports or partially supports:

1. frontend shell on desktop and mobile-width layouts
2. backend JSON handling
3. PostgreSQL connectivity
4. schema and seed migration flow
5. login with server-side session creation
6. logout with session destroy
7. current-user lookup through `GET /api/v1/auth/me`
8. role-based access checks for manager-only routes
9. staff record management
10. availability create, list, edit, and delete workflows
11. leave submit, approve, reject, list, and withdraw workflows
12. shift create, list, edit, and delete workflows
13. `shift_assignments` storage schema
14. backend route tests for the completed route layers

It does not yet fully support:

1. assignment endpoints
2. backend assignment conflict checks
3. contract-hours warnings
4. rota endpoint
5. manager and staff rota views backed by saved assignments
6. broader automated requirement-level test coverage for assignment and rota

## Traceability Rule

1. every backlog item should point to one or more requirement IDs
2. every test case should point to one or more acceptance IDs
3. every strong report claim should map to repo or screenshot evidence
