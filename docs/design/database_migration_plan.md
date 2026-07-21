# Database Migration Plan

The migration folder is the build history of the PostgreSQL database. Each numbered file changes one part of the structure or safe demo data. Applied files are not renamed or edited just to make the final design look as if it existed from the start.

## What happened in order

| Migrations | What they added or changed |
| --- | --- |
| `001` to `003` | Login users first, staff profiles linked to those users next, then the first safe seed records. |
| `004` to `007` | Weekly availability, Time Off, shifts and shift assignments. Availability was later removed, but the original step stays in the history. |
| `008` to `013` | Kitchen Porter/`OTHER`, rota audit records, password security fields, security events, reset requests and shift swaps. |
| `014` | Removed weekly availability after the workflow changed to normal rota patterns with Time Off and swaps for exceptions. |
| `015` to `019` | Corrected demo identities, added the local owner profile and passkeys, then removed placeholder staff. |
| `020` to `022` | Built NodyChat in stages: messages, read states, then workplace/direct conversations and participants. |
| `023` | Reused the append-only audit table for Employee Summary view, print-request and denied-access records. |
| `024` and `025` | Added the separate Admin role, peppered-password compatibility, session versioning and one-use Admin invitations. |
| `026` | Corrected the four original demo addresses without changing their user IDs or staff records. |
| `027` | Allowed a shift such as 22:00-02:00 to finish the following day, while still rejecting a zero-length shift. |

## Why the order matters

First I needed a user before a staff profile could point to one. Time Off and shifts had to exist before assignment checks could use them. A swap then had to point to an existing assignment. NodyChat participants could only be added after its messages and read-state base existed. The Admin routes came after the user table had fields for the separate role, password scheme, pepper version and session version.

Migration `014` is important because it records a real design correction. Migration `004` is not deleted even though weekly availability is no longer live. In the same way, migration `027` was added instead of changing the original shift file after it had already been applied.

## Current rules after migration 027

PostgreSQL protects the main links with UUID keys, foreign keys, allowed roles/statuses, non-negative contract hours, valid date ranges and one assignment per shift. It also keeps raw password-reset and Admin-invitation tokens out of the database.

Rules involving several records stay in the backend service. Those include active account and role checks, approved Time Off, shift collisions, weekly shift/hour totals, swap ownership, final-Admin protection and ordinary Admin passkey setup.

## Applying and checking migrations

Run from `backend/`:

```powershell
npm run db:migrate
npm run db:migrate:status
```

For the guarded local evidence database:

```powershell
npm run local:evidence:migrate
npm run local:evidence:check
```

The runner saves every applied filename in `schema_migrations` and wraps each file in its own transaction. If one file fails, that file rolls back. An earlier file that already committed does not roll back with it, so the status command must be checked before retrying.
