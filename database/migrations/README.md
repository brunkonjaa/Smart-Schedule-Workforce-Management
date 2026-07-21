# Database Migrations

The migrations in this folder tell the database side of the build in order. A later file can change an earlier decision, as migration `014` does for weekly availability and `027` does for overnight shifts. Do not renumber or rewrite an applied file, because another database may already have recorded that exact filename.

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
23. `023_extend_audit_logs_for_employee_access.sql` - extends the existing Audit Log checks for Employee Summary view, print-request and denied-access events using the `STAFF_PROFILE` entity type
24. `024_extend_users_for_admin_and_peppered_passwords.sql` - adds the separate `ADMIN` role, Admin display/reviewer fields, password scheme and pepper version tracking, and session versioning
25. `025_create_admin_invitations.sql` - stores hashed one-use Admin invitations with expiry and one terminal state
26. `026_normalize_seed_account_addresses.sql` - gives the four original Irish-named seed accounts name-based Gmail-format addresses with the existing `fake` safety marker
27. `027_allow_overnight_shifts.sql` - treats an end time earlier than the start as the next calendar day while still blocking zero-length shifts

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

The runner writes applied filenames to `schema_migrations`. Migration `023` changes check constraints only. It does not add columns or rewrite existing audit rows, which is why the Employee access work could stay on the append-only `audit_logs` table.

Migration `024` deliberately leaves existing password rows marked as `BCRYPT`. A correct login upgrades one row to peppered Argon2id, so there was no bulk password rewrite and no password had to be collected again. Migration `025` stores only a SHA-256 invitation token hash. Its check constraint stops used, cancelled and expired states being set together. Migration `026` keeps the original seed identities but uses name-based Gmail-format addresses with `fake` in the local part. That marker is deliberate because the records are demo accounts, not real staff inboxes.

Keep seed data in scripts when it needs to be reset or regenerated. The demo rota is created by `seed-demo-history.js`, while `seed-staff-history.js` adds the twelve previous worked weeks used by the staff overview example.
