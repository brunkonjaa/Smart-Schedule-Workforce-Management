# API Contract

## Read This File The Right Way

This file mixes two things:

1. the one route that is actually live in the repo now
2. the target contract for the next backend routes

I am writing it that way on purpose so the design stays honest. Right now the backend is still in foundation and identity setup, not in full feature delivery.

## Current Live Route

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

## Contract Conventions For The Next Routes

Once the main feature routes are added, these are the rules I am keeping:

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

These routes below are target routes, not already-implemented routes.

That means:

1. the route shapes are planned here first
2. the repo does not yet expose them
3. auth, RBAC, and ownership checks still need to be wired in backend code

## Authentication Routes

### `POST /api/v1/auth/login`

Purpose:
Log in a user.

Planned request:

```json
{
  "email": "manager@example.com",
  "password": "PlainTextPasswordInput"
}
```

Planned success `200`:

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

Planned error:

1. `401` for invalid credentials

### `POST /api/v1/auth/logout`

Purpose:
Log out the current user.

Planned success:
`204`

## Staff Routes

### `GET /api/v1/staff`

Purpose:
List staff records. Manager only.

### `POST /api/v1/staff`

Purpose:
Create a staff user and linked profile. Manager only.

Planned request:

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

Planned success:
`201`

### `PUT /api/v1/staff/{staffId}`

Purpose:
Update a staff profile. Manager only.

Planned success:
`200`

## Availability Routes

### `GET /api/v1/availability`

Purpose:
View availability entries.

Planned query params:

1. `weekStart` required date
2. `staffProfileId` optional for manager use

### `POST /api/v1/availability`

Purpose:
Create availability entries for the logged-in staff user.

Planned request:

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

Planned success:
`201`

### `PUT /api/v1/availability/{availabilityId}`

Purpose:
Update own future availability entry.

### `DELETE /api/v1/availability/{availabilityId}`

Purpose:
Delete own future availability entry.

## Leave Request Routes

### `GET /api/v1/leave-requests`

Purpose:
View leave requests.

Planned behavior:

1. manager sees all
2. staff sees only own records

### `POST /api/v1/leave-requests`

Purpose:
Create a leave request.

Planned request:

```json
{
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "reason": "Annual leave"
}
```

Planned success:
`201`

### `PUT /api/v1/leave-requests/{leaveRequestId}/approve`

Purpose:
Approve leave. Manager only.

### `PUT /api/v1/leave-requests/{leaveRequestId}/reject`

Purpose:
Reject leave. Manager only.

## Shift Routes

### `GET /api/v1/shifts`

Purpose:
List shifts for a week. Manager only.

### `POST /api/v1/shifts`

Purpose:
Create a shift. Manager only.

Planned request:

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
Update a shift. Manager only.

## Assignment Route

### `POST /api/v1/assignments`

Purpose:
Assign a staff member to a shift. Manager only.

Planned request:

```json
{
  "shiftId": "uuid",
  "staffProfileId": "uuid"
}
```

Planned success:
`201`

Possible business-rule errors:

1. `409` leave conflict
2. `409` overlap conflict
3. `409` availability conflict
4. `409` role conflict
5. `404` unknown shift or staff record

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
