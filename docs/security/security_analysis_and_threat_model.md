# Smart Schedule Security Analysis And Threat Model

## Audit point

This review starts from final report-evidence checkpoint `db2837c854291b8965c3f3e4b3d9b1cc9e018527`, committed on 17 July 2026 at 20:13:17 +01:00, and now includes the local 21 July Admin/password checkpoint. It covers the Express backend, PostgreSQL/session boundary, browser frontend and NodyChat WebSocket. The Admin changes have not been deployed yet. This does not claim a penetration test or an independent security assessment.

The GitHub Actions run for `304a8c62b7c88c1ad2288f822849c87e359ad4cb` found a new low-severity `body-parser` denial-of-service advisory on 21 July 2026. The lockfile had selected `body-parser` 1.20.5 through Express. I updated it to the compatible 1.20.6 fix and also accepted the current patched `brace-expansion` lock entries. The repeated `npm audit --omit=dev --json` result is zero known vulnerabilities across 118 production dependencies. This can change again when package advisories change, so the lockfile check remains in GitHub Actions.

## Assets and trust boundaries

| Asset | Main risk | Boundary and current control |
| --- | --- | --- |
| Passwords and reset/invitation links | credential theft or reuse | versioned backend pepper plus Argon2id; correct legacy bcrypt login upgrades one row; token hashes, expiry and one-use checks; raw values are not returned or logged |
| Admin authority | account takeover or Admin inheriting employee access | separate `ADMIN` role; normal Admin passkey gate; short Admin session; recent password recheck; final-Admin rule; no Manager rota/Employee Summary permission |
| Manager authority | staff/rota changes by a staff account | server-side `requireRole('MANAGER')`; manager passkey option; mutation protection; audit/security records |
| Staff, leave and rota records | another user reading or changing records | session lookup against current database state; staff ownership filters; parameterised SQL and foreign keys |
| Session cookie | session theft or fixation | PostgreSQL session store; regenerated login session; `HttpOnly`, `SameSite=Lax`, production `Secure`; idle and absolute lifetime |
| NodyChat direct messages | outsider read, write or broadcast | participant rows checked for load, send, open and read; WebSocket broadcast uses participant user IDs |
| Application availability | oversized or repeated requests | 32 KB JSON limit; API/login/health rate limits; 16 KB WebSocket frame limit; 350 ms chat send delay |

The browser-to-Render connection is the first boundary. HTTPS carries the session cookie and REST/WebSocket traffic. Express middleware is the second boundary because it converts that cookie into a current active user, role and session version. The service-to-Neon connection is the third boundary; it uses TLS certificate checks and parameterised queries. Brevo is a separate outbound boundary for password-reset and Admin-invitation email. The Have I Been Pwned range API is another outbound boundary; it receives only a five-character SHA-1 prefix, not the password or full hash.

## Threat model

| Threat | Smart Schedule path | Current control | Remaining limit |
| --- | --- | --- | --- |
| Account enumeration | password reset and login | generic reset response and generic login failure | timing and operational email behaviour were not independently measured |
| Session fixation/theft | login cookie | session regeneration; server-side store; secure cookie settings; no password/token storage in localStorage | a stolen active cookie remains usable until expiry or server invalidation |
| CSRF | state-changing REST calls | custom mutation header, same-origin `Origin`/`Referer` check when supplied, `SameSite=Lax` | the header is not a rotating token; this is accepted for the current same-origin browser client |
| Broken role or object access | manager routes, leave ownership, swaps, direct chat | backend role middleware plus service ownership/participant queries | each new route needs its own negative test; hidden buttons alone are not treated as security |
| Admin privilege crossover | Admin account tries Manager rota or employee routes | Admin is not accepted by Manager/Staff middleware; focused `403` tests cover rota, staff, Employee Summary and operational Audit Log | future routes still need an explicit role decision instead of assuming Admin is a super-role |
| Offline password guessing after database loss | copied `users.password_hash` rows | HMAC-SHA-256 with versioned Render-held pepper before Argon2id; 19 MiB/time-2/parallelism-1 parameters; per-hash salt | losing the pepper blocks legitimate verification too; a compromised app plus database still exposes both sides |
| Stored XSS through chat or names | NodyChat and staff data | strict CSP and DOM `textContent` for live chat content (`chat-ui.js:82-105`) | static page templates still use `innerHTML`; their data currently comes from local code, not API responses |
| WebSocket hijacking or stale authority | `/ws/chat` upgrade and existing connection | active session lookup, exact same-origin requirement, and stored-session/account re-check before actions and during heartbeat | the check depends on the PostgreSQL session store being available; idle invalidation is detected on the next heartbeat |
| Oversized/flood traffic | JSON and WebSocket input | 32 KB JSON limit (`app.js:50`), 16 KB WebSocket maximum (`chat-ws.js:47-51`), rate limits and per-socket send delay | limits are process-local; a multi-instance deployment would need a shared limiter |
| Direct-message data leak | conversation bootstrap/send/read/broadcast | participant join in `chat-service.js:52-60`, read join at lines 225-239, broadcast list at `chat-ws.js:159-163` | no user-facing delete, retention or moderation workflow exists |
| SQL injection or invalid relationships | all workflow input | parameterised `pg` calls, exact field validation, foreign keys/checks and serializable assignment operations | database credentials and Neon access controls are deployment concerns outside the repo |
| Secret/configuration failure | production startup | production session and current pepper configuration fail closed; repository/CI use generated or blank placeholders only | Render/Neon/Brevo dashboard permissions and hosted pepper setup are not proven by repository files |

## Verified controls

1. `backend/src/app.js` disables the Express signature, applies Helmet with a restrictive content security policy, sets a two-year HSTS policy with subdomain coverage and the preload directive, and limits request body sizes.
2. `backend/src/config/session.js:8-12` sets the cookie to `HttpOnly`, `SameSite=Lax`, and production `Secure`. Lines 74-80 record the absolute and idle policy in the server-side session.
3. `backend/src/middleware/auth.js:56-75` rejects an expired, missing, inactive-user or inactive-profile session after checking the database.
4. `backend/src/middleware/request-security.js:17-35` requires the project mutation header and rejects a supplied cross-origin `Origin` or `Referer`.
5. `backend/src/services/chat-ws.js` caps frames at 16 KB, requires an `Origin` matching the request host, loads the server session and rejects inactive accounts. It reloads the stored session and active account before each client action and during heartbeat.
6. `backend/src/services/chat-service.js:52-60`, `225-239` and `242-252` enforce direct-conversation membership for load, read and send operations.
7. `frontend/src/services/chat-ui.js:82-105` inserts message and sender data with `textContent`, not HTML parsing. The localStorage values in this frontend are shell page/theme and chat preference values, not passwords, session IDs or reset tokens.
8. `backend/src/services/password-security-service.js` normalizes with NFKC, checks 15-128 characters, uses the HIBP range request, applies the versioned HMAC step and then calls Argon2id.
9. `backend/src/middleware/auth.js` compares the session version with the current user row. Password, role, active-state and passkey changes therefore invalidate older sessions on their next protected request.
10. `backend/src/services/security-event-service.js` removes metadata fields whose names indicate a password, token, pepper, session, cookie, credential, HMAC or hash before JSON is stored.

## Prioritised findings

### SS-SEC-01 - Remediated - WebSocket lifetime authorisation

Earlier evidence: the original socket checked the account before `handleUpgrade` but kept that accepted user snapshot for the lifetime of the connection.

Change: `loadActiveSocketUser` and `reauthorizeSocket` reload the PostgreSQL session, check absolute expiry and reload the active account before a message/open/read action and during heartbeat. Invalid connections close with policy code 1008.

Proof: `chat-ws.test.js` rejects cross-origin and unauthenticated upgrades, accepts an authenticated same-origin connection and proves that an already-connected socket closes after the account is deactivated. The remaining limit is that an idle invalid connection is detected at the next heartbeat rather than immediately at the database write.

### SS-SEC-02 - Low - Rate limits are local to one Node process

Evidence: `backend/src/config/rate-limit.js` uses the default in-memory store. NodyChat also uses `socket.lastMessageAt` in `chat-ws.js:86,137-141`.

Impact: the current single Render process is limited, but counters would not be shared if the deployment scaled to several Node processes. Reconnecting also resets the per-socket chat delay.

Recommended fix: keep the current limits for the single-process submission. If the architecture changes to multiple instances, move API/login counters to a shared store and add a per-user chat limiter.

### SS-SEC-03 - Low / privacy - NodyChat has no retention or deletion workflow

Evidence: migrations `020` to `022` create messages, conversations and read state. There is no delete route or retention job.

Impact: workplace and direct messages remain in PostgreSQL until an operator removes them. The UI warning tells users not to share passwords or customer information, but that is guidance rather than retention control.

Recommended fix: document a retention period and deletion responsibility before using NodyChat with real employee data. This is outside the frozen student MVP and is recorded as a limitation, not silently presented as complete.

No open critical, high or medium-severity issue was demonstrated by this repository review. The remaining recorded findings are the single-process limiter and chat retention/deletion policy. This is not proof that no other issue exists; the work is still a source/dependency/test review rather than an independent penetration test.
