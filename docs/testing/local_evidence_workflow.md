# Local Evidence Workflow

Use this workflow for repeatable Smart Schedule checks against local PostgreSQL. The guard is important: the hosted `.env` points to Neon, so reset and seed commands must use `backend/local-evidence.env` instead.

## Setup

1. copy `backend/local-evidence.env.example` to `backend/local-evidence.env`
2. set the local PostgreSQL password
3. create the database named in the file, normally `smart_schedule_local`
4. keep `local-evidence.env` outside Git

## Commands

Run from `backend/`:

```powershell
npm run local:evidence:check
npm run local:evidence:migrate
npm run local:evidence:seed
npm run local:evidence:start
```

`npm run local:evidence:all` runs the local check, pending migrations, and recommendation seed in sequence.

For the full rota seed and staff overview history:

```powershell
npm run db:seed:demo-history:reset
npm run db:seed:staff-history
```

The first command creates 24 active Irish-named staff records, Monday-Friday demo shifts, and the current/next week. The second command gives `alex.byrne@example.com` two assigned shifts in each of the previous twelve weeks.

## Evidence accounts

The recommendation evidence manager is:

```text
evidence.manager@evidence.smart-schedule.test
EvidenceManager123!
```

The controlled recommendation week is `2026-07-13`, with a target open shift on `2026-07-15` from `15:00` to `21:00` for `BAR`.

The local seed script prints the exact account names and domain it creates. Do not put local passwords or reset tokens into committed screenshots or Markdown.

## Safety rule

If `DATABASE_URL` is not local, the evidence scripts refuse to run. Do not bypass that guard for a demo reset. Hosted checks should read the hosted data without deleting or reseeding it.
