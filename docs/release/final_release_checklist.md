# Final release checklist

This is the last checklist before a Smart Schedule release tag. A checked item means there is a command, file, workflow run or screenshot behind it. Items that depend on the Phase 4 pull request stay unchecked until that event happens.

## Repository and database

- [x] Repository status reviewed after the Phase 4 commit. Unrelated local report scripts and screenshots remained outside the commit.
- [x] Tracked files and Git patch history passed `npm run security:repo-review`.
- [x] No high-confidence secret was printed by the review.
- [x] `npm run db:migrate:status` reports migrations `001` through `027` applied in the configured verification database.
- [x] Migration `027_allow_overnight_shifts.sql` is included in the ordered chain.
- [ ] Neon recovery branch or restore point confirmed immediately before any future production migration.

## Automated checks

- [x] `npm run lint` passed.
- [x] `npm run test:coverage` passed with 29 suites and 236 tests.
- [x] Coverage passed the thresholds in `backend/jest.config.js`.
- [x] `npm audit --omit=dev` returned zero known production vulnerabilities.
- [x] Baseline `main` GitHub Actions run `29860448346` passed.
- [x] Phase 4 pull-request GitHub Actions run `29862074201` passed with 29 suites and 236 tests.
- [x] Phase 4 merged `main` GitHub Actions run `29862501251` passed.
- [x] Phase 5 source commit `a0303bc` passed pull-request run `29864595561`.
- [x] Phase 5 merge `14e66cf` passed `main` run `29864800275`.
- [x] Both Phase 5 workflows uploaded the `backend-coverage` artifact.

## Hosted checks

- [x] Render `/health` returned `status=ok` and `database=connected`.
- [x] Render served the deployed WebSocket CSP origin and `smart-schedule-static-v12` in screenshot `181`.
- [x] Hosted authenticated session returned `Secure`, `HttpOnly` and `SameSite=Lax` with the value omitted in screenshot `185`.
- [x] Neon production monitoring and database-size evidence exists in screenshots `157` and `158`.
- [x] Render free-tier cold starts remain documented instead of treated as an application failure.
- [x] Render served the Phase 4 merge with a new `Tue, 21 Jul 2026 19:45:35 GMT` timestamp in screenshot `188`.
- [x] Render `/health.releaseCommit` exactly matched Phase 5 merge `14e66cf` in screenshot `191`.
- [x] Neon reported migrations `001` through `027` applied, with nothing pending.
- [x] A fresh Edge context loaded the hosted sign-in form with zero page errors.
- [x] All 21 hosted JavaScript and CSS responses matched merge `14e66cf`.

## Main workflows and presentation

- [x] Admin, Manager and Staff boundaries have automated tests.
- [x] Staff, leave, shifts, assignments, rota, swaps, password, Employee Summary, Audit Log and NodyChat are mapped in the traceability matrix.
- [x] Populate next week has a named automated contract test and remains described as rule-based draft generation.
- [x] Mobile evidence includes staff pages, Employee Summary and the Admin workspace.
- [x] Accessibility evidence includes the authenticated manager check and the post-fix hosted login result.
- [x] README describes the deployed Admin/security state and the current 29-suite verification result.
- [x] Screenshot index was checked without renumbering old evidence.

## Release identification

- [x] Phase 4 pull request merged as `093a12044fe452fe5120d34feef73c9a26467895`.
- [x] Final merge SHA recorded after the merge exists.
- [x] Live service rechecked after the backend-triggered Render deployment.
- [x] Phase 5 exact source checkpoint passed locally, in GitHub Actions and on Render with connected Neon health.
- [ ] Release tag created and pushed.

The tag should not be created just to make this checklist look complete. It comes last, after the final SHA and hosted state have both been checked.
