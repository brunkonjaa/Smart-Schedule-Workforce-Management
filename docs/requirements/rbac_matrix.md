# RBAC Matrix

## What This Matrix Is

This matrix shows the backend access rules for the MVP routes.

It is important to say this clearly as well. A lot of this matrix is already wired now for auth, staff, availability, leave, shifts, assignments, assignment conflict checks, contract-hours warnings, and the weekly rota read route. Audit logging still needs its own later work.

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
| `DELETE /api/v1/leave-requests/{id}` | Deny | Allow own pending | Deny | Staff can withdraw own pending request |
| `GET /api/v1/shifts?weekStart=...` | Deny | Deny | Allow | Manager only |
| `POST /api/v1/shifts` | Deny | Deny | Allow | Manager only |
| `PUT /api/v1/shifts/{shiftId}` | Deny | Deny | Allow | Manager only |
| `DELETE /api/v1/shifts/{shiftId}` | Deny | Deny | Allow | Manager only |
| `POST /api/v1/assignments` | Deny | Deny | Allow | Manager only |
| `PUT /api/v1/assignments/{assignmentId}` | Deny | Deny | Allow | Manager only |
| `DELETE /api/v1/assignments/{assignmentId}` | Deny | Deny | Allow | Manager only |
| `GET /api/v1/rota?weekStart=...&department=...` | Deny | Allow view | Allow view | Staff can view the rota but cannot edit it |

## Object-Level Rules

1. a staff user can only create, update, or delete their own availability entries
2. a staff user can only create leave requests for themselves
3. a staff user can only view and withdraw their own pending leave records
4. a staff user can view rota sections but cannot create, update, or delete shifts or assignments
5. manager-only cell actions still have backend role checks

## Current Repo Note

The current repo now has the route middleware and ownership checks for the live auth, staff, availability, leave, shift, assignment, and rota read surface.

## Security Test Expectations

1. every manager-only endpoint should have at least one `403` test using a staff account
2. every ownership-sensitive endpoint should have at least one cross-user denial test
3. unauthenticated access to protected routes should return `401`
