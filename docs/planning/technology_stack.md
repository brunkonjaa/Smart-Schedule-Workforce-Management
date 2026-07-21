# Technology Stack

This is the technology actually used by Smart Schedule. I have explained each choice by the job it does in this project rather than listing names on their own.

| Part | Choice | Why I used it |
| --- | --- | --- |
| Browser interface | HTML, CSS and JavaScript | The application is mainly rota tables, forms, dialogs and role-based actions. Plain browser code kept those screens visible without adding a separate build system. |
| Application server | Node.js with Express | It runs the routes, login sessions, permission checks and hospitality rules in one backend. |
| Database | PostgreSQL | Staff, leave, shifts, assignments, swaps and conversations are linked records, so a relational database fits the job. |
| Database connection | `pg` | It connects the Node.js backend to PostgreSQL and is also used by the migration runner. |
| Hosted database | Neon | It provides the PostgreSQL database used by the Render deployment. |
| Hosted application | Render | It runs the Node.js service and serves the frontend from the same origin. |
| Login sessions | `express-session` and `connect-pg-simple` | Session data stays on the server and is stored in PostgreSQL instead of putting login details in browser storage. |
| Password storage | Argon2id, an environment pepper and legacy bcrypt verification | New passwords use the current scheme. A correct older bcrypt login upgrades that one account without asking everybody to reset at once. |
| Password and Admin email | Brevo | The hosted app uses it for password-reset and Admin-invitation links. It is an outside dependency and is recorded as one. |
| Live chat | WebSocket through `ws` | NodyChat can update an open workplace or direct conversation while still using the existing signed-in session. |
| Automated checks | Jest and Supertest | They exercise the routes, permissions, scheduling conflicts and failure cases against PostgreSQL. |
| Work trail | Jira and GitHub | Jira records the sprint trail, while GitHub stores the code, pull requests, workflow results and final tag. |
| Report diagrams | Visual Paradigm and repo-generated SVG/PNG files | They show the final database, architecture and workflow without inventing services that do not exist. |

## Why I did not add a frontend framework

I chose plain HTML, CSS and JavaScript because adding a framework would not solve a hospitality rota problem by itself. It would also create another layer to build, explain and maintain during the semester. The drawback is that I had to keep the browser modules and event flow organised by hand. That was an acceptable trade-off for this size of application.

## Environment values

The backend needs a PostgreSQL connection, a session secret and the current versioned password pepper. Render also needs its public application URL. Brevo and the temporary first-Admin bootstrap value are only needed for those specific workflows.

The complete placeholder list is in the root `.env.example`. Real values belong in the ignored `backend/.env` or the hosting provider, never in Markdown, screenshots or Git. The separate ignored `backend/local-evidence.env` is restricted to local PostgreSQL so an evidence reset cannot quietly target Neon.

## Trade-offs kept visible

Render can have free-tier cold starts. Brevo email and Neon recovery depend on outside providers. Plain JavaScript needs manual organisation, and the current rate limits assume one Node process. These were reasonable choices for the submitted application, but they are limits rather than hidden benefits.
