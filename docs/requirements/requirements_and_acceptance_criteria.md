# Requirements And Acceptance Criteria

These are the current MVP requirements. They describe the workflows now in the repo, while the last section keeps the remaining proof and deferred work separate.

## Roles

### Manager

1. logs in and manages the staff list
2. creates shifts and assigns staff
3. reviews leave, password requests, and swap decisions
4. views and edits the weekly rota

### Staff

1. logs in and sees the weekly rota
2. requests and checks time off
3. opens a swap option only from their own future assigned shift
4. can target one colleague or leave the request open to eligible staff
5. sees previous worked weeks and shared swap requests

## Functional requirements

### FR-01 Authentication and sessions

| ID | Acceptance criterion |
| --- | --- |
| AUTH-01 | A registered user can log in with a valid email and password. |
| AUTH-02 | Invalid credentials return the same authentication failure without account enumeration. |
| AUTH-03 | Login creates a server-side session and `/api/v1/auth/me` returns the current user. |
| AUTH-04 | Logout destroys the session and protected routes reject it afterwards. |
| AUTH-05 | Production session configuration fails closed when required secrets are missing. |

### FR-02 Password recovery

| ID | Acceptance criterion |
| --- | --- |
| AUTH-07 | A user can request a reset link with an email address. |
| AUTH-08 | The response does not reveal whether an account exists. |
| AUTH-09 | The reset token is hashed, expires, and cannot be reused. |
| AUTH-10 | Managers can see a password request card without seeing passwords or reset tokens. |

### FR-03 Staff records and roles

| ID | Acceptance criterion |
| --- | --- |
| STAFF-01 | A manager can create a staff account and linked profile. |
| STAFF-02 | A manager can edit full name, role, contract hours, phone, and active state. |
| STAFF-03 | Staff cannot create or edit another staff record. |

### FR-04 Leave

| ID | Acceptance criterion |
| --- | --- |
| LR-01 | Staff can submit start date, end date, and reason. |
| LR-02 | An end date before the start date is rejected. |
| LR-03 | New leave requests start as `PENDING`. |
| LR-04 | Managers can approve or reject a pending request with an optional comment. |
| LR-05 | Staff can withdraw their own pending request. |
| LR-06 | Approved leave blocks a matching assignment. |

### FR-05 Shifts and assignments

| ID | Acceptance criterion |
| --- | --- |
| SHIFT-01 | A manager can create, edit, list, and delete a shift. |
| SHIFT-02 | A shift must have a valid date, time range, and required role. |
| ASSIGN-01 | A manager can assign, change, and remove one staff member on a shift. |
| ASSIGN-02 | Duplicate, inactive, wrong-role, approved-leave, overlapping, and touching-shift assignments are blocked. |
| ASSIGN-03 | More than five shifts or forty hours in one week is blocked. |
| ASSIGN-04 | Contract-hour excess returns a warning when the hard limits still allow the save. |
| ASSIGN-05 | The saved record contains the assignment actor and timestamp. |

### FR-06 Rota

| ID | Acceptance criterion |
| --- | --- |
| ROTA-01 | The rota shows the selected week with Monday to Sunday columns. |
| ROTA-02 | Staff can view the full roster but cannot perform manager edit actions. |
| ROTA-03 | Managers can use department tabs for Bar, Floor, Kitchen, and Kitchen Porter. |
| ROTA-04 | Previous week, current week, and next week navigation changes the requested week. |

### FR-07 Shift swaps

| ID | Acceptance criterion |
| --- | --- |
| SWAP-01 | Only the logged-in owner can start a swap from a future assignment. |
| SWAP-02 | The request can name one target or remain open to eligible staff. |
| SWAP-03 | The named target is the only staff member allowed to accept a targeted request. |
| SWAP-04 | A manager approves or rejects an accepted swap. |
| SWAP-05 | The assignment changes only after acceptance, manager approval, and a final eligibility check. |

## Non-functional requirements

1. all state-changing routes validate input on the backend
2. manager and ownership rules do not depend only on hidden frontend buttons
3. passwords are handled with bcrypt hashes
4. protected routes use server-side sessions
5. the frontend works at desktop and mobile widths
6. errors use useful HTTP status codes and a consistent response shape
7. requirement evidence can be tied to route tests, migration output, screenshots, or manual checks

## Deferred work

The following are not acceptance criteria for this MVP: full automatic scheduling, payroll, POS integration, native mobile app, multi-branch support, reports, and an audit viewing page. Audit writes already exist for shift and assignment changes, but the screen is still outside the current build.
