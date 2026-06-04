# Technology Stack

## Change Note

- Previous position: the stack was locked as `MySQL` with `mysql2`.
- Updated position: the stack now uses `PostgreSQL`, `pg`, `Neon Free`, and `Render Free Web Service`.
- Why: to match the current proposal and hosting plan.

## Current Stack

| Area | Decision |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Frontend support | Bootstrap, limited use |
| Backend | Node.js with Express |
| Database | PostgreSQL |
| Database hosting | Neon Free |
| Web hosting | Render Free Web Service |
| API style | REST |
| Authentication | Session-based authentication |
| Session library | `express-session` |
| Session store | `connect-pg-simple` |
| Password security | `bcrypt` |
| Database access | `pg` |
| Environment config | `dotenv` |
| Testing | Jest, Supertest, Postman, manual UAT |
| Project management | Trello |
| Source control | GitHub |

## Why This Stack

This stack keeps the project simple. It also fits the system well.

Node.js and Express are enough for the API and business rules. HTML, CSS, and JavaScript are enough for the frontend. PostgreSQL fits the relational data model better than a document database, and Neon gives an easy hosted database option. Render gives a simple way to deploy the app.

## Why The Database Changed

The older draft used `MySQL`. The current proposal uses `PostgreSQL`.

## Core Rules

1. Third-party tools can support the app, but they do not define the project.
2. The scheduling rules stay in project code.
3. The database schema stays project-owned.
4. Authentication stays session-based.
5. The frontend stays plain HTML, CSS, and JavaScript.

## Libraries That Support The Build

### Express

Used for backend routing and request handling.

### PostgreSQL

Used for relational data such as users, staff profiles, availability, leave requests, shifts, and assignments.

### pg

Used to connect the Node.js backend to PostgreSQL.

### express-session

Used to keep login state on the server.

### connect-pg-simple

Used to store sessions in PostgreSQL. This matters for deployment on Render.

### bcrypt

Used to hash passwords.

### dotenv

Used to load environment variables.

### Jest and Supertest

Used for backend and API testing.

## Deployment Notes

1. Neon connections should use SSL.
2. Render needs environment variables for database access and session secrets.
3. The app should use `DATABASE_URL` for the hosted database.
4. Session storage should not use the default memory store in production.

## Environment Variables

1. `DATABASE_URL`
2. `SESSION_SECRET`
3. `NODE_ENV`
4. `PORT`

If it changes again, record it in `docs/planning/decision_log.md`.
