# Smart Schedule

Smart Schedule is a small hospitality workforce application built around the weekly rota. It gives managers one place to organise shifts, staff, Time Off and shift swaps, while staff can quickly check what they are working and deal with a change without chasing several people through messages.

Hosted application: [Smart Schedule on Render](https://smart-schedule-workforce-management.onrender.com)

Render is on its free service tier, so the first load can be slow if the application has gone to sleep.

## Why I built it

I have worked in hospitality management for over 25 years. That gave me first-hand experience of how much time a rota can take, especially when leave, role requirements and last-minute changes are spread across paper, spreadsheets and separate messages. A small change can turn into a long job because the manager has to check who is working, who is off, who can do that role and whether another shift already clashes.

That experience is the starting point for Smart Schedule. I did not want to build a set of pretty pages that looked like a product but did not help with the real job. I wanted the manager to get the rota organised, and the staff member to find what they need, without either person spending countless hours trying to work out the system. They should be able to use it quickly and then get on with their lives.

The size of the application is deliberate. It does not have payroll, accounting or a large HR section added just to make the menu look bigger. Small hospitality businesses may not need those sections, or may already handle them somewhere else. Smart Schedule stays focused on the everyday staffing work and can be used by a business if that focused setup suits the way it operates.

## Hospitality, cybersecurity and software development together

The project also joins two years of my studies. My previous year was focused on cybersecurity, and I completed the CompTIA A+, Network+ and Security+ certifications. That work changed how I looked at an application. A login page was no longer enough on its own. I also thought about where passwords are stored, what a session can access, whether Staff can reach Manager information, what happens to a one-use link, and what could leak into a screenshot or Git history.

This year I added the software development side and used it to turn the hospitality problem into a working web application. Then I wrapped both sides in what I call common sense. Security matters, but the user still needs clear pages and short routes through normal tasks. Ease of use matters, but hiding a Manager button from Staff is not security unless the backend refuses the action as well.

That combination gave me the insight and the desire to create something closer to a real product, not just pages and files made for an assignment. It is still a student project with stated limits, but the main workflows work, the hosted version is connected to a real database, and the important rules are tested.

## What people can do

### Manager

A Manager can:

1. create and update staff records;
2. create shifts and assign the right staff member;
3. work from one Monday-to-Sunday rota instead of separate assignment screens;
4. check Bar, Floor, Kitchen and Kitchen Porter departments;
5. approve or reject Time Off and shift swap requests;
6. open an Employee Summary and review the rota activity log;
7. prepare the next week from the current shift pattern, check the suggestions and approve the draft only when it is ready; and
8. use NodyChat for workplace or direct staff conversations.

### Staff

A Staff user can:

1. see the complete weekly rota without Manager editing controls;
2. request Time Off and withdraw their own pending request;
3. review previous worked weeks;
4. ask an eligible colleague to take a future shift, or leave the request open;
5. follow the shift swap until a Manager makes the final decision; and
6. use NodyChat without gaining access to another person's direct conversation.

### Administrator

Admin is a separate account-security role. It can invite another administrator, disable an account, revoke sessions or passkeys and review security events. It does not automatically inherit the Manager's rota, staff, Employee Summary, Audit Log or chat access. This separation was intentional because an account administrator does not need to see employee records just because the account has security responsibilities.

## How the rota rules work

Before an assignment is saved, the backend checks the staff member is active, has the required role, is not on approved leave and does not already have a shift that overlaps or touches the new one. It also blocks more than five shifts or forty hours in the Monday-to-Sunday week.

Contract hours work differently. Going above a person's contract returns a warning, but it does not automatically block the save if the hard limits still pass. I kept that distinction because hospitality sometimes needs agreed extra hours, and the Manager still needs to see the warning before finalising the rota.

Overnight shifts are supported. For example, a shift from 22:00 to 02:00 finishes on the following day. A start and end time that are exactly the same are rejected because that would have no clear length.

`Populate next week` is an assistant, not an automatic scheduling engine. It moves the current pattern forward by seven days, suggests eligible staff and leaves anything it cannot safely fill visible to the Manager. Nothing is saved until the Manager reviews and approves it.

## Why weekly availability was removed

An earlier version asked staff to submit a weekly availability form. I removed it because it added another job for every staff member and did not match the normal routine I knew from hospitality. The final workflow treats the regular staffing pattern as normal and records exceptions through Time Off and future shift swaps.

The old availability migration remains in the database history because it was genuinely built. Migration `014_remove_weekly_availability.sql` then removes it. Keeping both files shows the real build order instead of rewriting the history to make the final idea look like the first idea.

## Security choices in plain language

- Passwords are not stored as readable text. New and changed passwords use peppered Argon2id, and a correct login can upgrade an older bcrypt record.
- Login state is stored in a server-side PostgreSQL session. The browser cookie is `HttpOnly`, `SameSite=Lax` and `Secure` in production.
- Admin, Manager and Staff permissions are checked by the backend, not only by which buttons are visible.
- Password reset and Admin invitation links expire, work once and are stored as hashes rather than raw tokens.
- Normal Admin accounts require a passkey before the Admin workspace opens. The narrowly defined submission-reviewer exception applies only to that named account type.
- NodyChat checks conversation membership before loading, sending, marking as read or broadcasting a message.
- State-changing requests use the application's mutation header and origin checks, and request size and rate limits are applied.

This is a source, dependency, automated-test and manual evidence review. It is not presented as an independent penetration test.

## What I used to build it

| Part | Choice | What it does here |
| --- | --- | --- |
| Browser interface | HTML, CSS and JavaScript | Shows the rota and the Manager, Staff and Admin workflows without a frontend build framework. |
| Application server | Node.js and Express | Handles login, rules, permissions and API requests. |
| Database | PostgreSQL | Stores users, staff, shifts, assignments, Time Off, swaps, chat and audit records. |
| Hosted database | Neon | Runs the PostgreSQL database used by the hosted application. |
| Hosting | Render | Runs the live Node.js application. |
| Email | Brevo | Sends hosted password-reset and Admin invitation links. |
| Automated checks | Jest and Supertest | Exercise the backend routes, rules and failure cases. |
| Work tracking | Jira and GitHub | Keep the build trail, code history and release evidence. |

I stayed with plain HTML, CSS and JavaScript because the project needed understandable rota screens and connected workflows more than it needed another framework. The drawback is that the frontend modules and event handling have to be organised by hand.

## Current verified release

The submission snapshot is tagged `v1.0.0-submission` at commit `f0d361d6f1e5a5f1fbc7938ce1d97c517186fac0`. The application deployed on Render is commit `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`. The later submission commits add documentation and evidence; a tree comparison confirmed that they do not change the deployed application directories.

The final local gate passed:

- all PostgreSQL migrations from `001` through `027`;
- 30 test suites and 243 tests;
- the project's four coverage thresholds;
- ESLint;
- the production dependency audit; and
- the tracked-file and Git-history secret review.

The browser checks include desktop, tablet, mobile and a real 200% Chrome zoom. The hosted release SHA, database connection, sign-in page, security headers, cookie attributes and static files were also checked. Some final hosted Admin/passkey repetitions and hosted log checks could not be repeated after the browser connector blocked the Render domains. I left those items open in the release record instead of treating local tests as hosted proof.

The detailed results are in [final_verification_record.md](docs/release/final_verification_record.md), [final_release_checklist.md](docs/release/final_release_checklist.md) and [known_limitations.md](docs/release/known_limitations.md).

## Running Smart Schedule locally

You need Node.js, npm and a local PostgreSQL database. From the repository root:

```powershell
Copy-Item .env.example backend/.env
Set-Location backend
npm install
npm run db:migrate
npm start
```

The copied environment file contains placeholders. Before starting the application, set the local PostgreSQL connection, a long random session secret and the password-pepper version with its matching value. Email and first-Admin setup need their own values only when those workflows are being used. Keep `backend/.env` outside Git and do not print its contents.

The separate [local evidence workflow](docs/testing/local_evidence_workflow.md) explains how to create repeatable demo data without resetting the hosted Neon database.

## Running the checks

From `backend/`:

```powershell
npm run lint
npm run db:migrate:status
npm test
npm run test:coverage
npm audit --omit=dev
npm run security:repo-review
```

The full test database needs migrations through `027_allow_overnight_shifts.sql`.

## Honest limits

Smart Schedule does not include payroll, accounting, POS integration, sales forecasting, billing, multi-branch management or a native Android/iOS app. It also does not claim to publish a rota without a Manager checking it. NodyChat has no user-facing retention or deletion workflow, Render can have free-tier cold starts, and email delivery depends on Brevo.

Those limits are not unfinished menu items hidden from the README. They are choices about what this small hospitality application is meant to do. The full technical and evidence limits are recorded in [known_limitations.md](docs/release/known_limitations.md).

## Repository guide

- `backend/` contains the Express application, rules, database access and automated tests.
- `frontend/` contains the pages, browser-side services and responsive styling.
- `database/migrations/` contains the real ordered database history.
- `docs/` contains planning, design, requirements, testing and release records.
- `assets/screenshots/` contains the numbered evidence used by the report.
- `scripts/` contains the local test menu and supporting checks.

For someone reading the project without much technical knowledge, start with this README and [project_scope.md](docs/planning/project_scope.md). The API, database and security files are there when the implementation detail is needed.
