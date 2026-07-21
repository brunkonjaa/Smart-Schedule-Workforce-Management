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

## Hosted checks

- [x] Render `/health` returned `status=ok` and `database=connected`.
- [x] Render served the deployed WebSocket CSP origin and `smart-schedule-static-v12` in screenshot `181`.
- [x] Hosted authenticated session returned `Secure`, `HttpOnly` and `SameSite=Lax` with the value omitted in screenshot `185`.
- [x] Neon production monitoring and database-size evidence exists in screenshots `157` and `158`.
- [x] Render free-tier cold starts remain documented instead of treated as an application failure.

## Main workflows and presentation

- [x] Admin, Manager and Staff boundaries have automated tests.
- [x] Staff, leave, shifts, assignments, rota, swaps, password, Employee Summary, Audit Log and NodyChat are mapped in the traceability matrix.
- [x] Populate next week has a named automated contract test and remains described as rule-based draft generation.
- [x] Mobile evidence includes staff pages, Employee Summary and the Admin workspace.
- [x] Accessibility evidence includes the authenticated manager check and the post-fix hosted login result.
- [x] README describes the deployed Admin/security state and the current 29-suite verification result.
- [x] Screenshot index was checked without renumbering old evidence.

## Release identification

- [ ] Phase 4 pull request merged.
- [ ] Final merge SHA recorded after the merge exists.
- [ ] Live service rechecked after the final merge where a backend deployment is triggered.
- [ ] Release tag created and pushed.

The tag should not be created just to make this checklist look complete. It comes last, after the final SHA and hosted state have both been checked.
