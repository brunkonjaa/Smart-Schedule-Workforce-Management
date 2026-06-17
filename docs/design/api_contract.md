# API Contract

## Read This File The Right Way

This file mixes two things:

1. the route set that is actually live in the repo now
2. the target contract for the parts that still come after this checkpoint

I am writing it that way on purpose so the design stays honest. Right now the backend is no longer only in foundation and identity setup. Auth, staff management, availability, leave, shifts, and the first assignment route are already live in the repo. The assignment conflict engine and rota endpoints still come after that.

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

## Current Session Base Note

The backend app now boots with PostgreSQL-backed session middleware through `express-session` and `connect-pg-simple`.

That matters because the auth direction is no longer abstract. The app already has:

1. `backend/src/config/session.js`
2. `smart_schedule.sid` cookie naming
3. `user_sessions` store configuration
4. production `trust proxy` handling in `backend/src/app.js`

That part is no longer just planned. The session base is live now because the auth routes are using it already. What is still missing is the real assignment conflict layer and the rota route layer.

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

The auth routes above are live now. Staff, availability, leave, shift, and basic assignment routes are live as well. The rota route below is still a target route.

That means:

1. the route shapes here are a mix of current and next
2. the repo already exposes most of the staff, availability, leave, shift, and assignment save surface
3. assignment conflict checks and rota logic still need real backend code

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
  "email": "staff1@example.com",
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

## Availability Routes

### `GET /api/v1/availability`

Purpose:
View availability entries. Live now.

Current query params:

1. `weekStart` required date
2. `staffProfileId` optional for manager use

### `POST /api/v1/availability`

Purpose:
Create availability entries for the logged-in staff user. Live now.

Current request shape:

```json
{
  "weekStart": "2026-06-08",
  "entries": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "17:00",
      "status": "AVAILABLE"
    }
  ]
}
```

Current success:
`201`

### `PUT /api/v1/availability/{availabilityId}`

Purpose:
Update own future availability entry. Live now.

### `DELETE /api/v1/availability/{availabilityId}`

Purpose:
Delete own future availability entry. Live now.

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

## Assignment Route

### `POST /api/v1/assignments`

Purpose:
Assign a staff member to a shift. Manager only. Live now as a basic save route.

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
This route stores the assignment and rejects assigning the same shift twice. It does not yet enforce leave, overlap, availability, role, or contract-hours rules.

Possible business-rule errors:

1. `409` duplicate assignment conflict - live now
2. `404` unknown shift or staff record - live now
3. `409` leave conflict - planned next
4. `409` overlap conflict - planned next
5. `409` availability conflict - planned next
6. `409` role conflict - planned next

## Rota Route

### `GET /api/v1/rota`

Purpose:
View the weekly rota.

Planned query params:

1. `weekStart` required

Planned behavior:

1. manager sees the full weekly rota
2. staff sees only their own assigned shifts

## Security Rules For The Contract

1. all state-changing routes require authentication
2. manager-only routes require backend role checks
3. staff routes need ownership checks where relevant
4. responses must not expose password hashes or secrets
5. validation failures return `400`
6. unauthenticated access returns `401`
7. forbidden access returns `403`
8. business-rule conflicts return `409`
