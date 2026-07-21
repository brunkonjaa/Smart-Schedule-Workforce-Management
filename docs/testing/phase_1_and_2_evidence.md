# Phase 1 and Phase 2 verification evidence

This record explains why the tooling cleanup and regression-test work were captured together. It preserves the exact result from that checkpoint; the larger final 30-suite result is recorded in the later release files.

## Combined result

I kept the Phase 1 tooling cleanup and the Phase 2 regression work as one checkpoint. The Phase 2 tests were already in the working tree before the final Phase 1 screenshots were taken, so trying to recreate the older 144-test result would no longer show the actual project state.

I finished this phase with 25 Jest suites and 219 tests passing. Branch coverage is 62.18%, which is inside the 62% to 68% range set in `phase_2.md`. I did not remove production files from coverage to reach this number.

The final coverage result was:

| Measure | Result |
| --- | ---: |
| Statements | 77.04% (2564/3328) |
| Branches | 62.18% (1250/2010) |
| Functions | 86.15% (442/513) |
| Lines | 78.03% (2522/3232) |

`npm run lint` also passed with no ESLint errors. `npm audit --omit=dev` reported zero known production vulnerabilities. The local Argon2id benchmark used 19,456 KiB memory, time cost 2, parallelism 1 and four concurrent operations. The final captured run measured 61.3 ms for the hash batch, 64.4 ms for the verify batch and a 77 MiB peak RSS increase. These timings are local measurements and can move slightly on another run.

## Screenshots

- `177_terminal-phase-1-and-2-lint-clean.png` shows the branch, exact lint command and clean returned prompt.
- `178_terminal-phase-1-and-2-tests-and-coverage.png` shows 25 passing suites, 219 passing tests and the final coverage totals.
- `179_terminal-phase-1-and-2-audit-and-argon2id.png` shows the exact audit and benchmark commands, zero known production vulnerabilities and the final local Argon2id result.

## Main tests added

The new test names are grouped below because several of them are table tests with more than one case.

### Admin, passkeys and sessions

- `two simultaneous attempts can consume one Admin invitation only once`
- `simultaneous Admin disables leave one active non-review Admin`
- `Admin session reset rolls back if its required security event cannot be written`
- `passkey challenges cannot be used from a different session`
- `expired passkey challenges fail before credential verification`
- `a failed passkey attempt consumes its challenge so it cannot be reused`
- `incorrect origin is rejected by registration verification`
- `incorrect RP ID is rejected by registration verification`
- `invalid registration signatures do not create a credential`
- `revoked or unknown credentials are rejected before signature verification`
- `invalid authentication signatures do not update the passkey counter`
- `successful authentication stores the verifier counter`
- `invalidates an Admin session after its absolute expiry`
- `Admin idle and absolute limits use the shorter Admin policy`
- `remember me never extends an Admin session`
- `remember me extends Manager idle and absolute lifetimes`

### Passwords and reset tokens

- `pepper v1 hashes verify and successful login rotates them to v2`
- `removing the previous pepper produces a controlled verification failure`
- `database failure after bcrypt verification rolls back without corrupting the hash`
- `known, unknown and inactive accounts receive the same public reset response`
- `two simultaneous attempts can consume the same reset token only once`
- `changing a password invalidates every outstanding reset token`
- `an account-security session reset invalidates outstanding reset tokens`
- breach-service non-match, malformed count, HTTP failure and timeout/unavailable cases
- missing, short and overlong password validation cases

### Assignments, leave and limits

- `a failure after assignment insert rolls back the assignment and its audit row`
- `near-simultaneous overlapping assignments allow one request only`
- `39 hours 59 minutes follows the hard weekly limit`
- `exactly 40 hours follows the hard weekly limit`
- `40 hours 1 minute follows the hard weekly limit`
- `an overnight Sunday shift stays in its starting week and checks Monday leave and overlap`
- `pending, rejected, withdrawn and approved leave have distinct assignment outcomes`

The existing five-shift/sixth-shift case and the touching 18:00 rule still pass. Migration `027_allow_overnight_shifts.sql` was added because the earlier database check rejected every overnight hospitality shift. An end time earlier than the start now means the next day. A shift with the same start and end is still rejected. For weekly totals, the whole overnight shift belongs to the week where it started.

### NodyChat and swaps

- invalid JSON, missing type, unsupported type and empty WebSocket message cases
- binary frame rejection and WebSocket payload code 1009
- HTTP JSON body limit returning 413
- script-like message text remaining unchanged as message text
- socket closure after logout, account deactivation, session revocation, idle expiry, absolute expiry and password reset
- inactive and wrong-role swap targets
- duplicate and withdrawn swap requests
- two employees accepting the same open swap
- acceptance blocked by approved leave, overlap and the five-shift limit
- manager approval rechecking role, shift status, leave, overlap, weekly limit and original assignment ownership
- manager approval rolling back both swap and assignment state when the required assignment audit insert fails

### Employee Summary and Audit Log

- empty, exactly 25 and 26-record pagination cases
- first, middle, final and beyond-final route pages
- stable ordering by `created_at DESC, id DESC` when timestamps match
- no normal update or delete route for Audit Log rows
- the Employee Summary response field allow-list still proves password, reset-token, passkey, session and private-chat data are not returned

## Race and rollback evidence

The concurrency tests use real PostgreSQL transactions, not delayed mock promises.

- One of two Admin invitation consumers succeeds. The second sees the used invitation.
- Two disable operations cannot remove the final active non-review Admin. One commits and one returns `FINAL_ADMIN_REQUIRED`.
- One of two overlapping assignment requests commits. The other gets a conflict, and only one assignment row exists afterward.
- One of two reset-token consumers succeeds. The second gets the invalid/used response.
- One of two employees can accept an open swap. The stored swap has one `accepted_by_staff_profile_id`.
- A forced Audit Log insert failure leaves no assignment row behind.
- A forced Admin security-event insert failure leaves the target `session_version` unchanged.
- A forced password-upgrade database failure leaves the original bcrypt hash and scheme unchanged.
- A forced swap approval audit failure leaves the assignment with the requester and the swap in `ACCEPTED` state.

## Important branches still uncovered

The main gaps left are narrow paths that need different infrastructure or are lower risk than the Phase 2 cases:

- real Brevo delivery success/failure calls are not sent from Jest;
- a physical browser passkey ceremony is not reproduced in the backend suite, although origin, RP ID, signature, challenge and revoked-credential outcomes are covered around the verifier;
- some first-manager/first-Admin bootstrap validation branches are still uncovered;
- some WebSocket heartbeat, history-load failure and socket transport-error branches are still uncovered;
- several invalid-field combinations in Admin, staff, shift and leave routes are still uncovered;
- migration-runner failure and rollback-failure branches are still uncovered.

These are why I stopped at 62.18% instead of trying to push the number higher with less useful tests.
