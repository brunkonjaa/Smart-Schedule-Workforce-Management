# Phase 3 security and repository evidence

## Result

I completed the Phase 3 review on `chore/phase-3-security-review`. The final automated result is 28 Jest suites and 232 tests passing. Coverage finished at 77.26% statements, 62.56% branches, 86.34% functions and 78.24% lines. ESLint also returned with no errors or warnings.

This phase changed security configuration and tests, but it did not upgrade the main application dependencies. Pull request `#1` ran the backend workflow against commit `f97d9a5` and every step passed. The branch was then merged as `38f8b4b`, and Render served the new build at 19:03:05 GMT on 21 July 2026. This order matters because screenshot `180` is the PR check, while screenshots `181` and `185` were taken only after the hosted response changed.

## Request and browser security

Helmet is now configured through `backend/src/config/http-security.js`. The policy keeps scripts, styles, forms, images and frames on the sources already used by Smart Schedule. It does not use `*` or `unsafe-inline`. `connect-src` contains `'self'` and the exact WebSocket origin derived from `APP_BASE_URL`. For the current Render URL, that is `wss://smart-schedule-workforce-management.onrender.com`.

The hosted header capture in screenshot `181` proves the deployed page returns the exact `wss://smart-schedule-workforce-management.onrender.com` connection source, `SAMEORIGIN`, `nosniff`, `no-referrer` and the two-year HSTS policy. The same capture also shows `smart-schedule-static-v12`, the connected database health result and the new deployment timestamp.

Production proxy trust is one hop. Production session cookies resolve to `Secure=true`, `HttpOnly=true` and `SameSite=lax`. Screenshot `182` records the local production configuration without showing a cookie value. Screenshot `185` repeats this against Render using the documented fake Aoife O'Sullivan staff seed account. Login and `/me` both returned `200`, the live `Set-Cookie` response contained `Secure`, `HttpOnly` and `SameSite=Lax`, and the value was deliberately omitted. The temporary session was logged out immediately and returned `204`.

The 32 KB JSON and 10 KB form limits now have oversized-request tests. Both return the same generic `413` response. Malformed JSON returns a generic `400` response. The central `500` response does not return stack traces, SQL, local paths, database hostnames or environment-variable names, while the server log still keeps the request method, path, error message, code and stack.

## Mutation protection and rate limits

Login now requires `X-Smart-Schedule-CSRF`, which closes the only state-changing route that did not use the mutation middleware. The Phase 3 test reads every route file and checks each declared `POST`, `PUT`, `PATCH` and `DELETE` route before Jest continues. This includes Admin, staff, shifts, assignments, leave, swaps, NodyChat, password reset, password change, passkeys and logout.

The rate-limit groups are separate because sharing one counter caused failed passkey checks to consume the normal login allowance during the first full test run. The final limits are:

- normal login, first-account bootstrap and Admin invitation acceptance: five failed attempts in 15 minutes;
- passkey verification: ten failed attempts in 15 minutes;
- password reset requests: five requests in 15 minutes, including the generic successful `202` response;
- password reset confirmation, password change and Admin reauthentication: five failed password checks in 15 minutes;
- general API traffic: 300 requests in 15 minutes;
- health checks: 30 requests per minute.

## SQL and output review

I searched query calls and template substitutions across `backend/src/services`, `backend/src/routes` and `backend/src/database`. User values still go through PostgreSQL placeholders. The dynamic SQL that remains is limited to fixed fragments built by the program:

- numbered placeholders and fixed filter conditions in staff, shift and leave lists;
- a fixed `schema_migrations` table name in the migration runner;
- boolean `FOR UPDATE` fragments used by transaction helpers;
- fixed role and status conditions;
- hard-coded `ORDER BY` clauses.

There is no request-controlled column name or sort direction. The frontend service files do not assign user data through `innerHTML`, `outerHTML` or `insertAdjacentHTML`. Names, chat messages, leave reasons, swap reasons and server error details are inserted through `textContent` or the `createElement` helper's `text` option. The only new-tab external link is the fixed HTTPS Google Maps directions link, and it uses `rel="noopener noreferrer"`. Email HTML already escapes the recipient name and generated URL.

## Secrets and repository files

`npm run security:repo-review` scans the current tracked files and Git patch history for high-confidence database credential URLs, GitHub tokens, Brevo keys and private-key blocks. It prints the rule, file and commit only, never the matched value. No high-confidence secret remained after review.

Six database URLs were reviewed as non-secret fixtures: `.env.example`, the GitHub Actions PostgreSQL service, `backend/local-evidence.env.example`, `db-config.test.js` and the two tracked test-menu scripts. The scanner excludes that database pattern only for those named files. The same pattern in another file still fails the command.

The largest tracked file is `assets/images/cyber_security.png` at 24,358,593 bytes. It is intentional because `main.css` uses it as an Admin/security background, although keeping a 23 MB PNG is a deployment-size drawback. The next largest files are report diagrams, the second background image and workflow evidence screenshots. I found no tracked video, Playwright trace archive or browser test-results directory to remove.

`.gitignore` now also excludes local SQLite/database files, logs, `tmp` and `temp`, Playwright reports, test results, trace archives, editor folders and Windows shortcuts. Existing unrelated local files were left alone.

GitHub secret scanning and push protection were already enabled. I enabled Dependabot alerts and automatic security updates. Screenshot `183` shows the resulting repository security settings and the `204` response from the vulnerability-alert check.

## PWA review

The earlier service worker cached every successful same-origin GET outside `/api`, which also allowed `/health` and other non-static responses into the cache. It also fell back to the cached app shell, so an offline user could see the shell instead of a clear explanation.

The new `smart-schedule-static-v12` cache accepts only `/src/`, `/icons/`, `/assets/images/`, the manifest and `offline.html`. Navigation uses the network and falls back to `offline.html`. API responses, `/health` and NodyChat data are not cache candidates. Activating version 12 deletes older cache names, and static JavaScript and CSS use network-first requests so a deployment can replace the previous files.

## Ireland time strategy and DST

Shift dates are stored as PostgreSQL `DATE` values and shift start/end values are stored as `TIME` without a timezone. In this project they mean Ireland-local wall-clock values, not UTC timestamps. JavaScript uses `T00:00:00Z` only for date arithmetic so the `YYYY-MM-DD` value does not move when the computer timezone changes.

The tests cover Monday boundaries around 29 March 2026 and 25 October 2026. They also prove that Europe/Dublin skips from 00:30 to 02:30 in spring and repeats 01:30 in autumn. Shift totals remain wall-clock totals: 01:00 to 03:00 counts as two rostered hours on either transition day, and 22:00 to 02:00 counts as four hours.

This is an accepted limitation. The schema cannot represent which occurrence of an autumn 01:30 was meant, and it does not calculate actual elapsed hours through a DST change. Replacing `DATE` plus `TIME` with timezone-aware shift instants would need a separate migration and UI decision, so I documented it instead of quietly changing payroll-style hour meaning during the security phase.

## Evidence files

- `180_github-actions-phase-1-to-3-checks-passed.png`: PR-triggered backend workflow for pull request `#1`, commit `f97d9a5` and run `29859249959`.
- `181_hosted-phase-3-security-headers.png`: deployed Render CSP, security headers, service-worker cache version and health response, with no credentials.
- `182_terminal-phase-3-cookie-and-http-security.png`: production cookie attributes with the value omitted and six focused HTTP security tests.
- `183_terminal-phase-3-github-security-settings.png`: secret scanning, push protection, Dependabot security updates and vulnerability alerts.
- `184_terminal-phase-3-repository-review.png`: clean current/history secret scan summaries and the five largest tracked files.
- `185_hosted-phase-3-authenticated-cookie-attributes.png`: hosted authenticated cookie attributes with the value omitted, followed by the successful session cleanup.
- `backend/src/__tests__/security-configuration.test.js`: headers, CSP, proxy, cookies, request limits, mutation routes and public errors.
- `backend/src/__tests__/pwa-output-security.test.js`: cache boundaries, offline copy, DOM insertion and external-link protection.
- `backend/src/__tests__/timezone-strategy.test.js`: Monday boundaries, both 2026 DST transitions and wall-clock shift totals.
- `npm run security:repo-review`: current checkout, Git history and largest tracked-file result without printing secret values.
