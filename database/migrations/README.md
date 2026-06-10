# Database Migrations

Use this folder for ordered PostgreSQL migration files.

## Naming Rule

1. Use plain `.sql` files.
2. Start each filename with a zero-padded number.
3. Add a short snake_case description after the number.

Examples:

1. `001_create_users.sql`
2. `002_create_staff_profiles.sql`

## Run Commands

From `backend/`:

1. `npm run db:migrate`
2. `npm run db:migrate:status`

The runner stores applied filenames in the `schema_migrations` table.
