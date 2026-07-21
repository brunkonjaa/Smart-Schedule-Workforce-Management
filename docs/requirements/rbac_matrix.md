# RBAC Matrix

The backend uses four access states: unauthenticated, `STAFF`, `MANAGER`, and `ADMIN`. Admin is separate from Manager. It can manage administrator account security but it does not inherit rota, staff record, Employee Summary, Audit Log or chat access. The frontend hides pages where possible, but the route middleware and service ownership checks are the real protection.

| Endpoint | Unauthenticated | Staff | Manager | Admin | Note |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/auth/login` | Allow | Allow | Allow | Allow | Password login; Admin uses a passkey second step when one is registered |
| `POST /api/v1/auth/logout` | Deny | Allow | Allow | Allow | Current server session only |
| `GET /api/v1/auth/me` | Deny | Allow | Allow | Allow | Current session user |
| `POST /api/v1/auth/password-reset/request` | Allow with mutation header | Allow | Allow | Allow | Same generic response for unknown email |
| `POST /api/v1/auth/password-reset/confirm` | Allow with valid token | Allow | Allow | Allow | Token is expiring and single-use |
| `GET /api/v1/auth/password-reset/requests` | Deny | Deny | Allow | Allow | Account recovery request view |
| `GET /api/v1/staff` | Deny | Deny | Allow | Deny | Manager staff list |
| `POST /api/v1/staff` | Deny | Deny | Allow | Deny | Manager creates staff account |
| `PUT /api/v1/staff/{staffId}` | Deny | Deny | Allow | Deny | Manager edits staff record |
| `GET /api/v1/staff/{staffId}/summary` | Deny `401` | Deny `403` and record denial | Allow | Deny `403` | Manager Employee Summary; protected response uses `no-store` |
| `POST /api/v1/staff/{staffId}/summary/print-request` | Deny `401` | Deny `403` and record denial | Allow with mutation header | Deny `403` | Records a manager request before the print dialog |
| `GET /api/v1/leave-requests` | Deny | Own records | All records | Deny | Ownership filter for staff |
| `POST /api/v1/leave-requests` | Deny | Own request | Deny | Deny | Staff creates leave |
| `PUT /api/v1/leave-requests/{id}/approve` | Deny | Deny | Allow | Deny | Manager decision |
| `PUT /api/v1/leave-requests/{id}/reject` | Deny | Deny | Allow | Deny | Manager decision |
| `DELETE /api/v1/leave-requests/{id}` | Deny | Own pending | Deny | Deny | Staff withdrawal |
| `GET /api/v1/shifts` | Deny | Deny | Allow | Deny | Manager shift management |
| `POST /api/v1/shifts` | Deny | Deny | Allow | Deny | Manager creates shift |
| `PUT /api/v1/shifts/{id}` | Deny | Deny | Allow | Deny | Manager edits shift |
| `DELETE /api/v1/shifts/{id}` | Deny | Deny | Allow | Deny | Manager deletes shift |
| `POST /api/v1/assignments` | Deny | Deny | Allow | Deny | Manager assigns staff |
| `PUT /api/v1/assignments/{id}` | Deny | Deny | Allow | Deny | Manager changes assignment |
| `DELETE /api/v1/assignments/{id}` | Deny | Deny | Allow | Deny | Manager removes assignment |
| `GET /api/v1/rota` | Deny | Allow view | Allow view | Deny | Staff receives the full roster; edit actions remain manager-only |
| `GET /api/v1/shift-swaps` | Deny | Relevant requests | Pending workflow | Deny | Staff can see requests connected to the shared swap page |
| `GET /api/v1/shift-swaps/{id}` | Deny | Deny | Allow | Deny | Manager record view used by completed Employee Summary links |
| `POST /api/v1/shift-swaps` | Deny | Own future assignment | Deny | Deny | Optional target staff |
| `POST /api/v1/shift-swaps/{id}/accept` | Deny | Eligible target only | Deny | Deny | Target acceptance |
| `PUT /api/v1/shift-swaps/{id}/approve` | Deny | Deny | Allow | Deny | Manager final decision |
| `PUT /api/v1/shift-swaps/{id}/reject` | Deny | Deny | Allow | Deny | Manager final decision |
| `GET /api/v1/audit-logs?page={page}` | Deny | Deny | Allow | Deny | Rota activity only; fixed 25 records per interface page |
| `GET /api/v1/audit-logs/employee-access?page={page}` | Deny | Deny | Allow | Deny | Employee Summary access; fixed 25 records per page |
| `GET /api/v1/chat/messages` | Deny | Participant conversations | Participant conversations | Deny | Requested conversation is loaded only for a participant |
| `GET /api/v1/chat/people` | Deny | Allow | Allow | Deny | Lists active operational accounts |
| `POST /api/v1/chat/conversations` | Deny | Allow with mutation header | Allow with mutation header | Deny | Creates/reuses a two-person direct conversation |
| `POST /api/v1/chat/messages` | Deny | Participant conversations | Participant conversations | Deny | Service checks conversation membership before insert |
| `WS /ws/chat` | Deny upgrade | Participant conversations | Participant conversations | Deny upgrade | Active session plus participant checks |
| `GET /api/v1/admin/accounts` | Deny | Deny | Deny | Allow after setup | Ordinary Admin needs a registered passkey; reviewer exception is account-specific |
| `POST /api/v1/admin/invitations` | Deny | Deny | Deny | Allow after recent re-auth | Sends normal Admin activation and stores only the token hash |
| `POST /api/v1/admin/submission-reviewers` | Deny | Deny | Deny | Allow after recent re-auth and feature flag | Creates the temporary assessment exception only |
| `POST /api/v1/admin/accounts/{userId}/disable` | Deny | Deny | Deny | Allow after recent re-auth | Final active non-review Admin is protected |
| `POST /api/v1/admin/accounts/{userId}/revoke-sessions` | Deny | Deny | Deny | Allow after recent re-auth | Increments the target session version |
| `POST /api/v1/admin/accounts/{userId}/role` | Deny | Deny | Deny | Allow after recent re-auth | Admin without a staff profile cannot be changed to an operational role |
| `GET /api/v1/admin/accounts/{userId}/passkeys` | Deny | Deny | Deny | Allow after setup | Returns passkey names and dates, not credential material |
| `POST /api/v1/admin/accounts/{userId}/passkeys/{passkeyId}/revoke` | Deny | Deny | Deny | Allow after recent re-auth | Revocation invalidates older target sessions |
| `GET /api/v1/admin/security-events` | Deny | Deny | Deny | Allow after setup | Sanitized Admin lifecycle records |

## Object-level rules

1. a staff user cannot create a leave request for another profile
2. a staff user cannot withdraw another person’s request
3. a staff user can only start a swap from their own future assignment
4. a targeted swap can only be accepted by the named target
5. accepting a swap still runs assignment eligibility checks
6. manager-only shift and assignment actions are checked again on the backend
7. direct chat messages are broadcast only to user IDs listed in `chat_conversation_participants`
8. a read state can only be advanced with a message from a conversation the current user participates in
9. an authenticated staff Employee Summary attempt is denied by the backend and recorded without returning employee details
10. a manager can still read a retained inactive staff profile, but the response only contains the approved Employee Summary fields
11. Employee access names are text in the Audit Log, so the access history itself cannot open another summary
12. Admin cannot use Manager rota, staff, Employee Summary, Audit Log or NodyChat routes just because it is privileged for account security
13. a normal Admin must have an active passkey before the Admin workspace opens
14. the temporary submission reviewer may skip passkey setup, but another Admin cannot inherit that flag
15. the final active non-review Admin cannot be disabled or demoted

## Test expectation

The route suites include unauthenticated `401`, wrong-role `403`, ownership denial, and business-rule `409` cases where those rules apply. The current local run passes `144` tests across `19` suites. `admin-routes.test.js` checks the separate role boundary, first Admin bootstrap, invitation lifecycle, reviewer exception, final-Admin rule, passkey/session revocation and metadata redaction. `password-security.test.js` checks silent bcrypt migration, Argon2id storage, breach checking and missing-pepper startup failure. The existing Employee Summary, rota, chat, Manager and Staff tests still run in the same complete suite.
