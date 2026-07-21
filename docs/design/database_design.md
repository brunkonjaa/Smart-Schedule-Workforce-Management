# Database Design

Smart Schedule uses PostgreSQL as the source of truth for identity, administrator invitations, staff profiles, leave, shifts, assignments, password recovery, swaps, and manager audit records.

## Tables in the current migration chain

1. `users` - login email, display name where needed, password hash/scheme/pepper version, role, active state, reviewer flag and session version
2. `staff_profiles` - name, work role, contract hours, phone, active state
3. `leave_requests` - dates, reason, status, manager comment, decision actor/time
4. `shifts` - date, start/end time, required role, status, notes
5. `shift_assignments` - one staff profile on one shift and the assigning manager
6. `audit_logs` - rota changes plus Employee Summary view, print-request and denied-access records with JSON before/after state
7. `security_events` - security-related event records
8. `password_reset_requests` - hashed reset token, expiry, use state, and request timestamps
9. `shift_swap_requests` - source assignment, requester, optional target, acceptance and manager decision state
10. `admin_invitations` - invited email/name, hashed one-use token, inviting Admin, expiry and terminal state

`availability_entries` is historical. Migration `014_remove_weekly_availability.sql` removes that table because weekly availability submission was removed from the rota workflow.

Migration `023_extend_audit_logs_for_employee_access.sql` keeps Employee Summary access in the same append-only table. It only extends the allowed action and entity check constraints. No new column or backfill was needed. The target staff profile uses `entity_id`, while the source and `SUCCESS` or `DENIED` result are retained in `after_state`.

## Design rules

1. users come before staff profiles because every staff profile has one login identity
2. shifts come before assignments because an assignment must point to a real shift
3. a shift has one assignment in the current MVP
4. foreign keys protect links between users, profiles, shifts, assignments, and requests
5. SQL constraints enforce simple ranges and allowed values
6. service code checks the scheduling rules that need several rows at once

## Important constraints

### `users`

`email` is unique and lowercase. `role` is `ADMIN`, `MANAGER` or `STAFF`. Admin does not mean Manager and an Admin row does not need a `staff_profiles` row.

Existing login rows start with `password_scheme = BCRYPT`. A correct legacy login changes that row to `ARGON2ID_PEPPERED` and records the current `password_pepper_version`. New, changed and reset passwords use Argon2id straight away. The HMAC-SHA-256 pepper step happens in the backend before Argon2id, so the pepper value stays outside PostgreSQL and Git. `session_version` is increased after password, role, active-state, passkey or session-revocation changes, which makes older server sessions fail their next authenticated check.

`is_submission_reviewer` is allowed only on an Admin row. This is the narrow assessment exception where password change and passkey setup stay optional. It is not a new role and it does not spread to another Admin account.

### `staff_profiles`

`user_id` is unique. `primary_role` is used for Bar, Floor, Kitchen, and the displayed Kitchen Porter/`OTHER` rota group. `contract_hours` cannot be negative.

### `leave_requests`

`status` is `PENDING`, `APPROVED`, or `REJECTED`. The database rejects an end date before the start date.

### `shifts`

The end time must be after the start time. The current statuses are `DRAFT`, `OPEN`, and `CANCELLED`. The current rota seed uses Monday-Friday shifts, while the rota view can show the whole week.

### `shift_assignments`

`shift_id` is unique, so the current build stores one assigned staff member per shift. The row keeps `assigned_by_user_id` and `assigned_at` for traceability.

### `password_reset_requests`

The raw token is never stored. The service stores a hash and checks expiry and used state before changing the password. The manager request view does not expose the token.

### `admin_invitations`

The raw activation token is never stored. `token_hash` is unique and the service compares the hash of the submitted token. The invitation has a future `expires_at` value and the database permits no more than one of `used_at`, `cancelled_at` and `expired_at`. An invited normal Admin remains inactive until the password and required passkey steps both finish.

### `shift_swap_requests`

The request points to an existing assignment. It stores whether it is open or targeted, whether a target accepted, and whether a manager approved or rejected the final change. The assignment is not changed just because a request was created.

## Service-level scheduling checks

Before an assignment is saved, the backend checks:

1. active staff account
2. matching role
3. open shift and no existing assignment
4. approved leave on the shift date
5. overlapping or touching shifts on the same day
6. no more than five assigned shifts in the week
7. no more than forty assigned hours in the week

Contract hours can produce a warning instead of a hard block. A manager may need to approve extra contracted hours in a busy week, but the hard safety limits still apply.

## PostgreSQL choices

The schema uses UUID keys, `TIMESTAMPTZ` timestamps, `CHECK` constraints, `JSONB` audit snapshots, and `gen_random_uuid()` from `pgcrypto`. The migration runner records applied filenames in `schema_migrations`.
