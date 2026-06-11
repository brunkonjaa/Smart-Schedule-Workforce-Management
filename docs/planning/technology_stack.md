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
| API style | REST JSON | `/health` and auth routes live |
| Database driver | `pg` | wired now |
| Auth direction | `express-session` | login, logout, and session user routes live |
| Session store direction | `connect-pg-simple` | PostgreSQL-backed store wired |
| Password hashing | `bcrypt` | used in auth service |
| Environment config | `dotenv` | wired now |
| Testing direction | `Jest`, `Supertest`, `Postman`, manual checks | auth route tests started |
| Diagramming | `Visual Paradigm` | SRS diagram exports committed |
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

Used for the backend app and routing. The repo now has the health route plus the first auth routes, so the backend is finally doing more than just boot and answer one connectivity check.

### `pg`

Used to connect the backend to PostgreSQL and Neon.

### `dotenv`

Used to load local environment values such as `DATABASE_URL`.

### `express-session`

Used to keep login state on the server. The middleware is wired into the Express app and now backs `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`.

### `connect-pg-simple`

Used to keep session records in PostgreSQL instead of the default memory store.

### `bcrypt`

Used for password checking in the auth service. I kept that simple first. The stronger route protection and role checks still come after this step.

### `Jest` and `Supertest`

Used now for the first backend route tests. The repo still does not have broad workflow coverage, but auth route tests are in place and the rest of the test surface can build on that.

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
