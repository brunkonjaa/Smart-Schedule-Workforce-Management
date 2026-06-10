# Database Migration Plan

## Change Note

- Previous position: this plan was written for `MySQL` and a larger schema.
- Updated position: this plan now targets `PostgreSQL` and the tighter MVP schema.
- Why: to match the current database design.

## Purpose

This document turns the database design into a practical migration order.

## Migration Style

1. Use plain SQL files
2. Use simple numbered filenames
3. Keep the first migration focused on schema only
4. Put seed data in a separate file

## Planned Migration Files

1. `database/migrations/001_create_users_schema.sql`
2. `database/migrations/002_create_staff_profiles_schema.sql`
3. `database/migrations/003_seed_initial_data.sql`

## PostgreSQL Decisions

1. Use native `UUID`
2. Use `TIMESTAMPTZ`
3. Use `CHECK` constraints for basic validation
4. Use `gen_random_uuid()` if available

## Build Order

### Step 1: Extensions and Shared Setup

Create or confirm:

1. `pgcrypto` if UUID generation uses `gen_random_uuid()`

### Step 2: Identity Tables

Create in this order:

1. `users`
2. `staff_profiles`

### Step 3: Availability and Leave

Create in this order:

1. `availability_entries`
2. `leave_requests`

### Step 4: Shifts and Assignments

Create in this order:

1. `shifts`
2. `shift_assignments`

## Required Constraints

1. `users.email` unique
2. `staff_profiles.user_id` unique
3. `availability_entries.day_of_week BETWEEN 1 AND 7`
4. `availability_entries.end_time > availability_entries.start_time`
5. `leave_requests.end_date >= leave_requests.start_date`
6. `shifts.end_time > shifts.start_time`
7. `shift_assignments.shift_id` unique

## Required Foreign Keys

1. `staff_profiles.user_id -> users.id`
2. `availability_entries.staff_profile_id -> staff_profiles.id`
3. `leave_requests.staff_profile_id -> staff_profiles.id`
4. `leave_requests.decided_by_user_id -> users.id`
5. `shifts.created_by_user_id -> users.id`
6. `shift_assignments.shift_id -> shifts.id`
7. `shift_assignments.staff_profile_id -> staff_profiles.id`
8. `shift_assignments.assigned_by_user_id -> users.id`

## Required Indexes

1. Unique index on `users(email)`
2. Index on `staff_profiles(is_active)`
3. Index on `availability_entries(staff_profile_id, week_start, day_of_week)`
4. Index on `leave_requests(staff_profile_id, start_date, end_date, status)`
5. Index on `shifts(shift_date)`
6. Index on `shift_assignments(staff_profile_id)`

## Seed Data Plan

The seed file should add:

1. one manager user
2. a few staff users
3. matching staff profiles
4. sample availability
5. sample leave requests
6. sample shifts

## Session Table Note

If `connect-pg-simple` is used with its own table creation option, that table can stay outside the main migration files. If not, add a small session-table migration later.

## Next Action

Write `database/migrations/001_create_users_schema.sql`.
