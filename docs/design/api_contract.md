# API Contract

## Change Note

- Previous position: this contract included suggestion, swap, report, and publish endpoints.
- Updated position: the contract now covers the current MVP only.
- Why: to match the current build plan.

## Conventions

1. Base path: `/api/v1`
2. Auth: server-side session with `express-session`
3. Response type: `application/json`
4. Timestamps: ISO 8601
5. Errors should use one shared shape

Example error payload:

```json
{
  "timestamp": "2026-06-04T16:00:00Z",
  "status": 400,
  "error": "Validation Failed",
  "message": "endDate must be on or after startDate",
  "path": "/api/v1/leave-requests"
}
```

## Authentication

### `POST /api/v1/auth/login`

Purpose: log in a user.

Request:

```json
{
  "email": "manager@example.com",
  "password": "PlainTextPasswordInput"
}
```

Success `200`:

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

Errors:

1. `401` invalid credentials

### `POST /api/v1/auth/logout`

Purpose: log out the current user.

Success `204`

## Staff

### `GET /api/v1/staff`

Purpose: list staff records. Manager only.

Success `200`

### `POST /api/v1/staff`

Purpose: create a staff user and profile. Manager only.

Request:

```json
{
  "email": "staff1@example.com",
  "password": "InitialTempPassword123",
  "fullName": "Alex Byrne",
  "primaryRole": "FLOOR",
  "contractHours": 25,
  "phoneNumber": "0850000000"
}
```

Success `201`

### `PUT /api/v1/staff/{staffId}`

Purpose: update a staff profile. Manager only.

Success `200`

## Availability

### `GET /api/v1/availability`

Purpose: view availability entries.

Query params:

1. `weekStart` required date
2. `staffProfileId` optional, manager only

Success `200`

### `POST /api/v1/availability`

Purpose: create availability entries for the logged-in staff user.

Request:

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

Success `201`

### `PUT /api/v1/availability/{availabilityId}`

Purpose: update own future availability entry.

Success `200`

### `DELETE /api/v1/availability/{availabilityId}`

Purpose: delete own future availability entry.

Success `204`

## Leave Requests

### `GET /api/v1/leave-requests`

Purpose: view leave requests.

Behavior:

1. Manager sees all
2. Staff sees only own records

### `POST /api/v1/leave-requests`

Purpose: create a leave request.

Request:

```json
{
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "reason": "Annual leave"
}
```

Success `201`

### `PUT /api/v1/leave-requests/{leaveRequestId}/approve`

Purpose: approve leave. Manager only.

Request:

```json
{
  "managerComment": "Approved"
}
```

Success `200`

### `PUT /api/v1/leave-requests/{leaveRequestId}/reject`

Purpose: reject leave. Manager only.

Success `200`

## Shifts

### `GET /api/v1/shifts`

Purpose: list shifts for a week. Manager only.

Query params:

1. `weekStart` required

### `POST /api/v1/shifts`

Purpose: create a shift. Manager only.

Request:

```json
{
  "shiftDate": "2026-06-12",
  "startTime": "14:00",
  "endTime": "22:00",
  "requiredRole": "BAR",
  "notes": "Busy Friday"
}
```

Success `201`

### `PUT /api/v1/shifts/{shiftId}`

Purpose: update a shift. Manager only.

Success `200`

## Assignments

### `POST /api/v1/assignments`

Purpose: assign staff to a shift. Manager only.

Request:

```json
{
  "shiftId": "uuid",
  "staffProfileId": "uuid"
}
```

Success `201`

Possible errors:

1. `409` leave conflict
2. `409` overlap conflict
3. `409` availability conflict
4. `409` role conflict
5. `404` unknown shift or staff member

## Rota

### `GET /api/v1/rota`

Purpose: view the weekly rota.

Query params:

1. `weekStart` required

Behavior:

1. Manager sees the full weekly rota
2. Staff sees only their own assigned shifts

Success `200`

## Security Rules

1. All state-changing endpoints require authentication
2. Manager-only endpoints require backend role checks
3. Staff endpoints require ownership checks where needed
4. No response should expose password hashes or secret values
5. Validation errors return `400`
6. Unauthenticated access returns `401`
7. Forbidden access returns `403`
8. Business-rule conflicts return `409`
