# Known limitations

These are current Smart Schedule limits, not future features being presented as finished work.

## Out of scope

1. There is no payroll calculation or payroll export.
2. There is no POS integration, so sales or demand data does not create staffing requirements.
3. There is no multi-branch or multi-property model. The current rota belongs to one hospitality workplace.
4. There is no billing, subscription or payment workflow.
5. There is no native Android or iOS app. The frontend is an installable web app where the browser supports it.

## Scheduling limit

`Populate next week` is not AI scheduling and it is not autonomous. `frontend/src/services/rota-ui.js` moves the current shift pattern forward by seven days, applies fixed role, leave, conflict, five-shift and forty-hour rules, and suggests the least-loaded eligible person. It can leave a shift open. Nothing is saved until the manager presses approval, and the manager is still responsible for the final rota.

The function uses the current week as its source. It does not forecast trade, learn from sales, calculate preferred shift patterns or decide whether the copied demand is sensible for the next week.

## Hosting and providers

Render is on the free service tier. It can spin down, so the first request after inactivity can be slow. That is a hosting limit and not proof that the health route or database failed.

Password reset and Admin invitation delivery depend on Brevo. A provider outage or rejected message can stop the email even when Smart Schedule creates the request correctly. The backend returns a controlled failure, but it does not have a second email provider.

The hosted database depends on Neon. Recovery is limited by the branch, restore and retention options available to the current Neon plan. A recovery point still needs to be checked before a risky migration.

## Time and hours

Shift dates and times are Ireland-local wall-clock values stored as PostgreSQL `DATE` and `TIME`. The current schema cannot distinguish the repeated autumn `01:30`, and roster totals do not calculate true elapsed time through a daylight-saving transition. `timezone-strategy.test.js` records that accepted behavior.

## Test coverage

The Phase 4 run passed 29 suites and 236 tests at 77.26% statements, 62.56% branches, 86.34% functions and 78.24% lines. Those totals pass the project thresholds, but coverage is not complete.

The main remaining gaps are:

- the migration runner is collected at zero even though migration status and the CI migration step are run;
- several error and passkey branches in `backend/src/routes/auth.js` are not reached;
- Admin, leave, shift and swap route error branches are only partly covered;
- Populate next week has an automated source contract and hosted workflow evidence, but not a full repeatable browser test in Jest;
- responsive layout, real WebAuthn prompts, Lighthouse and provider dashboards still use named manual evidence.

These limits are kept visible because a passing test total does not prove every browser, provider response or recovery path.
