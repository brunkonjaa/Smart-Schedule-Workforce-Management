# Known limitations

These are current Smart Schedule limits, not future features being presented as finished work. Some are technical limits and some are deliberate scope choices. The application stays small because it is aimed at the everyday staffing work of one hospitality workplace, not every back-office job a larger company might have.

## Out of scope

1. There is no payroll calculation or payroll export.
2. There is no POS integration, so sales or demand data does not create staffing requirements.
3. There is no multi-branch or multi-property model. The current rota belongs to one hospitality workplace.
4. There is no billing, subscription or payment workflow.
5. There is no native Android or iOS app. The frontend is an installable web app where the browser supports it.
6. There is no full HR or accounting section. Staff records contain only the information needed by the rota and the protected Employee Summary.

## Scheduling limit

`Populate next week` is not AI scheduling and it is not autonomous. `frontend/src/services/rota-ui.js` moves the current shift pattern forward by seven days, applies fixed role, leave, conflict, five-shift and forty-hour rules, and suggests the least-loaded eligible person. It can leave a shift open. Nothing is saved until the manager presses approval, and the manager is still responsible for the final rota.

The function uses the current week as its source. It does not forecast trade, learn from sales, calculate preferred shift patterns or decide whether the copied demand is sensible for the next week.

## Hosting and providers

Render is on the free service tier. It can spin down, so the first request after inactivity can be slow. That is a hosting limit and not proof that the health route or database failed.

Password reset and Admin invitation delivery depend on Brevo. A provider outage or rejected message can stop the email even when Smart Schedule creates the request correctly. The backend returns a controlled failure, but it does not have a second email provider.

The hosted database depends on Neon. Recovery is limited by the branch, restore and retention options available to the current Neon plan. A recovery point still needs to be checked before a risky migration.

The Render free service does not provide safe shell or one-off job access for this project. That means the Argon2id process-memory result can be measured locally and in GitHub Actions, but not inside the hosted Render process without adding a public benchmark route. I did not add one just for evidence.

## Phase 6 hosted verification boundary

The deployed SHA is proven as `14e66cfc8c6ced641558e95808dc51e28fd9bb3e`, and screenshot `191` proves connected Neon migrations, public login and matching static assets. Earlier on 21 July the required pepper variable names were checked without exposing their values and `FIRST_ADMIN_BOOTSTRAP_TOKEN` was removed. The Chrome connector used for the later Phase 6 rerun blocks both the hosted application and the Render dashboard. Because of that, the permanent Admin/passkey evidence, full hosted Admin mutation matrix, bcrypt-upgrade demo, log review and final browser smoke matrix are still open. The automated suites pass those application rules, but they do not prove a fresh hosted interaction.

## Time and hours

Shift dates and times are Ireland-local wall-clock values stored as PostgreSQL `DATE` and `TIME`. The current schema cannot distinguish the repeated autumn `01:30`, and roster totals do not calculate true elapsed time through a daylight-saving transition. `timezone-strategy.test.js` records that accepted behavior.

## Test coverage

The Phase 6 local rerun passed 30 suites and 243 tests at 77.43% statements, 62.65% branches, 86.75% functions and 78.41% lines. Those totals pass the project thresholds, but coverage is not complete.

The main remaining gaps are:

- the migration runner is collected at zero even though migration status and the CI migration step are run;
- several error and passkey branches in `backend/src/routes/auth.js` are not reached;
- Admin, leave, shift and swap route error branches are only partly covered;
- Populate next week has an automated source contract and hosted workflow evidence, but not a full repeatable browser test in Jest;
- responsive layout, real WebAuthn prompts, Lighthouse and provider dashboards still use named manual evidence.

These limits are kept visible because a passing test total does not prove every browser, provider response or recovery path.
