# RBAC Matrix

## Change Note

- Previous position: this matrix covered swaps, reports, suggestions, and audit endpoints.
- Updated position: it now covers the current MVP routes only.
- Why: to match the active routes.

## Roles

1. `Manager`
2. `Staff`
3. `Unauthenticated`

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

1. A staff user can only create, update, or delete their own availability entries.
2. A staff user can only create leave requests for themselves.
3. A staff user can only view their own leave records.
4. A staff user can only view their own rota records.
5. A staff user cannot create shifts or assignments.

## Security Test Expectations

1. Every manager-only endpoint should have at least one `403` test using a staff account.
2. Every ownership-sensitive endpoint should have at least one cross-user denial test.
3. Unauthenticated access to protected routes should return `401`.
