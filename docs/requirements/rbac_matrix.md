# RBAC Matrix

The backend uses three access states: unauthenticated, `STAFF`, and `MANAGER`. The frontend hides pages where possible, but the route middleware and service ownership checks are the real protection.

| Endpoint | Unauthenticated | Staff | Manager | Note |
| --- | --- | --- | --- | --- |
| `POST /api/v1/auth/login` | Allow | Allow | Allow | Login route |
| `POST /api/v1/auth/logout` | Deny | Allow | Allow | Current session only |
| `GET /api/v1/auth/me` | Deny | Allow | Allow | Current session user |
| `POST /api/v1/auth/password-reset/request` | Allow with mutation header | Allow | Allow | Same generic response for unknown email |
| `POST /api/v1/auth/password-reset/confirm` | Allow with valid token | Allow | Allow | Token is expiring and single-use |
| `GET /api/v1/auth/password-reset/requests` | Deny | Deny | Allow | Manager password request view |
| `GET /api/v1/staff` | Deny | Deny | Allow | Manager staff list |
| `POST /api/v1/staff` | Deny | Deny | Allow | Manager creates staff account |
| `PUT /api/v1/staff/{staffId}` | Deny | Deny | Allow | Manager edits staff record |
| `GET /api/v1/leave-requests` | Deny | Own records | All records | Ownership filter for staff |
| `POST /api/v1/leave-requests` | Deny | Own request | Deny | Staff creates leave |
| `PUT /api/v1/leave-requests/{id}/approve` | Deny | Deny | Allow | Manager decision |
| `PUT /api/v1/leave-requests/{id}/reject` | Deny | Deny | Allow | Manager decision |
| `DELETE /api/v1/leave-requests/{id}` | Deny | Own pending | Deny | Staff withdrawal |
| `GET /api/v1/shifts` | Deny | Deny | Allow | Manager shift management |
| `POST /api/v1/shifts` | Deny | Deny | Allow | Manager creates shift |
| `PUT /api/v1/shifts/{id}` | Deny | Deny | Allow | Manager edits shift |
| `DELETE /api/v1/shifts/{id}` | Deny | Deny | Allow | Manager deletes shift |
| `POST /api/v1/assignments` | Deny | Deny | Allow | Manager assigns staff |
| `PUT /api/v1/assignments/{id}` | Deny | Deny | Allow | Manager changes assignment |
| `DELETE /api/v1/assignments/{id}` | Deny | Deny | Allow | Manager removes assignment |
| `GET /api/v1/rota` | Deny | Allow view | Allow view | Staff receives the full roster; edit actions remain manager-only |
| `GET /api/v1/shift-swaps` | Deny | Relevant requests | Pending workflow | Staff can see requests connected to the shared swap page |
| `POST /api/v1/shift-swaps` | Deny | Own future assignment | Deny | Optional target staff |
| `POST /api/v1/shift-swaps/{id}/accept` | Deny | Eligible target only | Deny | Target acceptance |
| `PUT /api/v1/shift-swaps/{id}/approve` | Deny | Deny | Allow | Manager final decision |
| `PUT /api/v1/shift-swaps/{id}/reject` | Deny | Deny | Allow | Manager final decision |

## Object-level rules

1. a staff user cannot create a leave request for another profile
2. a staff user cannot withdraw another person’s request
3. a staff user can only start a swap from their own future assignment
4. a targeted swap can only be accepted by the named target
5. accepting a swap still runs assignment eligibility checks
6. manager-only shift and assignment actions are checked again on the backend

## Test expectation

The route suites should include unauthenticated `401`, wrong-role `403`, ownership denial, and business-rule `409` cases where those rules apply.
