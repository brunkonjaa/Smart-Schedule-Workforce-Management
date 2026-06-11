# Technology Stack

## Why This File Exists

This file is the plain stack record for the current repo, not a wishlist.

Older notes drifted between `MySQL`, `PostgreSQL`, and bigger framework combinations. I needed one place that says what I actually kept and why.

## Current Stack

| Area | Current Choice | Repo State |
| --- | --- | --- |
| Frontend | `HTML`, `CSS`, `JavaScript` | built as a shell |
| Backend | `Node.js` with `Express` | foundation in place |
| Database | `PostgreSQL` | connected to Neon |
| Database host | `Neon Free` | active |
| Web host target | `Render Free Web Service` | planned direction |
| API style | REST JSON | planned beyond `/health` |
| Database driver | `pg` | wired now |
| Auth direction | `express-session` | middleware wired, login flow still next |
| Session store direction | `connect-pg-simple` | PostgreSQL-backed store wired |
| Password hashing | `bcrypt` | package installed, usage still next |
| Environment config | `dotenv` | wired now |
| Testing direction | `Jest`, `Supertest`, `Postman`, manual checks | planned, not built out yet |
| Project tracking | Jira | active |
| Source control | GitHub | active |

## Why I Kept This Stack

I kept the stack simple on purpose.

`Node.js` and `Express` are enough for the API side of this project, and plain frontend code is enough for the UI shell I already built. For a semester project that matters, because every extra framework decision becomes another thing to explain, debug, and maintain.

I moved the database direction to `PostgreSQL` and stayed there. That fits the relational model better than trying to bend the project into a document database, and it also matches the current proposal instead of fighting it.

## What Changed From The Older Direction

The earlier stack notes leaned on `MySQL` with `mysql2`.

I changed that to:

1. `PostgreSQL`
2. `pg`
3. `Neon Free`
4. `Render Free Web Service`

I made that change before the real schema work went too far, which saved me from having two different database stories across the repo.

## Core Build Rules

1. keep the frontend plain unless there is a real reason to add more tooling
2. keep business rules in project code, not hidden in third-party services
3. keep the schema project-owned
4. keep authentication session-based
5. keep hosting cheap enough for the module, even if that means accepting free-tier limits

## Libraries That Matter Right Now

### `express`

Used for the backend app and routing. At the moment the live route in the repo is still just the health check, so this is foundation first.

### `pg`

Used to connect the backend to PostgreSQL and Neon.

### `dotenv`

Used to load local environment values such as `DATABASE_URL`.

### `express-session`

Used to keep login state on the server. The middleware is now wired into the Express app, even though the actual login and logout routes still come next.

### `connect-pg-simple`

Used to keep session records in PostgreSQL instead of the default memory store.

### `bcrypt`

Installed for password hashing. Same story here. The decision is locked, but the login code still comes after the identity and seed groundwork.

### `Jest` and `Supertest`

Installed as the test direction for backend work. There are no proper automated test files in the repo yet, so this is still preparation rather than finished coverage.

## Deployment Notes

1. the Neon connection should use SSL
2. Render will need environment variables for database access and session secrets
3. the hosted app should use `DATABASE_URL`
4. session storage should not stay on the default memory store once auth is active

## Environment Variables In Use Or Planned

1. `DATABASE_URL`
2. `SESSION_SECRET`
3. `NODE_ENV`
4. `PORT`

If the stack changes again, it needs to be recorded in `docs/planning/decision_log.md` instead of quietly drifting in one file only.
