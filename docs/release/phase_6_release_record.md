# Phase 6 release record

## Verification point

- Date: 21 July 2026
- Deployed application SHA: `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`
- Evidence-only `main` baseline: `46e12af59455ece3938f8dbb39a663b04079ddab`
- Release tag: `v1.0.0-submission` on the final pull request `#7` merge

Phase 6 checks the final hosted release, but I have kept the source SHA and the later evidence commit separate. Render proved that the running application is merge `14e66cf`. Merge `46e12af` only added evidence files outside the Render `backend/` root, so it did not replace the application build.

## Checks completed again

I ran the final local gate from `backend/` on 21 July 2026.

| Command | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run db:migrate:status` | Migrations `001` through `027` applied in the configured verification database |
| `npm run test:coverage` | 30 suites and 243 tests passed |
| `npm run security:benchmark` | Four hashes took 56.8 ms, four verifies took 61.1 ms and the observed peak RSS increase was 77 MiB |
| `npm audit --omit=dev` | Zero known production vulnerabilities |
| `npm run security:repo-review` | No high-confidence secret in tracked files or Git patch history |

Coverage finished at 77.43% statements, 62.65% branches, 86.75% functions and 78.41% lines. Screenshot `192` records the narrow result without an email address, password, token, cookie value or pepper value.

GitHub Actions run `29864800275` is still the exact workflow for deployed merge `14e66cf`. It passed 30 suites and 243 tests, measured the same Argon2id parameters at 19,456 KiB, time cost 2 and parallelism 1, and returned zero production dependency vulnerabilities.

Draft pull request `#7` then ran the same workflow against Phase 6 source commit `b5a6206f7e1d190231f48f6dab03c1ef5a24188b`. Run `29867189927` passed in one minute and uploaded the coverage artifact. Screenshot `193` records the pull request, commit, workflow result and the deliberate no-tag decision.

## Hosted evidence already tied to the SHA

Screenshot `191` records `/health.releaseCommit` matching the full `14e66cf` merge, Neon migrations `001` through `027`, the public sign-in page and all 21 JavaScript/CSS responses matching the same source.

This existing evidence is kept because it belongs to the same deployed SHA. I have not relabelled it as a fresh Phase 6 browser run, and it does not prove the final Admin/passkey state by itself.

Earlier on 21 July I used the Render environment page while guiding the final setup. I confirmed `PASSWORD_PEPPER_CURRENT_VERSION` and its matching versioned pepper variable existed without opening or recording their values. After the permanent Admin setup, I removed `FIRST_ADMIN_BOOTSTRAP_TOKEN`. Those two configuration steps were already complete before the later Chrome connector block.

## Checks not completed from this environment

The Chrome connector rejected both the hosted Render application and the Render dashboard because of its enforced network policy. I did not try another browser-control route or inspect saved browser credentials. Because of that block, these Phase 6 items are still open:

1. repeat the hosted invitation, expiry, one-use, enable/disable, session revoke and passkey revoke checks;
2. repeat the final non-review Admin protection, logout/Back, idle expiry and absolute expiry checks;
3. create a controlled hosted bcrypt row, prove correct-login upgrade, then prove a wrong password does not upgrade it;
4. review the hosted logs for accidental password, pepper, reset token, invitation token or cookie output;
5. repeat the complete Manager, Staff, Admin, rota, leave, shift, assignment, Populate next week, swap, Employee Summary, Audit Log, NodyChat, responsive, 200% zoom, keyboard and PWA smoke matrix.

The missing-pepper production refusal, bcrypt upgrade, wrong-password non-upgrade, invitation expiry/reuse, reviewer exception, final-Admin rule, session/passkey revocation and Admin session policies all pass in the automated suites. That is useful implementation evidence, but I am not using a local test to claim that Render configuration or a hosted workflow passed.

## Hosted Argon2id limit

The current Render free service does not provide safe shell or one-off job access; screenshot `117` records that limitation. I did not add a public benchmark endpoint. The local result and exact deployed-commit GitHub Actions measurement remain the available evidence, so hosted process-memory behaviour is not measured.

## Release decision

The GitHub release is complete with the fresh hosted reruns above recorded as limitations, not passes. The exact deployed application SHA is known, the local/CI checks pass, the pepper variable-name check is complete and the bootstrap variable is removed. A tree comparison confirms pull request `#7` changes only README, release documentation and screenshot evidence after `14e66cf`; the application directories are identical to that deployed source. The final pull request merge is therefore the full submission snapshot protected by `v1.0.0-submission`.
