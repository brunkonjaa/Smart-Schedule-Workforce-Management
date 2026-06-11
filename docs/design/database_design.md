# Database Design

## What This Design Means Right Now

This file describes the current PostgreSQL schema direction for the MVP.

Two things matter here:

1. not every table in this file already exists in the live database
2. the first part of the design is already real, because `users` and `staff_profiles` are migrated now

That distinction is important. I do not want the schema notes to read like the whole project is already built when it is not.

## Design Rules

1. keep the schema relational and easy to trace
2. keep one source of truth for users, staff records, shifts, leave, and assignments
3. use database constraints for basic protection instead of leaving everything to route code
4. build the schema in the same order the app depends on it

## Current MVP Tables

1. `users`
2. `staff_profiles`
3. `availability_entries`
4. `leave_requests`
5. `shifts`
6. `shift_assignments`

## Tables Already In The Repo Database Layer

These are already represented by real migration files:

1. `users`
2. `staff_profiles`

## Tables Still Planned Next

These are still design targets, not migrated tables yet:

1. `availability_entries`
2. `leave_requests`
3. `shifts`
4. `shift_assignments`

## Deferred Tables From Older Drafts

These were in the wider version and are not part of the first build:

1. `skills`
2. `staff_skills`
3. `assignment_override_reasons`
4. `swap_requests`
5. `rota_publications`
6. `audit_log`

## PostgreSQL Notes

1. use native `UUID`
2. use `TIMESTAMPTZ` for timestamp fields
3. use `CHECK` constraints for simple rules
4. use `gen_random_uuid()` through `pgcrypto`

## Table Definitions

### `users`

Purpose:
Login identity and role information.

Current repo note:
This table already exists through `001_create_users_schema.sql`.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `email` | VARCHAR(255) | NOT NULL, lowercase check, UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `role` | VARCHAR(20) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `true` |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Notes:

1. `role` is `MANAGER` or `STAFF`
2. lowercase email is enforced in the schema, not just left to application logic

### `staff_profiles`

Purpose:
Staff details linked to a user account.

Current repo note:
This table already exists through `002_create_staff_profiles_schema.sql`.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK -> `users.id`, UNIQUE, NOT NULL |
| `full_name` | VARCHAR(120) | NOT NULL |
| `primary_role` | VARCHAR(50) | NOT NULL |
| `contract_hours` | NUMERIC(5,2) | NOT NULL CHECK (`contract_hours >= 0`) |
| `phone_number` | VARCHAR(30) | NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `true` |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Notes:

1. one user maps to one staff profile in the current design
2. the `is_active` index is there for later filtering

### `availability_entries`

Purpose:
Weekly availability windows submitted by staff.

Current repo note:
Still planned. No migration file yet.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `staff_profile_id` | UUID | FK -> `staff_profiles.id`, NOT NULL |
| `week_start` | DATE | NOT NULL |
| `day_of_week` | SMALLINT | NOT NULL CHECK (`day_of_week BETWEEN 1 AND 7`) |
| `start_time` | TIME | NOT NULL |
| `end_time` | TIME | NOT NULL |
| `status` | VARCHAR(20) | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Rules:

1. `status` is `AVAILABLE` or `UNAVAILABLE`
2. `end_time` must be greater than `start_time`
3. exact duplicate entries should be blocked

### `leave_requests`

Purpose:
Staff leave workflow with manager decision tracking.

Current repo note:
Still planned. No migration file yet.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `staff_profile_id` | UUID | FK -> `staff_profiles.id`, NOT NULL |
| `start_date` | DATE | NOT NULL |
| `end_date` | DATE | NOT NULL |
| `reason` | VARCHAR(500) | NOT NULL |
| `status` | VARCHAR(20) | NOT NULL |
| `manager_comment` | VARCHAR(500) | NULL |
| `decided_by_user_id` | UUID | FK -> `users.id`, NULL |
| `decided_at` | TIMESTAMPTZ | NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Rules:

1. `status` is `PENDING`, `APPROVED`, or `REJECTED`
2. `end_date` must be on or after `start_date`

### `shifts`

Purpose:
Shift records for the weekly rota.

Current repo note:
Still planned. No migration file yet.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `shift_date` | DATE | NOT NULL |
| `start_time` | TIME | NOT NULL |
| `end_time` | TIME | NOT NULL |
| `required_role` | VARCHAR(50) | NOT NULL |
| `notes` | VARCHAR(500) | NULL |
| `created_by_user_id` | UUID | FK -> `users.id`, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Rules:

1. `end_time` must be greater than `start_time`
2. the first version supports same-day shifts only

### `shift_assignments`

Purpose:
Link one staff member to one shift.

Current repo note:
Still planned. No migration file yet.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `shift_id` | UUID | FK -> `shifts.id`, UNIQUE, NOT NULL |
| `staff_profile_id` | UUID | FK -> `staff_profiles.id`, NOT NULL |
| `assigned_by_user_id` | UUID | FK -> `users.id`, NOT NULL |
| `assigned_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Notes:

1. the MVP assumes one assignment per shift
2. reassignment can update or replace the stored record in service logic later

## Indexing Plan

Indexes already real:

1. unique index on `users(email)`
2. index on `staff_profiles(is_active)`

Indexes planned next:

1. index on `availability_entries(staff_profile_id, week_start, day_of_week)`
2. index on `leave_requests(staff_profile_id, start_date, end_date, status)`
3. index on `shifts(shift_date)`
4. index on `shift_assignments(staff_profile_id)`

## Conflict Logic The Schema Is Meant To Support

1. overlap checks by comparing assigned shifts for the same staff member
2. leave checks by matching shift dates against approved leave ranges
3. availability checks by matching shift time against submitted windows
4. role checks by comparing `required_role` and `primary_role`
5. contract-hours warnings by summing assigned shift lengths for a week

## Session Storage Note

The deployed direction uses `connect-pg-simple` for sessions. I am treating that session table as infrastructure support rather than a core scheduling table.
