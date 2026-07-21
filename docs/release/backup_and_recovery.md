# Backup and recovery note

## Before a database change

First check the current Neon plan and its history-retention window. Create a Neon branch or a restore point from production before applying a migration that changes or removes data. The branch needs a clear name with the date and migration number, for example `before-027-2026-07-21`. Then connect to that branch and check at least the `users`, `staff_profiles`, `shifts`, `shift_assignments` and `schema_migrations` tables before treating it as recovery evidence.

Neon supports branches and point-in-time recovery within the project retention window. The exact retention and snapshot options depend on the current plan, so they must be checked in the Neon console instead of copied from an old note. The current product references are [Neon branching](https://neon.com/docs/guides/branching-intro) and [Neon Backup and Restore update](https://neon.com/docs/changelog/2025-10-31).

## Migration failure

`backend/src/database/migrations.js` runs each migration inside its own `BEGIN`, `COMMIT` and `ROLLBACK`. If migration `027` fails, its SQL and `schema_migrations` insert roll back together. Stop the deployment, keep the error text, check `npm run db:migrate:status`, and fix the failing migration in a new commit. Do not manually mark it as applied.

If an earlier migration committed and a later migration failed, do not assume the whole run rolled back. Each file is its own transaction. Check the applied list and test the next step against a Neon branch before retrying production.

## Accidental deletion

1. Stop writes if continuing would remove more data.
2. Record the approximate deletion time, affected table and user action.
3. Use Neon Time Travel or a point-in-time branch inside the available retention window to inspect the state before deletion.
4. Restore only after the rows and relationships have been checked. For a small deletion, copy the confirmed rows back through a reviewed SQL transaction. For a wider loss, use the Neon restore process.
5. Check the app health, affected rota week, Employee Summary and Audit Log afterward.

## Secret rotation

If a database URL, session secret, password pepper, Brevo key, Render deploy hook or GitHub token is exposed, revoke or rotate it at the provider first. Update the hosted environment without printing the value. Redeploy, invalidate affected sessions where needed, and run `npm run security:repo-review` again. Removing the text from the latest file is not enough if the secret still works or remains in Git history.

Pepper rotation needs the previous pepper to remain available while stored hashes are upgraded after successful login. Removing it too early causes the controlled verification failure covered by `password-security.test.js`.

## Redeploying known-good code

Use the Render Events page to select a recent successful deploy and roll back, or deploy a specific known-good commit. Record the commit and deploy time before changing it. Render documents that a dashboard rollback disables automatic deploys, so re-enable them only after the bad change is fixed and checked: [Render rollbacks](https://render.com/docs/rollbacks) and [Render deploys](https://render.com/docs/deploys).

After rollback or redeployment, check `/health`, the login page, one authenticated role, the CSP header and the service-worker cache. A green Render event by itself does not prove the database or session flow is working.
