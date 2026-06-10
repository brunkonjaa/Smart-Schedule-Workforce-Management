# Test Plan

## Change Note

- Previous position: this plan covered swaps, suggestions, reports, and audit-heavy checks.
- Updated position: this plan now matches the current MVP.
- Why: to match the active feature set.

## Test Strategy

1. Unit tests for business rules
2. Integration tests for workflow steps
3. API tests for endpoint behavior
4. Manual UAT for full user flows
5. Security tests for auth and access control

## Test Environments

### Local

1. Node.js and Express backend
2. PostgreSQL database
3. HTML, CSS, and JavaScript frontend

### Hosted

1. Render web service
2. Neon PostgreSQL database
3. Seeded test data for demo and screenshots

## Unit Test Coverage

### Scheduling Rule Tests

| Test ID | Description | Expected Result |
| --- | --- | --- |
| UT-SCHED-01 | Assign staff when no conflicts exist | Assignment allowed |
| UT-SCHED-02 | Assign staff on approved leave | Assignment blocked |
| UT-SCHED-03 | Assign staff with overlapping shift | Assignment blocked |
| UT-SCHED-04 | Assign staff outside availability window | Assignment blocked |
| UT-SCHED-05 | Assign staff above contract hours | Warning returned |

### Leave Tests

| Test ID | Description | Expected Result |
| --- | --- | --- |
| UT-LEAVE-01 | Leave end date before start date | Validation fails |
| UT-LEAVE-02 | Approve pending leave | Status becomes `APPROVED` |

## Integration Tests

| Test ID | Description | Expected Result |
| --- | --- | --- |
| IT-01 | Leave approval then assignment attempt | Assignment rejected |
| IT-02 | Assignment flow stores actor and shift link correctly | Assignment saved correctly |
| IT-03 | Staff record create persists user and staff profile | Both records saved |
| IT-04 | Availability query returns only target week records | Week filter applied correctly |
| IT-05 | Staff rota view shows only own assigned shifts | Ownership filter works |

## API Test Cases

| Test ID | Endpoint | Scenario | Expected Result |
| --- | --- | --- | --- |
| API-01 | `POST /api/v1/auth/login` | Valid credentials | `200` |
| API-02 | `POST /api/v1/auth/login` | Invalid credentials | `401` |
| API-03 | `GET /api/v1/staff` | Staff session used | `403` |
| API-04 | `POST /api/v1/availability` | End time before start time | `400` |
| API-05 | `PUT /api/v1/leave-requests/{id}/approve` | Manager approves valid request | `200` |
| API-06 | `POST /api/v1/shifts` | Invalid shift time | `400` |
| API-07 | `POST /api/v1/assignments` | Overlapping shift | `409` |
| API-08 | `GET /api/v1/rota` | Staff requests own rota | `200` |

## Security Test Cases

| Test ID | Scenario | Expected Result |
| --- | --- | --- |
| SEC-01 | Access manager endpoint with staff session | `403` |
| SEC-02 | Access protected endpoint without session | `401` |
| SEC-03 | Submit SQL injection payload in login field | Rejected or treated as plain input |
| SEC-04 | Use expired or invalid session | `401` or `403` |
| SEC-05 | Verify no secret values appear in logs or responses | Secrets absent |

## UAT Scenarios

| UAT ID | Scenario | Evidence Needed |
| --- | --- | --- |
| UAT-01 | Manager logs in and creates a staff member | screenshot + notes |
| UAT-02 | Staff logs in and submits availability for a week | screenshot + notes |
| UAT-03 | Staff submits leave request | screenshot + notes |
| UAT-04 | Manager approves leave and sees it block assignment | screenshots + notes |
| UAT-05 | Manager creates shifts and assigns staff | screenshots + notes |
| UAT-06 | Staff views assigned shifts | screenshot + notes |
| UAT-07 | Staff attempts unauthorized action and receives correct denial | screenshot + notes |

## Screenshot Storage and Naming Rule

1. Store all screenshots in `assets/screenshots/`.
2. Put screenshots into simple subfolders based on what they show.
3. Use one global numbering sequence across the whole project, starting at `001` and continuing upward without restarting in each folder.
4. Start every screenshot filename with the number so it can be cited directly in the report.
5. After the number, add a short clear description in lowercase with hyphens.

Examples:

1. `assets/screenshots/tests/backend-setup/001_backend-health-check-response.png`
2. `assets/screenshots/tests/frontend-shell/003_overview-dark.png`
3. `assets/screenshots/tests/jira/009_sprint-1-board.png`

## Exit Criteria

1. All critical defects are fixed.
2. Core UAT scenarios pass.
3. Auth and RBAC tests pass.
4. No failing tests remain in the final evidence set.
5. The hosted version works for demo use.
