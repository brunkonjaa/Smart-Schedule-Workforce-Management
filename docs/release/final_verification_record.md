# Final verification record

## Verification point

- Date: 21 July 2026
- Phase: Phase 4 documentation, evidence and traceability
- Repository baseline checked: `ca970a6c6ab8fdde93672630dead098f6bf0388c`
- Working branch: `chore/phase-4-documentation`
- Verified deployed application merge: `38f8b4b7ddd0ab440dec3cff3b4cd63664460a6c`
- Final Phase 4 merge SHA: pending until the Phase 4 pull request is merged
- Release tag: pending

I have kept the two SHA values separate on purpose. Commit `38f8b4b` is the application merge that was actually seen on Render through the new CSP, service-worker cache and authenticated cookie checks. Commit `ca970a6` added the post-deployment evidence to `main`. It did not change `backend/`, so it was not relabelled as a new application deployment.

## Environments checked

| Environment | Detail | Result |
|---|---|---|
| Local | Windows PowerShell, Node.js `v24.13.0`, npm `11.11.0`, configured PostgreSQL test/evidence database | Phase 4 commands passed |
| GitHub Actions | Ubuntu runner, Node.js 22 and PostgreSQL 16 from `.github/workflows/backend-checks.yml` | Baseline `main` run `29860448346` passed; Phase 4 PR run is pending |
| Hosted application | Render free web service | Health connected, deployed CSP and service worker verified |
| Hosted database | Neon PostgreSQL | Application health reports connected; screenshots `157` and `158` record the production monitoring check |

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
| Hosted header, service-worker and health requests | Exact Render WebSocket CSP origin, `smart-schedule-static-v12` and connected database health returned |
| Hosted fake staff login, `/me` and logout | `200`, `200` and `204`; cookie value omitted |

## Coverage

The Phase 4 local run finished at:

- statements: 77.26% (`2600/3365`);
- branches: 62.56% (`1272/2033`);
- functions: 86.34% (`449/520`);
- lines: 78.24% (`2557/3268`).

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
- GitHub Actions run `29860448346`: successful baseline `main` run after evidence merge.

No older screenshot was renamed as proof of the new 29-suite Phase 4 run. Screenshot `186` was captured from the exact rerun after the new Populate-next-week test was added.

## Known limits at this point

The current limits are recorded in `docs/release/known_limitations.md`. The main ones are the missing payroll, POS, multi-branch and billing scope, no native app, no autonomous scheduling, Render free-tier cold starts, Brevo dependency and the remaining coverage gaps. `Populate next week` remains assisted draft generation. It copies a weekly pattern and applies fixed eligibility rules, then waits for a manager to approve it.

## Still pending before a release tag

1. Push the Phase 4 branch and let its pull-request workflow finish.
2. Merge only after that workflow passes.
3. Record the Phase 4 merge SHA here or in a follow-up release record.
4. Confirm the live service still returns health, CSP and the expected service-worker version.
5. Create the release tag only after those checks, not before them.
