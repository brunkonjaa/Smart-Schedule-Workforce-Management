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

`npm run local:evidence:all` runs the local check, pending migrations, and rota evidence seed in sequence.

For the full rota seed and staff overview history:

```powershell
npm run db:seed:demo-history:reset
npm run db:seed:staff-history
```

The first command creates 24 active Irish-named staff records, Monday-Friday demo shifts, and the current/next week. The second command gives Aoife O'Sullivan (`aoifeosullivanfake@gmail.com`) two assigned shifts in each of the previous twelve weeks. The `fake` part is deliberate, so the Gmail-format address is not presented as a real staff address.

## Evidence accounts

For this local check, use `Maeve O'Connor` at `maeveoconnorfake@gmail.com`. Her credentials remain in the ignored local environment or exist only for that seed run. They are not printed or written into this document.

If old local chat messages are no longer useful, run `npm run local:chat:reset` from `backend`. This removes local messages, read markers and direct conversations, then leaves the workplace room ready for new messages. The command refuses a non-local database.

The controlled rota week is `2026-07-13`. It contains staff, shifts, leave and assignment-limit cases for repeatable manager testing.

The local seed script prints the account names and fake domain it creates, but it does not print passwords. Do not put local passwords or reset tokens into committed screenshots or Markdown.

## Safety rule

If `DATABASE_URL` is not local, the evidence scripts refuse to run. Do not bypass that guard for a demo reset. Hosted checks should read the hosted data without deleting or reseeding it.
