# Database Design

## Change Note

- Previous position: this design included `skills`, `swap_requests`, `assignment_override_reasons`, `rota_publications`, and `audit_log`. It also assumed `MySQL`.
- Updated position: the design is now smaller and uses `PostgreSQL`.
- Why: to match the current proposal and current MVP.

## Purpose

This document defines the core PostgreSQL schema for the current MVP.

## Design Rules

1. Keep the schema relational and clear.
2. Keep one source of truth for staff, shifts, leave, and assignments.
3. Use constraints where they help.
4. Keep the first version small enough to build and test properly.

## Current Scope Tables

1. `users`
2. `staff_profiles`
3. `availability_entries`
4. `leave_requests`
5. `shifts`
6. `shift_assignments`

## Deferred Tables From Earlier Drafts

These are not part of the first schema version now:

1. `skills`
2. `staff_skills`
3. `assignment_override_reasons`
4. `swap_requests`
5. `rota_publications`
6. `audit_log`

## PostgreSQL Notes

1. Use native `UUID` columns.
2. Use `TIMESTAMPTZ` for timestamps.
3. Use `CHECK` constraints for simple rules.
4. Use `gen_random_uuid()` if `pgcrypto` is enabled.

## Table Definitions

### `users`

Purpose: login identity and user role.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `role` | VARCHAR(20) | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL DEFAULT `true` |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Notes:

1. `email` should be stored in lowercase.
2. `role` is either `MANAGER` or `STAFF`.

### `staff_profiles`

Purpose: staff data linked to a user account.

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

### `availability_entries`

Purpose: weekly availability windows submitted by staff.

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

1. `status` is either `AVAILABLE` or `UNAVAILABLE`.
2. `end_time` must be greater than `start_time`.
3. Exact duplicate entries should be blocked.

### `leave_requests`

Purpose: staff leave workflow.

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

1. `status` is `PENDING`, `APPROVED`, or `REJECTED`.
2. `end_date` must be on or after `start_date`.

### `shifts`

Purpose: shift records for the rota week.

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

1. `end_time` must be greater than `start_time`.
2. Only same-day shifts are supported in the MVP.

### `shift_assignments`

Purpose: assign one staff member to one shift.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | UUID | PK |
| `shift_id` | UUID | FK -> `shifts.id`, UNIQUE, NOT NULL |
| `staff_profile_id` | UUID | FK -> `staff_profiles.id`, NOT NULL |
| `assigned_by_user_id` | UUID | FK -> `users.id`, NOT NULL |
| `assigned_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

Notes:

1. One shift has one assignment in the MVP.
2. Reassignment updates the same record or replaces it in service logic.

## Indexing Plan

1. Unique index on `users(email)`
2. Index on `staff_profiles(is_active)`
3. Index on `availability_entries(staff_profile_id, week_start, day_of_week)`
4. Index on `leave_requests(staff_profile_id, start_date, end_date, status)`
5. Index on `shifts(shift_date)`
6. Index on `shift_assignments(staff_profile_id)`

## Conflict Logic Supported By Schema

1. Overlap check by joining `shift_assignments` and `shifts` for the same staff member and date
2. Leave check by matching `shift_date` against approved leave ranges
3. Availability check by matching shift time to submitted windows
4. Role check by comparing `shifts.required_role` and `staff_profiles.primary_role`
5. Contract hours warning by summing assigned shift lengths for the week

## Session Storage Note

The deployed app uses `connect-pg-simple` for sessions. That session table is infrastructure support. It is not part of the core project schema.
