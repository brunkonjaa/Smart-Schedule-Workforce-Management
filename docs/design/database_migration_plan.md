# Database Migration Plan

This file follows the migration order that is actually in `database/migrations/`. The order matters because users come before staff profiles, and shifts and assignments cannot work until those links exist.

## Migration files

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `003_seed_initial_data.sql`
4. `004_create_availability_entries_schema.sql` - historical table, removed by 014
5. `005_create_leave_requests_schema.sql`
6. `006_create_shifts_schema.sql`
7. `007_create_shift_assignments_schema.sql`
8. `008_allow_other_work_role.sql`
9. `009_create_audit_logs_schema.sql`
10. `010_add_user_security_fields.sql`
11. `011_create_security_events_schema.sql`
12. `012_create_password_reset_requests_schema.sql`
13. `013_create_shift_swap_requests_schema.sql`
14. `014_remove_weekly_availability.sql`
15. `015_normalize_seed_staff_emails.sql`
16. `016_normalize_seed_staff_fake_gmail.sql`

## Why this order was used

First I needed the migration runner and the `users` table. The `staff_profiles` table depends on that identity row. Leave and shifts came next because assignment checks need both approved leave and real shift times. `shift_assignments` then gives the manager workflow somewhere to save the result.

After that, `OTHER` was added for the Kitchen Porter rota tab, audit rows were added for manager shift and assignment changes, and the security migrations added password-change/reset support and security events. The swap table came after the assignment table because a swap is attached to an existing assignment. Migration `014` retires weekly availability because the final workflow uses leave and shift swaps instead of a new availability submission every week. Migration `015` changes the three starter staff emails to match their names, and migration `016` makes those accounts visibly fake with `firstname...fake@gmail.com` addresses.

## Current database rules

The SQL layer enforces UUID keys, foreign keys, non-negative contract hours, valid time/date ranges, allowed roles and statuses, unique assignment per shift, and token/request tables. The service layer checks role matching, Time Off, overlap, touching shifts, weekly shift/hour limits, swap eligibility, and ownership.

## Running migrations

From `backend/`:

```powershell
npm run db:migrate
npm run db:migrate:status
```

For local evidence use the guarded commands instead:

```powershell
npm run local:evidence:migrate
npm run local:evidence:check
```

The migration runner records applied filenames in `schema_migrations`. I keep schema changes and seed scripts separate so a failed structure change is not confused with bad demo records.
