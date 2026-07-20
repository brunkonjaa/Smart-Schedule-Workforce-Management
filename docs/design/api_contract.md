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
  "status": "ok"
}
```

If the database check fails, the route returns:

```json
{
  "database": "disconnected",
  "status": "error"
}
```

### `POST /api/v1/auth/login`

Purpose:
Log in a seeded or registered user with email and password.

Current request:

```json
{
  "email": "manager@example.com",
  "password": "ManagerPass123!"
}
```

Current success `200`:

```json
{
  "message": "Login successful.",
  "user": {
    "id": "uuid",
    "email": "manager@example.com",
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
    "email": "manager@example.com",
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
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

Current success:
`200`

### `POST /api/v1/auth/password-reset/request`

Purpose:
Create a reset request and send a reset link when email delivery is configured.

The response is `202` with a generic message for both matching and non-matching active emails. This avoids account enumeration. Local development can print the generated link through the configured email service.

### `POST /api/v1/auth/password-reset/confirm`

Purpose:
Consume a valid reset token and set a new password. Invalid, expired, or already-used tokens return `400`.

### `GET /api/v1/auth/password-reset/requests`

Purpose:
Show recent password recovery requests to managers. Passwords and reset tokens are not returned.

## Current Session Base Note

The backend app now boots with PostgreSQL-backed session middleware through `express-session` and `connect-pg-simple`.

That matters because the auth direction is no longer abstract. The app already has:

1. `backend/src/config/session.js`
2. `smart_schedule.sid` cookie naming
3. `user_sessions` store configuration
4. production `trust proxy` configuration in `backend/src/app.js`

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
  "email": "alexbyrnefake@gmail.com",
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
