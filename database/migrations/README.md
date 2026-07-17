# Database Migrations

The migrations in this folder are ordered PostgreSQL changes. Do not renumber an applied file.

## Current files

1. `001_create_users_schema.sql`
2. `002_create_staff_profiles_schema.sql`
3. `003_seed_initial_data.sql`
4. `004_create_availability_entries_schema.sql` - historical and retired by 014
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
17. `017_add_bruno_demo_profile.sql`
18. `018_create_user_passkeys_schema.sql`
19. `019_remove_placeholder_staff.sql`
20. `020_create_chat_messages_schema.sql`
21. `021_create_chat_read_states_schema.sql`
22. `022_create_private_chat_conversations.sql` - adds `WORKPLACE` and `DIRECT` conversations, participants, conversation links on messages, and per-user/per-conversation read state

## Running them

From `backend/`:

```powershell
npm run db:migrate
npm run db:migrate:status
```

For local PostgreSQL evidence:

```powershell
npm run local:evidence:check
npm run local:evidence:migrate
```

The runner writes applied filenames to `schema_migrations`. Keep seed data in scripts when it needs to be reset or regenerated. The demo rota is created by `seed-demo-history.js`, while `seed-staff-history.js` adds the twelve previous worked weeks used by the staff overview example.
