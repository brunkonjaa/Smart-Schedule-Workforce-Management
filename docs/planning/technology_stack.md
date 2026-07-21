# Technology Stack

This is the stack actually used by the current Smart Schedule repo.

| Area | Choice | Why it is here now |
| --- | --- | --- |
| Frontend | HTML, CSS, JavaScript | The rota and workflow screens can stay visible without adding a frontend build step. |
| Backend | Node.js with Express | It gives the app routes, middleware, sessions, and service code in one small backend. |
| Database | PostgreSQL | The users, staff, leave, shifts, assignments, reset, swap, and audit records are relational. |
| Database driver | `pg` | Used by the backend database pool and migration support. |
| Hosted database | Neon | This is the current hosted PostgreSQL direction. |
| Hosted app | Render | This is the current hosted web-service direction. |
| Sessions | `express-session` and `connect-pg-simple` | Login state stays server-side and session rows are stored in PostgreSQL. |
| Passwords | `argon2` plus legacy `bcrypt` verification | New passwords use HMAC-SHA-256 with a versioned environment pepper before Argon2id. A correct legacy bcrypt login upgrades that one row. |
| Email reset output | Brevo transactional email API | Render sends reset and Admin activation links through Brevo's HTTPS API. The local fallback does not print the links. |
| Testing | Jest and Supertest | The backend route suites cover auth, Admin lifecycle, staff, leave, shifts, assignments, rota, password reset, swaps, passkeys and chat. |
| Tracking | Jira and GitHub | Jira records the work trail and GitHub stores the code checkpoints. |
| Diagrams | Visual Paradigm | The exported diagrams support the SRS without inventing extra system parts. |

## Why I stayed with plain frontend code

I chose plain HTML, CSS, and JavaScript because this project is mainly a set of connected forms, cards, rota cells, and role-based actions. A framework could organise this differently, but it would also add another build layer to explain and maintain. The drawback is that the frontend modules and event flow need to be kept tidy by hand.

## Environment values

The backend reads these values through `dotenv` and `backend/src/config/env.js`:

1. `DATABASE_URL`
2. `SESSION_SECRET`
3. `NODE_ENV`
4. `PORT`
5. versioned password pepper configuration
6. temporary first-Admin bootstrap configuration
7. Brevo values when reset or invitation email delivery is enabled

`backend/local-evidence.env` is for local PostgreSQL only and stays outside Git.
