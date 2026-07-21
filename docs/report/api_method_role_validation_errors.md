# API Method, Role, Validation And Error Table

This is the short report version of the live API contract. It is based on the route files under `backend/src/routes`, not on the first proposal. `M` means the `x-smart-schedule-csrf` mutation header is required. Normal unauthenticated and wrong-role responses are `401` and `403`.

| Method and path | Access | Main validation or ownership rule | Main success / error responses |
| --- | --- | --- | --- |
| `GET /health` | Public | PostgreSQL must answer | `200`; `503` database unavailable |
| `POST /api/v1/auth/login` | Public | email, password, optional `rememberMe`; rate limited | `200`; `400`, `401`, `429` |
| `GET /api/v1/auth/me` | Session | active user and active staff profile | `200`; `401` |
| `POST /api/v1/auth/logout` | Public + M | current session if present | `204`; `403` missing mutation check |
| `POST /api/v1/auth/change-password` | Session + M | current password, new password policy and reuse check | `200`; `400`, `401`, `409` |
| `POST /api/v1/auth/password-reset/request` | Public + M | valid email; public response does not reveal account match | `202`; `400`, `503` email config |
| `POST /api/v1/auth/password-reset/confirm` | Public + M | valid unused token and new password policy | `200`; `400` invalid/expired/used |
| `GET /api/v1/auth/password-reset/requests` | Manager | manager role | `200`; `401`, `403` |
| `GET /api/v1/auth/bootstrap/status` | Public | no input | `200` |
| `POST /api/v1/auth/bootstrap/first-manager` | Public + M | configured bootstrap token; setup must still be available | `201`; `400`, `403`, `409`, `503` |
| `POST /api/v1/auth/passkeys/registration/options` | Manager + M | manager session | `200`; `401`, `403` |
| `POST /api/v1/auth/passkeys/registration/verify` | Manager + M | fresh challenge and WebAuthn response | `201`; `400` |
| `POST /api/v1/auth/passkeys/login/options` | Pending manager login + M | password stage completed | `200`; `401` |
| `POST /api/v1/auth/passkeys/login/verify` | Pending manager login + M | fresh challenge and registered credential | `200`; `401` |
| `GET /api/v1/staff` | Manager | exact filters | `200`; `400` |
| `POST /api/v1/staff` | Manager + M | email, password, name, role, hours and phone | `201`; `400`, `409` duplicate |
| `PUT /api/v1/staff/{staffId}` | Manager + M | UUID, allowed fields and values | `200`; `400`, `404`, `409` |
| `POST /api/v1/staff/{staffId}/reset-password` | Manager + M | UUID and temporary password policy | `200`; `400`, `404` |
| `GET /api/v1/staff/{staffId}/summary` | Manager | UUID, Monday week and approved source; staff denial is audited | `200`; `400`, `401`, `403`, `404` |
| `POST /api/v1/staff/{staffId}/summary/print-request` | Manager + M | UUID and approved source; event must save before print | `204`; `400`, `401`, `403`, `404` |
| `GET /api/v1/leave-requests` | Session | staff only see their own requests | `200`; `400` filters |
| `POST /api/v1/leave-requests` | Staff + M | own profile; date order, reason and overlap | `201`; `400`, `409` |
| `PUT /api/v1/leave-requests/{id}/approve` | Manager + M | UUID, pending state, optional comment | `200`; `400`, `404`, `409` |
| `PUT /api/v1/leave-requests/{id}/reject` | Manager + M | UUID, pending state, optional comment | `200`; `400`, `404`, `409` |
| `DELETE /api/v1/leave-requests/{id}` | Staff + M | owner and pending state | `204`; `400`, `403`, `404`, `409` |
| `GET /api/v1/shifts` | Manager | week/date filters | `200`; `400` |
| `POST /api/v1/shifts` | Manager + M | date, time order, role, status and notes | `201`; `400`, `409` |
| `PUT /api/v1/shifts/{shiftId}` | Manager + M | UUID and allowed fields | `200`; `400`, `404`, `409` |
| `DELETE /api/v1/shifts/{shiftId}` | Manager + M | UUID; deletion rules and references | `204`; `400`, `404`, `409` |
| `GET /api/v1/assignments` | Manager | route filters and UUIDs | `200`; `400` |
| `POST /api/v1/assignments` | Manager + M | active/open, role, leave, time conflict, five shifts and forty hours | `201`; `400`, `404`, `409`; contract warning may accompany `201` |
| `PUT /api/v1/assignments/{id}` | Manager + M | UUID and the same assignment rules | `200`; `400`, `404`, `409`; warning may accompany `200` |
| `DELETE /api/v1/assignments/{id}` | Manager + M | UUID and current/future assignment | `204`; `400`, `404`, `409` |
| `GET /api/v1/rota` | Session | Monday `weekStart`; supported department | `200`; `400` |
| `GET /api/v1/rota/history` | Staff | current staff profile | `200`; `401`, `403` |
| `GET /api/v1/shift-swaps` | Staff or manager | active future requests | `200` |
| `GET /api/v1/shift-swaps/{id}` | Manager | UUID and retained Swap Request record | `200`; `400`, `404` |
| `POST /api/v1/shift-swaps` | Staff + M | own future assignment; optional eligible target | `201`; `400`, `403`, `409` |
| `POST /api/v1/shift-swaps/{id}/accept` | Staff + M | targeted/eligible staff; pending request | `200`; `403`, `409` |
| `PUT /api/v1/shift-swaps/{id}/approve` | Manager + M | accepted request and final assignment check | `200`; `409` |
| `PUT /api/v1/shift-swaps/{id}/reject` | Manager + M | pending or accepted request | `200`; `409` |
| `GET /api/v1/audit-logs` | Manager | integer limit from 1 to 200 | `200`; `400` |
| `GET /api/v1/audit-logs/employee-access` | Manager | positive page; fixed 25 records; page cannot exceed total | `200`; `400` |
| `GET /api/v1/chat/messages` | Session | requested conversation must contain current user; otherwise workplace fallback | `200`; `401` |
| `GET /api/v1/chat/people` | Session | other active accounts only | `200`; `401` |
| `POST /api/v1/chat/conversations` | Session + M | other active user; no self conversation | `201`; `400` |
| `POST /api/v1/chat/messages` | Session + M | participant conversation; 1 to 1000 trimmed characters | `201`; `400`, `403` |
| `WS /ws/chat` | Session | same Origin, active account, participant checks, 16 KB frame limit | history/message/read events; upgrade closed or error event on denial |

The shared error families are deliberate: `400` is malformed input, `401` is no valid session, `403` is a role or ownership denial, `404` is a missing record, and `409` is a valid request that conflicts with the current workflow state.
