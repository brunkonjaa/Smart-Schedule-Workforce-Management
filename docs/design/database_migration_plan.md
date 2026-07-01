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
4. `database/migrations/004_create_availability_entries_schema.sql`
5. `database/migrations/005_create_leave_requests_schema.sql`
6. `database/migrations/006_create_shifts_schema.sql`
7. `database/migrations/007_create_shift_assignments_schema.sql`
8. `database/migrations/008_allow_other_work_role.sql`
9. `database/migrations/009_create_audit_logs_schema.sql`

## What Is Already Applied In The Current Build Trail

Already done:

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `003_seed_initial_data.sql`
4. `004_create_availability_entries_schema.sql`
5. `005_create_leave_requests_schema.sql`
6. `006_create_shifts_schema.sql`
7. `007_create_shift_assignments_schema.sql`
8. `008_allow_other_work_role.sql`
9. `009_create_audit_logs_schema.sql`

That gives the project:

1. the identity table
2. the linked staff profile table
3. starter records for one manager and three staff users
4. weekly availability entry storage
5. leave request storage with manager decision fields
6. shift storage before assignment logic
7. saved shift assignment storage for one staff member per shift
8. `OTHER` as a real work role for the rota tabs
9. audit records for manager shift and assignment changes

## Why The Order Was Kept This Way

The order was not random.

First I needed the migration runner. After that I needed `users` because everything identity-related depends on it. Then `staff_profiles` had to come next because later staff operations depend on that link. Seed data only made sense after both tables were stable.

If I had mixed staff schema and seed records together too early, the history would be harder to explain and a failed migration would be messier to isolate.

## PostgreSQL Decisions Locked In

1. use native `UUID`
2. use `TIMESTAMPTZ`
3. use `CHECK` constraints for simple validation
4. use `gen_random_uuid()` through `pgcrypto`

## Why The Next Three Were Added In This Order

I kept `availability_entries` first because the project needed real weekly availability data before I could say anything honest about coverage checks later.

Next I added `leave_requests` because assignment blocking makes no sense if approved leave does not exist in the database yet.

After that I added `shifts` because there was no point talking about assignment or rota logic before actual shift records existed.

That means the repo has now reached the point where the next schema step really is `shift_assignments`, not availability or leave anymore.

I added `shift_assignments` after `shifts` because assignment records need both a real shift and a real staff profile before they can mean anything. This migration still does not make the assignment engine complete by itself. It only gives the next route and conflict-check work a proper table to write to.

After the rota-first work, I added `008_allow_other_work_role.sql` because the fourth rota tab needed to be backed by a real role value instead of being only frontend display.

I added `009_create_audit_logs_schema.sql` after assignment and rota actions were live. Before that, there were not enough manager actions worth recording.

## Constraints Already Real

1. lowercase email check on `users.email`
2. role check on `users.role`
3. unique `staff_profiles.user_id`
4. `staff_profiles.contract_hours >= 0`

## Constraints Added In The Current Checkpoint

1. `availability_entries.day_of_week BETWEEN 1 AND 7`
2. `availability_entries.end_time > availability_entries.start_time`
3. `leave_requests.end_date >= leave_requests.start_date`
4. `shifts.end_time > shifts.start_time`
5. role and status checks on the new workflow tables
6. non-blank checks where text fields should not accept empty trimmed values

## Constraint Direction

1. assignment route validation is handled in the route and service layer
2. leave, overlap, back-to-back shift, availability, and role checks are handled in service logic
3. any later assignment-side checks should only move into database rules if the app needs stronger data-level protection

## Seed Data Plan

The current seed file already adds:

1. one manager user
2. three staff users
3. matching staff profiles

I kept it small on purpose. It is enough to test identity and early staff flows without filling the repo with demo noise too early.

Later sample data for assignments should only be added after `shift_assignments` actually exists.

## Session Table Note

`connect-pg-simple` is now wired through `backend/src/config/session.js`, and the current setup lets it create `user_sessions` with `createTableIfMissing: true`.

I left that outside the main migration chain for now because the goal of that checkpoint was to get the session base running first. If the session table starts needing more control later, I can still add a dedicated migration.

## Next Action

1. keep audit log viewing out unless there is time after deployment and UAT
2. keep deployment and hosted database checks separate from local workflow commits
3. only add another migration when the app has a real data need for it
