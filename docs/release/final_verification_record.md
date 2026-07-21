# Final verification record

## Verification point

- Date: 21 July 2026
- Phase: Phase 5 final commit, CI and deployment
- Repository baseline checked: `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`
- Working branch: `agent/phase-5-deployment-evidence`
- Verified deployed application merge: `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`
- Final Phase 4 merge SHA: `093a12044fe452fe5120d34feef73c9a26467895`
- Release tag: pending

Pull request `#3` merged Phase 4 as `093a120`. This merge added the Populate-next-week contract test inside `backend/`, so it triggered a new Render build. The hosted root changed from the earlier `19:03:05 GMT` build to `Tue, 21 Jul 2026 19:45:35 GMT`. I then checked the CSP, service worker and database health again instead of assuming that a green GitHub workflow meant the hosted service had changed.

Pull request `#5` merged the Phase 5 checkpoint as `14e66cf`. GitHub Actions run `29864800275` passed that merge, then Render returned the same full SHA through `/health.releaseCommit`. The root timestamp changed again to `Tue, 21 Jul 2026 20:16:18 GMT`. This closes the earlier gap where I could prove a new Render timestamp but not the exact source revision.

## Environments checked

| Environment | Detail | Result |
|---|---|---|
| Local | Windows PowerShell, Node.js `v24.13.0`, npm `11.11.0`, configured PostgreSQL test/evidence database | Phase 4 commands passed |
| GitHub Actions | Ubuntu runner, Node.js 22 and PostgreSQL 16 from `.github/workflows/backend-checks.yml` | Phase 4 PR runs `29862074201` and `29862399910`, then merged `main` run `29862501251`, passed |
| Hosted application | Render free web service | Merge `093a120` served at `Tue, 21 Jul 2026 19:45:35 GMT`; health connected, CSP and service worker verified |
| Hosted database | Neon PostgreSQL | Application health reports connected; screenshots `157` and `158` record the production monitoring check |
| Phase 5 hosted checkpoint | Render and Neon | Merge `14e66cf` matched `/health.releaseCommit`; Neon reported migrations `001`–`027` applied |

## Commands and results

All npm commands were run from `backend/`.

| Command | Result |
|---|---|
| `npm run lint` | Passed with no ESLint errors or warnings |
| `npm run db:migrate:status` | Migrations `001` through `027` reported `APPLIED` |
| `npm run test:coverage` | 29 suites and 236 tests passed |
| `npm audit --omit=dev` | Zero known production dependency vulnerabilities |
| `npm run security:repo-review` | No high-confidence secret found in tracked files or Git patch history |
| `gh run view 29860448346` | Baseline `main` workflow passed migrations, coverage, password benchmark and production audit |
| `gh run view 29862074201` | Phase 4 PR workflow passed 29 suites, 236 tests, migrations, password benchmark and production audit |
| `gh run view 29862399910` | Phase 4 PR workflow passed again after the CI evidence commit |
| `gh run view 29862501251` | Merged Phase 4 `main` workflow passed |
| `gh run view 29864595561` | Exact Phase 5 source commit `a0303bc` passed in 66 seconds and uploaded `backend-coverage` |
| `gh run view 29864800275` | Merged application commit `14e66cf` passed in 71 seconds and uploaded `backend-coverage` |
| Hosted header, service-worker and health requests | Exact Render WebSocket CSP origin, `smart-schedule-static-v12` and connected database health returned |
| Hosted fake staff login, `/me` and logout | `200`, `200` and `204`; cookie value omitted |

## Coverage

The Phase 4 local run finished at:

- statements: 77.26% (`2600/3365`);
- branches: 62.56% (`1272/2033`);
- functions: 86.34% (`449/520`);
- lines: 78.24% (`2557/3268`).

The Phase 5 release gate added the release-identity tests and finished at 77.43% statements (`2612/3373`), 62.65% branches (`1277/2038`), 86.75% functions (`452/521`) and 78.41% lines (`2569/3276`). All 30 suites and 243 tests passed.

The global thresholds in `backend/jest.config.js` are 70% statements, 55% branches, 80% functions and 70% lines. The run passed those thresholds. This does not mean every file has strong coverage. `backend/src/database/migrations.js` is still collected at zero, and the larger auth, Admin, leave and swap route branches have remaining paths listed in the coverage output.

## Evidence used

- `176`: earlier 19-suite local checkpoint, kept as an older result;
- `180`: pull-request workflow for the Phase 1 to 3 code merge;
- `181`: deployed Render CSP, service worker and health response;
- `182`: local production cookie configuration and HTTP security tests;
- `183`: repository security settings;
- `184`: repository and Git-history secret review;
- `185`: hosted authenticated cookie attributes with the value omitted;
- `186`: exact Phase 4 local coverage, migration, lint and audit result;
- `187`: exact Phase 4 pull-request workflow and CI totals;
- `188`: hosted Phase 4 merge timestamp, CSP, service-worker version and connected health;
- `189`: Phase 5 empty local database, complete local gate and final coverage;
- `190`: exact Phase 5 source-commit pull-request workflow and artifact;
- `191`: exact merged Render SHA, Neon migration status, login and frontend content check;
- GitHub Actions run `29864800275`: successful merged Phase 5 application run.

No older screenshot was renamed as proof of the new 29-suite Phase 4 run. Screenshot `186` was captured from the exact rerun after the new Populate-next-week test was added.

## Known limits at this point

The current limits are recorded in `docs/release/known_limitations.md`. The main ones are the missing payroll, POS, multi-branch and billing scope, no native app, no autonomous scheduling, Render free-tier cold starts, Brevo dependency and the remaining coverage gaps. `Populate next week` remains assisted draft generation. It copies a weekly pattern and applies fixed eligibility rules, then waits for a manager to approve it.

## Still pending before a release tag

The Phase 5 merge, exact-SHA workflow, Render deployment and Neon status are now verified. The release tag is the only unchecked release-identification item. I have left it pending because no tag name was given.
