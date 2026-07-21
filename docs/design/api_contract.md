# API Contract

## Read This File The Right Way

This file records the route shapes in the current repo. Password recovery, shift swaps, rota reads, assignment changes, audit reads, and NodyChat conversations are included. Weekly availability is historical and is not a live route.

## Current Live Backend Surface

### `GET /health`

Purpose:
Confirm that the backend is up and the PostgreSQL connection can respond.

Current response shape:

```json
{
  "database": "connected",
  "releaseCommit": "40-character Render Git commit or null",
  "status": "ok"
}
```

`releaseCommit` is only accepted from Render's `RENDER_GIT_COMMIT` value when it is a full hexadecimal SHA. Local runs return `null`. This lets the final deployment be matched to the exact GitHub commit without exposing an arbitrary environment value.

If the database check fails, the route returns:

```json
{
  "database": "disconnected",
  "releaseCommit": "40-character Render Git commit or null",
  "status": "error"
}
```

### `POST /api/v1/auth/login`

Purpose:
Log in a seeded or registered user with email and password.

Current request:

```json
{
  "email": "maeveoconnorfake@gmail.com",
  "password": "<submitted password>"
}
```

Current success `200`:

```json
{
  "message": "Login successful.",
  "user": {
    "id": "uuid",
    "email": "maeveoconnorfake@gmail.com",
    "role": "MANAGER",
    "staffProfileId": "uuid"
  }
}
```

Current error `401`:

```json
{
  "error": "Authentication Failed",
  "message": "Invalid email or password."
}
```

Current validation error `400`:

```json
{
  "details": [
    "password is required"
  ],
  "error": "Validation Failed",
  "message": "The login request is missing required fields."
}
```

### `GET /api/v1/auth/me`

Purpose:
Return the current authenticated user from the server-side session.

Current success `200`:

```json
{
  "user": {
    "id": "uuid",
    "email": "maeveoconnorfake@gmail.com",
    "role": "MANAGER",
    "staffProfileId": "uuid"
  }
}
```

Current unauthenticated error `401`:

```json
{
  "error": "Authentication Required",
  "message": "You must be logged in to access this route."
}
```

### `POST /api/v1/auth/logout`

Purpose:
Destroy the current session and clear the `smart_schedule.sid` cookie.

Current success:
`204`

### `POST /api/v1/auth/change-password`

Purpose:
Change the current user password after checking the existing password.

Current request:

```json
{
  "currentPassword": "<current password>",
  "newPassword": "<new 15-128 character password>"
}
```

Current success:
`200`

### `POST /api/v1/auth/password-reset/request`

Purpose:
Create a reset request and send a reset link when email delivery is configured.

The response is `202` with a generic message for both matching and non-matching active emails. This avoids account enumeration. Reset links are sent through the configured email service and are not printed by the backend.

### `POST /api/v1/auth/password-reset/confirm`

Purpose:
Consume a valid reset token and set a new password. Invalid, expired, or already-used tokens return `400`.

### `GET /api/v1/auth/password-reset/requests`

Purpose:
Show recent password recovery requests to managers or administrators. Passwords and reset tokens are not returned.

## Administrator Authentication And Activation

### `GET /api/v1/auth/bootstrap/admin/status`

Returns whether the fixed first-Admin setup is still required and whether the server has been configured for it. It never returns the bootstrap value.

### `POST /api/v1/auth/bootstrap/first-admin`

Creates `Bruno Suric` at the fixed Admin email once, with no staff profile. The caller submits the configured bootstrap value and a chosen 15-128 character password. The endpoint is rate limited, records success or failure without secret values, and returns `409` after the first active non-review Admin exists.

### `POST /api/v1/auth/admin-invitations/accept`

Consumes one normal Admin invitation and saves the submitted password with peppered Argon2id. The account stays inactive and the server keeps a short pending activation session until passkey registration succeeds. Invalid, expired, cancelled and used tokens all receive the same invalid-invitation response.

### Admin passkey routes

- `POST /api/v1/auth/passkeys/registration/options`
- `POST /api/v1/auth/passkeys/registration/verify`
- `POST /api/v1/auth/passkeys/login/options`
- `POST /api/v1/auth/passkeys/login/verify`

Manager and Admin sessions can register a passkey. Registration verification also completes a pending normal Admin invitation. Reviewer registration is optional, but if the reviewer adds a passkey then later logins use the passkey second step.

## Administrator Account Routes

All `/api/v1/admin` routes require the `ADMIN` role. Ordinary Admin accounts also need an active passkey before the workspace routes open. The account-specific submission reviewer is the only exception. Mutation routes use the same-origin mutation header, and account-changing operations require the Admin password to have been rechecked in the current server session during the previous five minutes.

### `POST /api/v1/admin/reauthenticate`

Checks the current Admin password and records only the server-side confirmation time.

### `GET /api/v1/admin/accounts`

Returns Admin account state plus invitation state. It does not return password hashes, token hashes, pepper versions, session rows or passkey credential material.

### Admin creation routes

- `POST /api/v1/admin/invitations`
- `POST /api/v1/admin/invitations/{invitationId}/cancel`
- `POST /api/v1/admin/submission-reviewers`

Normal Admin creation sends a one-use activation link and stores only its SHA-256 token hash. The submission-reviewer route works only when `SUBMISSION_REVIEW_ACCOUNTS_ENABLED=true`; the reviewer flag is stored against that account and is not used for normal Admin creation.

### Account state routes

- `POST /api/v1/admin/accounts/{userId}/enable`
- `POST /api/v1/admin/accounts/{userId}/disable`
- `POST /api/v1/admin/accounts/{userId}/revoke-sessions`
- `POST /api/v1/admin/accounts/{userId}/role`

These routes increment `session_version`, so an older target session fails its next protected request. The final active non-review Admin cannot be disabled or demoted. A standalone Admin without a staff profile cannot be changed to Manager or Staff.

### Passkey and event routes

- `GET /api/v1/admin/accounts/{userId}/passkeys`
- `POST /api/v1/admin/accounts/{userId}/passkeys/{passkeyId}/revoke`
- `GET /api/v1/admin/security-events`

The passkey response contains the device label and dates only. The security-event response uses sanitized metadata and does not include password, token, pepper, raw session or credential fields.

## Current Session Base Note

The backend app now boots with PostgreSQL-backed session middleware through `express-session` and `connect-pg-simple`.

That matters because the auth direction is no longer abstract. The app already has:

1. `backend/src/config/session.js`
2. `smart_schedule.sid` cookie naming
3. `user_sessions` store configuration
4. production `trust proxy` configuration in `backend/src/app.js`

Admin sessions ignore Remember me. Their current policy is a 30-minute idle timeout and an eight-hour absolute lifetime. The session also carries the account `session_version`, which is checked against PostgreSQL on protected requests.

That part is no longer just planned. The session base is live now because the auth routes are using it already. Assignment conflict checks, contract-hours warnings, the rota route layer, and audit log writes are now live too, while deployment checks still come later.

## Contract Conventions For The Next Routes

For the current and next routes, these are the rules I am keeping:

1. base path: `/api/v1`
2. auth style: server-side session with `express-session`
3. response type: `application/json`
4. timestamps: ISO 8601
5. errors should follow one shared shape

Example error payload:

```json
{
  "timestamp": "2026-06-11T16:00:00Z",
  "status": 400,
  "error": "Validation Failed",
  "message": "endDate must be on or after startDate",
  "path": "/api/v1/leave-requests"
}
```

## Current Build Reality

The auth routes above are live now. Staff, leave, shift, assignment, swap, and rota routes are live as well.

That means:

1. the route shapes here are a mix of current and next
2. the repo already exposes the staff, leave, shift, assignment, swap, and rota read surface
3. manager audit records can be read through the protected audit-log route

## Staff Routes

### `GET /api/v1/staff`

Purpose:
List staff records. Manager only. Live now.

### `POST /api/v1/staff`

Purpose:
Create a staff user and linked profile. Manager only. Live now.

Current request shape:

```json
{
  "email": "aoifeosullivanfake@gmail.com",
  "password": "InitialTempPassword123",
  "fullName": "Alex Byrne",
  "primaryRole": "FLOOR",
  "contractHours": 25,
  "phoneNumber": "0850000002"
}
```

Current success:
`201`

### `PUT /api/v1/staff/{staffId}`

Purpose:
Update a staff profile. Manager only. Live now.

Current success:
`200`

### `GET /api/v1/staff/{staffId}/summary`

Purpose:
Return the manager-only Employee Summary. This route is live now and its response uses `Cache-Control: no-store`.

Current query parameters:

1. `weekStart` is optional. When supplied it must be a Monday in `YYYY-MM-DD` form. The current calendar week is used otherwise.
2. `source` is optional and defaults to `direct`. The accepted values are `direct`, `rota`, `staff`, `time-off`, `swap-requests` and `audit-log`.
3. Extra query fields are rejected instead of being ignored.

The response has one `summary` object. It contains the approved employee identity/status fields, selected/current/previous week hours, selected-week assignments, later assignments through 30 calendar days, Time Off, Swap Requests and up to ten deleted or cancelled assignments. Cancelled and deleted hours stay separate from active hours. Time Off reasons and swap reasons are included for the on-screen manager view, but the print stylesheet excludes them.

An unauthenticated request returns `401`. An authenticated staff request returns `403` and writes `Denied Employee Summary access` before any employee record is returned. A successful manager request writes `Viewed Employee Summary`. A missing retained staff record returns `404`.

### `POST /api/v1/staff/{staffId}/summary/print-request`

Purpose:
Record `Requested Employee Summary print` before the frontend opens the browser print dialog. Manager only and mutation-header protected.

Current request shape:

```json
{
  "source": "staff"
}
```

The route returns `204` only after the append-only access record is saved. If this request fails, the frontend keeps the print dialog closed and gives the manager a Try Again control. The event proves that print was requested, not that paper or a PDF was produced.

## Leave Request Routes

### `GET /api/v1/leave-requests`

Purpose:
View leave requests. Live now.

Current behavior:

1. manager sees all
2. staff sees only own records

### `POST /api/v1/leave-requests`

Purpose:
Create a leave request. Live now.

Current request shape:

```json
{
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "reason": "Annual leave"
}
```

Current success:
`201`

### `PUT /api/v1/leave-requests/{leaveRequestId}/approve`

Purpose:
Approve leave. Manager only. Live now.

### `PUT /api/v1/leave-requests/{leaveRequestId}/reject`

Purpose:
Reject leave. Manager only. Live now.

### `DELETE /api/v1/leave-requests/{leaveRequestId}`

Purpose:
Withdraw own pending leave request. Staff only. Live now.

## Shift Routes

### `GET /api/v1/shifts`

Purpose:
List shifts for a week. Manager only. Live now.

### `POST /api/v1/shifts`

Purpose:
Create a shift. Manager only. Live now.

Current request shape:

```json
{
  "shiftDate": "2026-06-12",
  "startTime": "14:00",
  "endTime": "22:00",
  "requiredRole": "BAR",
  "notes": "Busy Friday"
}
```

### `PUT /api/v1/shifts/{shiftId}`

Purpose:
Update a shift. Manager only. Live now.

### `DELETE /api/v1/shifts/{shiftId}`

Purpose:
Delete a current or future shift. Manager only. Live now.

Audit note:
Shift create, update, and delete actions write to `audit_logs`. Managers can review the latest records through `GET /api/v1/audit-logs`.

## Assignment Route

### `POST /api/v1/assignments`

Purpose:
Assign a staff member to a shift. Manager only. Live now.

Current request:

```json
{
  "shiftId": "uuid",
  "staffProfileId": "uuid"
}
```

Current success:
`201`

Current duplicate-shift conflict:
`409`

Current limitation:
This route stores the assignment and blocks the main hard conflicts. Going over contract hours is shown as a warning, not a hard block, because a manager may still need to approve extra hours in a real week.

Current success body:

```json
{
  "assignment": {
    "id": "uuid",
    "shiftId": "uuid",
    "staffProfileId": "uuid"
  },
  "message": "Shift assignment created successfully.",
  "warnings": []
}
```

Contract-hours warning example:

```json
{
  "code": "CONTRACT_HOURS_EXCEEDED",
  "contractHours": 20,
  "projectedHours": 24,
  "overByHours": 4,
  "weekStart": "2026-07-13"
}
```

Possible business-rule errors:

1. `409` duplicate assignment conflict - live now
2. `404` unknown shift or staff record - live now
3. `409` leave conflict - live now
4. `409` overlap or back-to-back shift conflict - live now
5. `409` role conflict - live now
6. `409` inactive staff or non-open shift - live now
7. `warnings[]` contract-hours warning on successful create or update - live now

### `PUT /api/v1/assignments/{assignmentId}`

Purpose:
Change the staff member on a saved assignment. Manager only. Live now.

Request:

```json
{
  "staffProfileId": "uuid"
}
```

### `DELETE /api/v1/assignments/{assignmentId}`

Purpose:
Remove a saved assignment from a current or future shift. Manager only. Live now.

Audit note:
Assignment create, update, and delete actions write to `audit_logs`. Managers can read the latest records through `GET /api/v1/audit-logs`.

## Shift Swap Routes

### `GET /api/v1/shift-swaps`

Purpose:
List active future swap requests for the shared staff and manager request page.

### `GET /api/v1/shift-swaps/{swapId}`

Purpose:
Return one Swap Request to a manager. The completed-history link in Employee Summary uses this route to open the existing Swap Requests record view. Staff cannot use the route.

### `POST /api/v1/shift-swaps`

Purpose:
Let the logged-in staff member request a swap for their own future assignment.

Request:

```json
{
  "assignmentId": "uuid",
  "targetStaffProfileId": "uuid",
  "reason": "Personal appointment"
}
```

`targetStaffProfileId` can be omitted to leave the request open to an eligible colleague. The route returns `201` when the request is created.

### `POST /api/v1/shift-swaps/{swapId}/accept`

Purpose:
Allow the eligible target staff member to accept a pending request. The normal assignment checks run before acceptance.

### `PUT /api/v1/shift-swaps/{swapId}/approve`

Purpose:
Approve an accepted request and update the assignment through the normal assignment path.

### `PUT /api/v1/shift-swaps/{swapId}/reject`

Purpose:
Reject a pending or accepted request with an optional manager note.

## Rota Route

### `GET /api/v1/rota`

Purpose:
View the weekly rota. Live now.

Current query params:

1. `weekStart` required
2. `department` optional, defaults to `BAR`

Current behavior:

1. manager and staff can view the rota grid
2. department tabs use `BAR`, `FLOOR`, `KITCHEN`, and `OTHER`
3. manager responses include shift notes and status for editing context
4. staff responses omit manager-only shift note fields
5. `Populate next week` builds a client-side draft from the current weekly pattern and saves only after manager approval
6. state-changing rota actions still go through manager-only shift and assignment routes

## Audit Log Routes

### `GET /api/v1/audit-logs`

Purpose:
Return manager Rota activity. The route keeps the existing shift and assignment actions separate from employee access events. `page` is optional, must be a positive whole number and uses 25 records per page. The older `limit` query remains available from 1-200 for compatibility, but the Audit Log interface uses the fixed 25-record pages.

### `GET /api/v1/audit-logs/employee-access`

Purpose:
Return the append-only Employee access subpage. Manager only.

Current query parameters:

1. `page` defaults to `1` and must be a positive whole number.
2. page size is fixed at `25` in the backend.
3. requesting a page beyond `totalPages` returns `400`.

The response returns `logs` plus `pagination`. Each record has the action, actor name/email, target employee ID/name, source, result and creation time. Employee names are not links on this subpage, so an access-history row cannot open Employee Summary.

## NodyChat Routes And WebSocket

### `GET /api/v1/chat/messages`

Purpose:
Return the selected conversation, up to 100 messages, the current user's conversation list, active people, unread count and first unread message. Authentication is required. With no `conversationId`, the route opens the shared `WORKPLACE` conversation. A requested conversation is only selected when the current user has a participant row; otherwise the HTTP bootstrap falls back to `WORKPLACE`.

### `GET /api/v1/chat/people`

Purpose:
List other active users with active staff profiles where applicable. The current user is excluded.

### `POST /api/v1/chat/conversations`

Purpose:
Create or reopen one two-person `DIRECT` conversation.

Current request:

```json
{
  "userId": "uuid"
}
```

The target must be another active user. The sorted two-user `direct_key` prevents duplicate direct rooms for the same pair. The route requires authentication and the mutation-protection header.

### `POST /api/v1/chat/messages`

Purpose:
Store a message against the selected conversation. The service checks that the sender participates in the supplied conversation before insert. Message text is trimmed and must contain 1 to 1000 characters.

Current request:

```json
{
  "conversationId": "uuid",
  "message": "Can you check the Friday rota?"
}
```

Current limitation:
An outsider request for a direct conversation now returns `403 Forbidden` and does not insert a message. `backend/src/__tests__/chat-routes.test.js` covers that denial and also checks that an outsider bootstrap falls back to `WORKPLACE` without returning the private conversation.

### `WS /ws/chat`

Purpose:
Provide the live history, open-conversation, message and read actions used by `chat-ui.js`. The upgrade loads the existing server session, rejects inactive accounts and rejects a different Origin. Opening and reading a conversation checks participant rows. A saved message is broadcast only to connected participants. The UI currently requires the WebSocket connection for send/read actions; the HTTP message route exists but is not used as an automatic frontend fallback.

## Security Rules For The Contract

1. all state-changing routes require authentication
2. manager-only routes require backend role checks
3. staff routes need ownership checks where relevant
4. responses must not expose password hashes or secrets
5. validation failures return `400`
6. unauthenticated access returns `401`
7. forbidden access returns `403`
8. business-rule conflicts return `409`
9. direct-conversation reads, writes and live broadcasts must be limited to conversation participants
