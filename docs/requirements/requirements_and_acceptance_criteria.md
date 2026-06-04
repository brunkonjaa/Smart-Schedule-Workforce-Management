# Requirements and Acceptance Criteria

## Change Note

- Previous position: this file included smart suggestions, swaps, reports, and audit logging as active requirements.
- Updated position: this file now covers the current MVP only.
- Why: to match the current proposal and build plan.

## User Roles

### Manager

1. Logs in
2. Creates and updates staff records
3. Reviews staff availability
4. Reviews leave requests
5. Creates shifts
6. Assigns staff to shifts
7. Views the weekly rota

### Staff

1. Logs in
2. Submits availability
3. Requests leave
4. Views own assigned shifts

## Functional Requirements

### FR-01 Authentication and Session Management

Description: The system must authenticate users and create a secure session.

| ID | Acceptance Criteria |
| --- | --- |
| AUTH-01 | A registered user can log in with valid email and password credentials. |
| AUTH-02 | Invalid credentials return an authentication error without exposing whether the email exists. |
| AUTH-03 | A logged-in user receives a valid authenticated session. |
| AUTH-04 | A logged-in user can log out and the session becomes unusable. |
| AUTH-05 | Protected endpoints reject unauthenticated requests with `401`. |
| AUTH-06 | User role data is available after login for authorization checks. |

### FR-02 Role-Based Access Control

Description: The backend must enforce `Manager` and `Staff` privileges.

| ID | Acceptance Criteria |
| --- | --- |
| RBAC-01 | Staff users cannot access manager-only endpoints such as staff creation, shift creation, and leave approval. |
| RBAC-02 | Managers can access operational endpoints needed to manage the rota. |
| RBAC-03 | A staff user can access only their own availability, leave requests, and rota view. |
| RBAC-04 | Authorization checks are enforced on the server. |

### FR-03 Staff Record Management

Description: Managers must be able to keep a staff list with role and contract-hour data.

| ID | Acceptance Criteria |
| --- | --- |
| STAFF-01 | A manager can create a new staff user account and linked staff profile. |
| STAFF-02 | A manager can edit a staff member's name, primary role, contract hours, phone number, and active status. |
| STAFF-03 | A manager can view a list of staff members. |
| STAFF-04 | A staff user cannot edit another staff member's record. |

### FR-04 Availability Submission

Description: Staff must be able to submit working availability for a target week.

| ID | Acceptance Criteria |
| --- | --- |
| AV-01 | A staff user can submit availability for a selected `weekStart` date. |
| AV-02 | The system supports more than one availability window on the same day. |
| AV-03 | Availability entries include day, start time, end time, and status. |
| AV-04 | An availability entry with end time before start time is rejected. |
| AV-05 | A staff user can edit or delete their own future availability entries. |
| AV-06 | A manager can view all availability entries for a given week. |

### FR-05 Leave Request Workflow

Description: Staff must be able to request leave and managers must be able to decide the request.

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

Description: Managers must be able to create shifts before assignment.

| ID | Acceptance Criteria |
| --- | --- |
| SHIFT-01 | A manager can create a shift with date, start time, end time, required role, and optional notes. |
| SHIFT-02 | A shift where end time is before start time is rejected. |
| SHIFT-03 | A shift can exist without an assigned staff member. |
| SHIFT-04 | A manager can edit a shift. |
| SHIFT-05 | A manager can view all shifts for a selected week. |

### FR-07 Shift Assignment and Conflict Warnings

Description: Managers must be able to assign staff to shifts while the system checks common conflicts.

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

Description: The system must show weekly shifts to the correct user.

| ID | Acceptance Criteria |
| --- | --- |
| ROTA-01 | A manager can view the full rota for a selected week. |
| ROTA-02 | A staff user can view only their own assigned shifts for a selected week. |
| ROTA-03 | The rota view shows shift date, start time, end time, and assigned staff name where relevant. |
| ROTA-04 | The rota can be filtered by week. |

## Deferred Requirements From Earlier Drafts

These were in older versions and may return later:

1. smart candidate suggestions
2. swap requests
3. reports
4. audit logging features beyond basic backend support
5. rota publication state

## Non-Functional Requirements

1. The system must work on desktop and mobile-width browsers.
2. The backend must validate all state-changing input.
3. Passwords must be hashed with `bcrypt`.
4. The application must return meaningful HTTP status codes.
5. The project must keep clear requirement-to-test traceability.
6. The app must run locally and in a hosted setup using Render and Neon.

## Traceability Rule

1. Every backlog item should reference one or more requirement IDs.
2. Every test case should reference one or more acceptance IDs.
3. Every major report claim should map to evidence.
