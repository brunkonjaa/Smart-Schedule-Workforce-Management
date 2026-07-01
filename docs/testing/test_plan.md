# Test Plan

## What This Plan Covers

This file covers the testing direction for the MVP.

It also needs one honest note at the start. Most of the cases below are planned coverage, not finished automated coverage. Right now the repo has:

1. manual frontend shell evidence
2. manual Neon and pgAdmin database checks
3. backend health-route verification
4. migration status and migration apply checks
5. automated auth, staff, availability, leave, shift, and basic assignment route tests with `Jest` and `Supertest`

That still is not full MVP test coverage. The missing part is mainly the assignment conflict rules and rota workflow.

## Test Strategy

I am splitting testing into these layers:

1. unit tests for business rules
2. integration tests for linked workflow steps
3. API tests for route behavior
4. manual UAT for full user flows
5. security checks for auth, RBAC, and ownership rules

## Test Environments

### Local

1. Node.js and Express backend
2. PostgreSQL database
3. HTML, CSS, and JavaScript frontend shell

### Hosted

1. Render web service
2. Neon PostgreSQL database
3. seeded test data for demo and screenshots

## What Is Already Verifiable

At the current checkpoint I can already verify:

1. the backend can reach the database through `/health`
2. the Express app boots with the PostgreSQL-backed session middleware in place
3. the migration runner reports applied and pending files
4. the `users` and `staff_profiles` tables exist in Neon
5. the seed data file can populate starter records
6. the frontend shell renders the planned workflow pages
7. valid login creates a session
8. `GET /api/v1/auth/me` returns the current session user
9. logout destroys the session
10. a manager can create a basic saved shift assignment through the backend
11. staff users are rejected from the assignment route
12. duplicate assignment for the same shift returns a conflict
13. overlapping or back-to-back assignment for the same staff member returns a conflict
14. assignment above weekly contract hours returns a warning
15. assignment create, update, and delete write audit records
16. shift create, update, and delete write audit records

## Unit Test Coverage Planned

### Scheduling Rule Tests

| Test ID | Description | Expected Result |
| --- | --- | --- |
| UT-SCHED-01 | Assign staff when no conflicts exist | Assignment allowed |
| UT-SCHED-02 | Assign staff on approved leave | Assignment blocked |
| UT-SCHED-03 | Assign staff with overlapping or back-to-back shift | Assignment blocked |
| UT-SCHED-04 | Assign staff outside availability window | Assignment blocked |
| UT-SCHED-05 | Assign staff above contract hours | Warning returned |

### Leave Tests

| Test ID | Description | Expected Result |
| --- | --- | --- |
| UT-LEAVE-01 | Leave end date before start date | Validation fails |
| UT-LEAVE-02 | Approve pending leave | Status becomes `APPROVED` |

## Integration Tests Planned

| Test ID | Description | Expected Result |
| --- | --- | --- |
| IT-01 | Leave approval then assignment attempt | Assignment rejected |
| IT-02 | Assignment flow stores actor and shift link correctly | Assignment saved correctly |
| IT-03 | Staff record create persists user and staff profile | Both records saved |
| IT-04 | Availability query returns only target week records | Week filter applied correctly |
| IT-05 | Staff rota view shows only own assigned shifts | Ownership filter works |

## API Test Cases Planned

| Test ID | Endpoint | Scenario | Expected Result |
| --- | --- | --- | --- |
| API-01 | `POST /api/v1/auth/login` | Valid credentials | `200` |
| API-02 | `POST /api/v1/auth/login` | Invalid credentials | `401` |
| API-03 | `GET /api/v1/auth/me` | Authenticated session | `200` |
| API-04 | `POST /api/v1/auth/logout` | Valid session logout | `204` |
| API-05 | `GET /api/v1/staff` | Staff session used | `403` |
| API-06 | `POST /api/v1/availability` | End time before start time | `400` |
| API-07 | `PUT /api/v1/leave-requests/{id}/approve` | Manager approves valid request | `200` |
| API-08 | `POST /api/v1/shifts` | Invalid shift time | `400` |
| API-09 | `POST /api/v1/assignments` | Overlapping shift | `409` |
| API-10 | `GET /api/v1/rota` | Staff requests own rota | `200` |

## Security Test Cases Planned

| Test ID | Scenario | Expected Result |
| --- | --- | --- |
| SEC-01 | Access manager endpoint with staff session | `403` |
| SEC-02 | Access protected endpoint without session | `401` |
| SEC-03 | Submit SQL injection payload in login field | Rejected or treated as plain input |
| SEC-04 | Use expired or invalid session | `401` or `403` |
| SEC-05 | Verify no secret values appear in logs or responses | Secrets absent |

## UAT Scenarios Planned

| UAT ID | Scenario | Evidence Needed |
| --- | --- | --- |
| UAT-01 | Manager logs in and creates a staff member | screenshot plus notes |
| UAT-02 | Staff logs in and submits availability for a week | screenshot plus notes |
| UAT-03 | Staff submits leave request | screenshot plus notes |
| UAT-04 | Manager approves leave and sees it block assignment | screenshots plus notes |
| UAT-05 | Manager creates shifts and assigns staff | screenshots plus notes |
| UAT-06 | Staff views assigned shifts | screenshot plus notes |
| UAT-07 | Staff attempts unauthorized action and receives correct denial | screenshot plus notes |

## Screenshot Rule

1. store screenshots under `assets/screenshots/`
2. split them into clear folders by what they prove
3. keep one global numbering sequence
4. start every filename with the number
5. avoid screenshots that leak secrets

Examples:

1. `assets/screenshots/tests/backend-setup/001_backend-health-check-response.png`
2. `assets/screenshots/tests/frontend-shell/003_overview-dark.png`
3. `assets/screenshots/tests/jira/031_scrum-11-done.png`
4. `assets/screenshots/tests/backend-auth/039_login-success-response.png`

## Exit Criteria

Before I call the MVP test-ready, these need to be true:

1. critical defects are fixed
2. core UAT scenarios pass
3. auth and RBAC tests pass
4. no failing test evidence remains in the final set
5. the hosted version works well enough for demo use
