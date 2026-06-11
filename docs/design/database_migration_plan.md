# Database Migration Plan

## Why This File Exists

This file turns the schema direction into the order I am actually using in the repo.

It used to be easier for these migration notes to drift into abstract planning. I do not want that here. This file should show what is already done, what is next, and why the order matters.

## Migration Style

I am keeping the migration style simple:

1. plain SQL files
2. numbered filenames
3. schema first
4. seed data separate from structure

Trade-off accepted:

Keeping schema and seed data separate means an extra step during setup, but it makes debugging much cleaner. If something breaks, I can tell much faster whether the problem is structure or data.

## Migration Files In The Repo Now

1. `database/migrations/001_create_users_schema.sql`
2. `database/migrations/002_create_staff_profiles_schema.sql`
3. `database/migrations/003_seed_initial_data.sql`

## What Is Already Applied In The Current Build Trail

Already done:

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `003_seed_initial_data.sql`

That gives the project:

1. the identity table
2. the linked staff profile table
3. starter records for one manager and three staff users

## Why The Order Was Kept This Way

The order was not random.

First I needed the migration runner. After that I needed `users` because everything identity-related depends on it. Then `staff_profiles` had to come next because later staff operations depend on that link. Seed data only made sense after both tables were stable.

If I had mixed staff schema and seed records together too early, the history would be harder to explain and a failed migration would be messier to isolate.

## PostgreSQL Decisions Locked In

1. use native `UUID`
2. use `TIMESTAMPTZ`
3. use `CHECK` constraints for simple validation
4. use `gen_random_uuid()` through `pgcrypto`

## Build Order For The Next Schema Phase

### Step 1

Create `availability_entries`

Reason:
Availability is the next real dependency for rota conflict checks.

### Step 2

Create `leave_requests`

Reason:
Leave decisions have to exist before assignment blocking can be enforced properly.

### Step 3

Create `shifts`

Reason:
Assignments cannot exist without shift records.

### Step 4

Create `shift_assignments`

Reason:
This is where overlap checks, role checks, and weekly rota output start becoming useful.

## Constraints Already Real

1. lowercase email check on `users.email`
2. role check on `users.role`
3. unique `staff_profiles.user_id`
4. `staff_profiles.contract_hours >= 0`

## Constraints Planned Next

1. `availability_entries.day_of_week BETWEEN 1 AND 7`
2. `availability_entries.end_time > availability_entries.start_time`
3. `leave_requests.end_date >= leave_requests.start_date`
4. `shifts.end_time > shifts.start_time`
5. `shift_assignments.shift_id` unique

## Seed Data Plan

The current seed file already adds:

1. one manager user
2. three staff users
3. matching staff profiles

I kept it small on purpose. It is enough to test identity and early staff flows without filling the repo with demo noise too early.

Later sample data for availability, leave, shifts, and assignments should only be added after those tables actually exist.

## Session Table Note

`connect-pg-simple` is now wired through `backend/src/config/session.js`, and the current setup lets it create `user_sessions` with `createTableIfMissing: true`.

I left that outside the main migration chain for now because the goal of that checkpoint was to get the session base running first. If the session table starts needing more control later, I can still add a dedicated migration.

## Next Action

1. add authentication middleware
2. add role-based access middleware
3. start the availability schema only after the auth base is usable across more than the auth routes
