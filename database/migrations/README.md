# Database Migrations

This folder holds the ordered PostgreSQL migration files for the project.

## Current Files

At this checkpoint the folder contains:

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `003_seed_initial_data.sql`
4. `004_create_availability_entries_schema.sql`
5. `005_create_leave_requests_schema.sql`
6. `006_create_shifts_schema.sql`
7. `007_create_shift_assignments_schema.sql`
8. `008_allow_other_work_role.sql`

The order matters. I kept the schema work first and the sample data after that because it is much easier to explain and debug that way.

## Naming Rule

Each migration file should:

1. be a plain `.sql` file
2. start with a zero-padded number
3. use a short snake_case description after the number

Examples:

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `004_create_availability_entries_schema.sql`
4. `007_create_shift_assignments_schema.sql`
5. `008_allow_other_work_role.sql`

## Run Commands

Run migrations from `backend/`:

1. `npm run db:migrate`
2. `npm run db:migrate:status`

## What The Runner Tracks

The backend migration runner stores applied filenames in the `schema_migrations` table.

That table is there so I can answer two simple questions without guessing:

1. what has already been applied
2. what is still pending

## Practical Rule

Keep schema changes and seed data separate where possible.

That adds one extra file sometimes, but it keeps the history cleaner. If a schema file fails, I know I am debugging structure. If a seed file fails, I know I am debugging records.

## Session Table Note

The project is already wired to use `connect-pg-simple` through `backend/src/config/session.js`.

Right now I am letting that library manage the `user_sessions` table with `createTableIfMissing: true` instead of forcing it into the main migration chain. That keeps the first auth checkpoint smaller. If that starts getting awkward later, I can still add a dedicated SQL migration for sessions.
