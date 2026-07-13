# Local Evidence Workflow

This is the local workflow for Smart Schedule evidence checks.

The main rule is simple: do not run reset or evidence seed commands against Neon. The hosted database is for final proof only. Local testing should use a local PostgreSQL database first, because the recommendation modal needs a known open shift, known staff availability, and known excluded staff cases.

## First Setup

1. Copy `backend/local-evidence.env.example` to `backend/local-evidence.env`.
2. Change the password in `DATABASE_URL` so it matches the local PostgreSQL `postgres` user.
3. Keep `backend/local-evidence.env` private. It is ignored by git.
4. Create the local database named in that file if it does not exist yet.

Example database name:

```text
smart_schedule_local
```

## Commands

Run these from `backend`.

```powershell
npm run local:evidence:check
npm run local:evidence:migrate
npm run local:evidence:seed
```

Or run the migrate and seed together:

```powershell
npm run local:evidence:all
```

The script refuses to run if `DATABASE_URL` is not local. That is intentional because `backend/.env` currently points at Neon.

After the local database is ready, run the app against the local evidence data:

```powershell
npm run local:evidence:start
```

Then open:

```text
http://localhost:3000
```

## Recommendation Evidence Data

The local seed creates one controlled manager account and one controlled recommendation scenario.

Use this manager only for local evidence:

```text
evidence.manager@evidence.smart-schedule.test
EvidenceManager123!
```

The seeded rota week is:

```text
2026-07-13
```

The target open shift is:

```text
2026-07-15 15:00-21:00 BAR
```

This gives the recommendation modal enough real data to show eligible staff, score reasons, contract-hour warnings, and excluded staff. That is the evidence we need before trying to repeat the strongest version on hosted.
