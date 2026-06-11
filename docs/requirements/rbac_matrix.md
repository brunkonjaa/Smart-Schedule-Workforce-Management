# RBAC Matrix

## What This Matrix Is

This matrix shows the intended backend access rules for the MVP routes.

It is important to say this clearly: the route protection below is the target behavior. The repo has not wired the auth and RBAC middleware yet, so this file is the contract for the next backend step, not proof that the checks already run.

## Roles

1. `Unauthenticated`
2. `STAFF`
3. `MANAGER`

## Endpoint Matrix

| Endpoint | Unauthenticated | Staff | Manager | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/login` | Allow | Allow | Allow | Public route |
| `POST /api/v1/auth/logout` | Deny | Allow | Allow | Logged-in users only |
| `GET /api/v1/staff` | Deny | Deny | Allow | Manager only |
| `POST /api/v1/staff` | Deny | Deny | Allow | Manager only |
| `PUT /api/v1/staff/{staffId}` | Deny | Deny | Allow | Manager only |
| `GET /api/v1/availability?weekStart=...` | Deny | Allow own | Allow all | Staff limited to own records |
| `POST /api/v1/availability` | Deny | Allow own | Deny | Staff creates own entries |
| `PUT /api/v1/availability/{availabilityId}` | Deny | Allow own future | Deny | Ownership check required |
| `DELETE /api/v1/availability/{availabilityId}` | Deny | Allow own future | Deny | Ownership check required |
| `GET /api/v1/leave-requests` | Deny | Allow own | Allow all | Ownership check required for staff |
| `POST /api/v1/leave-requests` | Deny | Allow own | Deny | Staff creates own request |
| `PUT /api/v1/leave-requests/{id}/approve` | Deny | Deny | Allow | Manager only |
| `PUT /api/v1/leave-requests/{id}/reject` | Deny | Deny | Allow | Manager only |
| `GET /api/v1/shifts?weekStart=...` | Deny | Deny | Allow | Manager only |
| `POST /api/v1/shifts` | Deny | Deny | Allow | Manager only |
| `PUT /api/v1/shifts/{shiftId}` | Deny | Deny | Allow | Manager only |
| `POST /api/v1/assignments` | Deny | Deny | Allow | Manager only |
| `GET /api/v1/rota?weekStart=...` | Deny | Allow own | Allow all | Staff sees only own assignments |

## Object-Level Rules

1. a staff user can only create, update, or delete their own availability entries
2. a staff user can only create leave requests for themselves
3. a staff user can only view their own leave records
4. a staff user can only view their own rota records
5. a staff user cannot create shifts or assignments

## Current Repo Note

The current repo already has the role idea in the frontend shell and in the database direction, but not in route middleware yet.

That means this matrix is mainly here to stop the auth build from becoming vague later.

## Security Test Expectations

1. every manager-only endpoint should have at least one `403` test using a staff account
2. every ownership-sensitive endpoint should have at least one cross-user denial test
3. unauthenticated access to protected routes should return `401`
