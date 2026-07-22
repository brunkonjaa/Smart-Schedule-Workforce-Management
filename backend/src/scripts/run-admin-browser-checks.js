const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.APP_BASE_URL = 'http://localhost:3097';
process.env.PASSWORD_PEPPER_CURRENT_VERSION = '1';
process.env.PASSWORD_PEPPER_V1 = crypto.randomBytes(32).toString('base64url');
process.env.SUBMISSION_REVIEW_ACCOUNTS_ENABLED = 'true';

global.fetch = async () => ({
  ok: true,
  text: async () => ''
});

const { chromium } = require('playwright');
const app = require('../app');
const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, query } = require('../config/db');
const { hashSingleUseToken } = require('../services/admin-service');
const { createPasswordHash } = require('../services/password-security-service');

const repositoryRoot = path.resolve(__dirname, '../../..');
const screenshotDirectory = path.join(
  repositoryRoot,
  'assets',
  'screenshots',
  'tests',
  'frontend-workflows'
);
const printEvidenceDirectory = path.join(repositoryRoot, 'output', 'admin-browser-review');
const baseUrl = 'http://localhost:3097';
const checks = [];

const check = (condition, label) => {
  if (!condition) throw new Error(`Browser check failed: ${label}`);
  checks.push(label);
};

const listen = () => new Promise((resolve, reject) => {
  const server = app.listen(3097, '127.0.0.1', () => resolve(server));
  server.once('error', reject);
});

const closeServer = (server) => new Promise((resolve) => {
  if (!server) return resolve();
  server.close(() => resolve());
});

const login = async (page, email, password) => {
  await page.goto(`${baseUrl}/#login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in' }).waitFor();
  await page.waitForTimeout(500);
  await page.locator('input[name="work-account"]').fill(email);
  await page.locator('input[name="work-passcode"]').fill(password);
  const responsePromise = page.waitForResponse((response) => {
    return response.url().endsWith('/api/v1/auth/login');
  });
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await responsePromise;
  if (response.status() !== 200) {
    throw new Error(`Browser login returned HTTP ${response.status()}.`);
  }
};

const waitForPage = async (page, pageId) => {
  try {
    await page.waitForFunction(
      (expectedPage) => document.body.dataset.page === expectedPage,
      pageId
    );
  } catch (error) {
    const currentPage = await page.evaluate(() => document.body.dataset.page || 'unset');
    const visibleFeedback = await page.evaluate(() => {
      return (document.getElementById('workspace')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300);
    });
    throw new Error(
      `Timed out waiting for page ${pageId}; current page is ${currentPage}. Visible feedback: ${visibleFeedback}`
    );
  }
};

const getNavigationLabels = (page) => {
  return page.locator('.top-nav .nav-link').allTextContents()
    .then((labels) => labels.map((label) => label.trim()));
};

const getViewportFit = (page) => page.evaluate(() => ({
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));

const waitForSettledAuthenticatedPage = async (page, pageId, headingName) => {
  await waitForPage(page, pageId);
  if (headingName) {
    await page.getByRole('heading', { name: headingName }).waitFor();
  }
  await page.waitForFunction(() => !document.querySelector('input[name="work-account"]'));
  await page.waitForTimeout(400);
};

const assertNoPopulatedPasswordInput = async (page) => {
  const hasPopulatedPassword = await page.locator('input[type="password"]').evaluateAll((inputs) => {
    return inputs.some((input) => input.value.length > 0);
  });
  if (hasPopulatedPassword) {
    throw new Error('Screenshot blocked because a password field still contains a value.');
  }
};

const capturePage = async (page, filename) => {
  await assertNoPopulatedPasswordInput(page);
  await page.screenshot({
    path: path.join(screenshotDirectory, filename),
    scale: 'css'
  });
};

const addVirtualAuthenticator = async (context, page) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      automaticPresenceSimulation: true,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: 'ctap2',
      transport: 'internal'
    }
  });
  return cdp;
};

const insertUser = async ({
  displayName = null,
  email,
  id,
  isSubmissionReviewer = false,
  password,
  role
}) => {
  const passwordRecord = await createPasswordHash(password);
  await query(
    `
      INSERT INTO users (
        id, email, display_name, password_hash, password_scheme,
        password_pepper_version, role, is_active, is_submission_reviewer,
        must_change_password, password_changed_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, FALSE, NOW(), NOW(), NOW())
    `,
    [
      id,
      email,
      displayName,
      passwordRecord.passwordHash,
      passwordRecord.passwordScheme,
      passwordRecord.passwordPepperVersion,
      role,
      isSubmissionReviewer
    ]
  );
};

const run = async () => {
  if (!isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Admin browser checks are restricted to a local PostgreSQL database.');
  }

  fs.mkdirSync(screenshotDirectory, { recursive: true });
  fs.mkdirSync(printEvidenceDirectory, { recursive: true });
  const ids = {
    invited: crypto.randomUUID(),
    invitation: crypto.randomUUID(),
    manager: crypto.randomUUID(),
    managerProfile: crypto.randomUUID(),
    normalAdmin: crypto.randomUUID(),
    reviewer: crypto.randomUUID(),
    staff: crypto.randomUUID(),
    staffProfile: crypto.randomUUID()
  };
  const emails = {
    invited: 'declanoconnoradminfake@gmail.com',
    manager: 'fionahughesmanagerfake@gmail.com',
    normalAdmin: 'ciaranmurphyadminfake@gmail.com',
    reviewer: 'niamhosullivanadminfake@gmail.com',
    staff: 'aoifebrennanstafffake@gmail.com'
  };
  const passwords = {
    invited: crypto.randomBytes(28).toString('base64url'),
    manager: crypto.randomBytes(28).toString('base64url'),
    normalAdmin: crypto.randomBytes(28).toString('base64url'),
    reviewer: crypto.randomBytes(28).toString('base64url'),
    staff: crypto.randomBytes(28).toString('base64url')
  };
  const invitationToken = crypto.randomBytes(32).toString('hex');
  let server;
  let browser;

  try {
    await insertUser({
      displayName: "Niamh O'Sullivan",
      email: emails.reviewer,
      id: ids.reviewer,
      isSubmissionReviewer: true,
      password: passwords.reviewer,
      role: 'ADMIN'
    });
    await insertUser({
      displayName: 'Ciaran Murphy',
      email: emails.normalAdmin,
      id: ids.normalAdmin,
      password: passwords.normalAdmin,
      role: 'ADMIN'
    });
    await insertUser({
      email: emails.manager,
      id: ids.manager,
      password: passwords.manager,
      role: 'MANAGER'
    });
    await insertUser({
      email: emails.staff,
      id: ids.staff,
      password: passwords.staff,
      role: 'STAFF'
    });
    await query(
      `
        INSERT INTO staff_profiles (
          id, user_id, full_name, primary_role, contract_hours,
          phone_number, is_active, created_at, updated_at
        )
        VALUES ($1, $2, 'Fiona Hughes', 'FLOOR', 40, NULL, TRUE, NOW(), NOW()),
               ($3, $4, 'Aoife Brennan', 'BAR', 20, NULL, TRUE, NOW(), NOW())
      `,
      [ids.managerProfile, ids.manager, ids.staffProfile, ids.staff]
    );
    await query(
      `
        INSERT INTO admin_invitations (
          id, invited_email, display_name, token_hash,
          invited_by_admin_user_id, expires_at
        )
        VALUES ($1, $2, 'Declan O''Connor', $3, $4, NOW() + INTERVAL '30 minutes')
      `,
      [ids.invitation, emails.invited, hashSingleUseToken(invitationToken), ids.reviewer]
    );

    server = await listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });

    const reviewerContext = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1600, height: 900 }
    });
    const reviewerPage = await reviewerContext.newPage();
    await addVirtualAuthenticator(reviewerContext, reviewerPage);
    console.log('QA reviewer desktop flow');
    await login(reviewerPage, emails.reviewer, passwords.reviewer);
    await waitForSettledAuthenticatedPage(
      reviewerPage,
      'admin',
      'Administrator accounts'
    );
    check(
      JSON.stringify(await getNavigationLabels(reviewerPage)) ===
        JSON.stringify(['Admin', 'Password', 'Logout']),
      'Admin navigation contains only Admin, Password and Logout'
    );
    check(
      await reviewerPage.getByText('Temporary assessment account', { exact: true }).isVisible(),
      'reviewer banner is visible on the marked account'
    );
    await capturePage(reviewerPage, '159_local-admin-reviewer-desktop.png');
    await reviewerPage.setViewportSize({ width: 1024, height: 768 });
    await capturePage(reviewerPage, '165_local-admin-reviewer-tablet.png');
    let fit = await getViewportFit(reviewerPage);
    check(fit.scrollWidth <= fit.clientWidth, 'Admin tablet layout has no page-level horizontal overflow');
    await reviewerPage.setViewportSize({ width: 390, height: 844 });
    await capturePage(reviewerPage, '160_local-admin-reviewer-mobile.png');
    fit = await getViewportFit(reviewerPage);
    check(fit.scrollWidth <= fit.clientWidth, 'Admin mobile layout has no page-level horizontal overflow');
    await reviewerPage.setViewportSize({ width: 1600, height: 900 });

    await reviewerPage.getByRole('button', { name: 'Change password' }).click();
    await waitForPage(reviewerPage, 'login');
    await reviewerPage.waitForTimeout(350);
    check(
      await reviewerPage.locator('#current-password').evaluate((element) => element === document.activeElement),
      'reviewer Change password link focuses the real current-password control'
    );
    await reviewerPage.getByRole('button', { name: 'Register passkey' }).click();
    await reviewerPage.waitForTimeout(350);
    check(
      await reviewerPage.locator('#register-passkey').evaluate((element) => element === document.activeElement),
      'reviewer Register passkey link focuses the real Add passkey control'
    );
    await reviewerPage.evaluate(() => window.scrollTo(0, 0));
    await capturePage(reviewerPage, '163_local-reviewer-password-passkey-options.png');

    const reviewerOptionsResponse = reviewerPage.waitForResponse((response) => {
      return response.url().endsWith('/api/v1/auth/passkeys/registration/options');
    });
    const reviewerRegistrationResponse = reviewerPage.waitForResponse((response) => {
      return response.url().endsWith('/api/v1/auth/passkeys/registration/verify');
    }, { timeout: 8000 }).catch(() => null);
    await reviewerPage.locator('#register-passkey').click();
    const reviewerOptionsStatus = (await reviewerOptionsResponse).status();
    if (reviewerOptionsStatus !== 200) {
      throw new Error(`Reviewer passkey options returned HTTP ${reviewerOptionsStatus}.`);
    }
    const reviewerRegistrationResult = await reviewerRegistrationResponse;
    if (!reviewerRegistrationResult) {
      const visibleFeedback = await reviewerPage.locator('#workspace').innerText();
      throw new Error(
        `Reviewer passkey verification was not sent. Visible feedback: ${visibleFeedback.replace(/\s+/g, ' ').slice(0, 300)}`
      );
    }
    const reviewerRegistrationStatus = reviewerRegistrationResult.status();
    if (reviewerRegistrationStatus !== 201) {
      const visibleFeedback = await reviewerPage.locator('#workspace').innerText();
      throw new Error(
        `Reviewer passkey registration returned HTTP ${reviewerRegistrationStatus}. Visible feedback: ${visibleFeedback.replace(/\s+/g, ' ').slice(0, 300)}`
      );
    }
    await reviewerPage.getByText('Passkey registered.', { exact: false }).waitFor();
    check(true, 'optional reviewer passkey registration completes with a virtual authenticator');
    console.log('QA reviewer passkey registered');
    await reviewerPage.locator('a.nav-link[href="#admin"]').click();
    await waitForPage(reviewerPage, 'admin');
    const dismissButton = reviewerPage.getByRole('button', {
      name: 'Dismiss temporary assessment account message'
    });
    await dismissButton.click();
    await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
    console.log('QA reviewer banner dismissal reload');
    await reviewerPage.getByRole('heading', { name: 'Administrator accounts' }).waitFor();
    check(
      await reviewerPage.getByText('Temporary assessment account', { exact: true }).count() === 0,
      'reviewer banner stays dismissed during the current browser session'
    );

    const revokeButton = reviewerPage.getByRole('button', { name: 'Revoke sessions' }).first();
    await revokeButton.focus();
    await revokeButton.click();
    const dialog = reviewerPage.getByRole('dialog', { name: 'Confirm administrator action' });
    await dialog.waitFor();
    check(
      await dialog.locator('input[type="password"]').evaluate((element) => element === document.activeElement),
      'Admin re-authentication dialog receives keyboard focus'
    );
    await reviewerPage.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    check(
      await revokeButton.evaluate((element) => element === document.activeElement),
      'closing re-authentication returns focus to its action'
    );

    const addForm = reviewerPage.locator('.admin-add-form');
    await addForm.getByRole('button', { name: 'Add administrator' }).click();
    check(
      await addForm.getByText('Enter the administrator name and email.', { exact: true }).isVisible(),
      'Add administrator shows an inline validation error'
    );
    await reviewerPage.locator('#theme-toggle').click();
    check(
      await reviewerPage.evaluate(() => document.body.dataset.theme === 'dark'),
      'Admin workspace supports the existing dark theme switch'
    );
    await reviewerPage.locator('#theme-toggle').click();

    await reviewerPage.getByRole('button', { name: 'Logout' }).click();
    console.log('QA reviewer logout and back');
    await waitForPage(reviewerPage, 'login');
    await reviewerPage.goBack();
    await reviewerPage.waitForTimeout(250);
    check(
      await reviewerPage.getByRole('heading', { name: 'Administrator accounts' }).count() === 0,
      'Logout plus Browser Back does not restore the Admin table'
    );
    await login(reviewerPage, emails.reviewer, passwords.reviewer);
    await reviewerPage.getByRole('heading', { name: 'Confirm privileged sign-in' }).waitFor();
    const reviewerLoginVerification = reviewerPage.waitForResponse((response) => {
      return response.url().endsWith('/api/v1/auth/passkeys/login/verify');
    });
    await reviewerPage.getByRole('button', { name: 'Use passkey' }).click();
    const reviewerLoginStatus = (await reviewerLoginVerification).status();
    if (reviewerLoginStatus !== 200) {
      const visibleFeedback = await reviewerPage.locator('#workspace').innerText();
      throw new Error(
        `Reviewer passkey sign-in returned HTTP ${reviewerLoginStatus}. Visible feedback: ${visibleFeedback.replace(/\s+/g, ' ').slice(0, 300)}`
      );
    }
    console.log('QA reviewer later passkey sign-in');
    await waitForSettledAuthenticatedPage(
      reviewerPage,
      'admin',
      'Administrator accounts'
    );
    check(
      await reviewerPage.getByText('Temporary assessment account', { exact: true }).isVisible(),
      'reviewer banner returns after deliberate logout and passkey sign-in'
    );

    const adminEventTable = reviewerPage.locator('.admin-event-table');
    await adminEventTable.evaluate((element) => {
      const panel = element.closest('.content-panel') || element;
      const top = panel.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo(0, Math.max(0, top));
    });
    await reviewerPage.waitForTimeout(250);
    await capturePage(reviewerPage, '166_local-admin-security-events.png');

    const normalContext = await browser.newContext({ viewport: { width: 1920, height: 900 } });
    const normalPage = await normalContext.newPage();
    console.log('QA normal Admin setup gate');
    await login(normalPage, emails.normalAdmin, passwords.normalAdmin);
    await waitForSettledAuthenticatedPage(normalPage, 'admin', 'Passkey setup required');
    check(
      await normalPage.getByText('Register a passkey from Password before opening the Admin workspace.').isVisible(),
      'ordinary Admin is blocked from the workspace without a passkey'
    );
    await capturePage(normalPage, '162_local-normal-admin-passkey-required.png');
    await normalContext.close();

    const activationContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const activationPage = await activationContext.newPage();
    console.log('QA normal invitation activation');
    await addVirtualAuthenticator(activationContext, activationPage);
    await activationPage.goto(
      `${baseUrl}/#activate-admin?token=${invitationToken}`,
      { waitUntil: 'domcontentloaded' }
    );
    await activationPage.getByRole('heading', { name: 'Choose administrator password' }).waitFor();
    await activationPage.getByLabel('Password', { exact: true }).fill(passwords.invited);
    await activationPage.getByLabel('Confirm password', { exact: true }).fill(passwords.invited);
    await activationPage.getByRole('button', { name: 'Save password and continue' }).click();
    await activationPage.getByRole('heading', { name: 'Register administrator passkey' }).waitFor();
    await capturePage(activationPage, '161_local-admin-invitation-passkey-step.png');
    await activationPage.getByRole('button', { name: 'Register passkey' }).click();
    await waitForPage(activationPage, 'admin');
    await activationPage.getByRole('heading', { name: 'Administrator accounts' }).waitFor();
    const invitedState = await query(
      `
        SELECT users.id, users.is_active,
               COUNT(user_passkeys.id) FILTER (WHERE user_passkeys.revoked_at IS NULL)::INTEGER AS passkey_count
        FROM users
        LEFT JOIN user_passkeys ON user_passkeys.user_id = users.id
        WHERE users.email = $1
        GROUP BY users.id
      `,
      [emails.invited]
    );
    ids.invited = invitedState.rows[0].id;
    check(
      invitedState.rows[0].is_active && Number(invitedState.rows[0].passkey_count) === 1,
      'normal invitation activates only after password and passkey registration'
    );
    await activationContext.close();

    const managerContext = await browser.newContext({ viewport: { width: 1920, height: 900 } });
    const managerPage = await managerContext.newPage();
    console.log('QA Manager regression flow');
    await login(managerPage, emails.manager, passwords.manager);
    await waitForSettledAuthenticatedPage(managerPage, 'rota');
    await managerPage.locator('.rota-table').waitFor();
    check(
      await managerPage.locator('#user-greeting').getByText('Floor Manager', { exact: false }).isVisible(),
      'Manager greeting shows the Floor Manager position'
    );
    check(
      JSON.stringify(await getNavigationLabels(managerPage)) === JSON.stringify([
        'Rota', 'Overview', 'Audit log', 'Password', 'Logout', 'Staff', 'Time Off', 'Swap Requests'
      ]),
      'Manager navigation labels and order stay unchanged and contain no Admin link'
    );
    await managerPage.goto(`${baseUrl}/#admin`, { waitUntil: 'domcontentloaded' });
    await managerPage.waitForTimeout(350);
    check(
      await managerPage.evaluate(() => document.body.dataset.page !== 'admin'),
      'direct Manager Admin hash resolves to an allowed Manager page'
    );
    await managerPage.locator('a.nav-link[href="#audit-logs"]').click();
    await waitForPage(managerPage, 'audit-logs');
    const information = managerPage.locator('.audit-log-information');
    await information.getByText('About these records', { exact: true }).click();
    check(await information.evaluate((element) => element.open), 'Audit Log information opens by pointer');
    await information.locator('summary').focus();
    await managerPage.keyboard.press('Enter');
    await managerPage.keyboard.press('Enter');
    check(await information.evaluate((element) => element.open), 'Audit Log information toggles by keyboard');
    await managerPage.evaluate(() => window.scrollTo(0, 0));
    await capturePage(managerPage, '164_local-audit-log-information-expanded.png');
    await managerPage.locator('a.nav-link[href="#rota"]').click();
    await waitForPage(managerPage, 'rota');
    await managerPage.locator('.rota-table').first().waitFor();
    await capturePage(managerPage, '167_local-rota-after-admin-scope.png');
    fit = await getViewportFit(managerPage);
    check(fit.scrollWidth <= fit.clientWidth, 'existing Manager Rota has no page-level horizontal overflow');

    await managerPage.locator('a.nav-link[href="#staff"]').click();
    await waitForPage(managerPage, 'staff');
    const summaryLink = managerPage.locator(
      `a[data-employee-summary-link="true"][data-staff-id="${ids.staffProfile}"]`
    );
    await summaryLink.waitFor();
    await summaryLink.click();
    const employeeSummaryPanel = managerPage.locator('.employee-summary-panel');
    await employeeSummaryPanel.waitFor();
    await employeeSummaryPanel.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo(0, Math.max(0, top));
    });
    await managerPage.waitForTimeout(250);
    await capturePage(managerPage, '168_local-employee-summary-after-admin-scope-desktop.png');
    await managerPage.setViewportSize({ width: 390, height: 844 });
    await employeeSummaryPanel.evaluate((element) => {
      const top = element.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo(0, Math.max(0, top));
    });
    await managerPage.waitForTimeout(250);
    await capturePage(managerPage, '169_local-employee-summary-after-admin-scope-mobile.png');
    check(
      await managerPage.locator('.employee-summary-panel').isVisible(),
      'Employee Summary remains visible at the mobile viewport'
    );
    await managerPage.setViewportSize({ width: 1920, height: 900 });
    await assertNoPopulatedPasswordInput(managerPage);
    await managerPage.pdf({
      path: path.join(printEvidenceDirectory, 'employee-summary-print.pdf'),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
    await employeeSummaryPanel.getByRole('button', { name: 'Close' }).click();
    await managerPage.locator('a.nav-link[href="#audit-logs"]').click();
    await waitForPage(managerPage, 'audit-logs');
    await managerPage.getByRole('tab', { name: 'Employee access' }).click();
    const employeeAccessName = managerPage.getByText('Aoife Brennan', { exact: true });
    await employeeAccessName.waitFor();
    check(
      await employeeAccessName.isVisible(),
      'Employee access history uses the Irish staff name from the current profile'
    );
    await managerPage.evaluate(() => window.scrollTo(0, 0));
    await capturePage(managerPage, '170_local-employee-access-irish-names.png');
    await managerContext.close();

    const staffContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const staffPage = await staffContext.newPage();
    console.log('QA Staff regression flow');
    await login(staffPage, emails.staff, passwords.staff);
    await waitForSettledAuthenticatedPage(staffPage, 'rota');
    await staffPage.locator('.rota-table').waitFor();
    check(
      await staffPage.locator('#user-greeting').getByText('Bar Staff', { exact: false }).isVisible(),
      'Staff greeting shows the Bar Staff position'
    );
    check(
      JSON.stringify(await getNavigationLabels(staffPage)) === JSON.stringify([
        'Rota', 'Overview', 'Password', 'Logout', 'Time Off', 'Swap Requests'
      ]),
      'Staff navigation labels and order stay unchanged and contain no Admin link'
    );
    const adminStatus = await staffPage.evaluate(async () => {
      const response = await fetch('/api/v1/admin/accounts');
      return response.status;
    });
    check(adminStatus === 403, 'Staff receives 403 from the Admin API in a real browser session');
    await staffContext.close();

    const reviewerPasskeyRow = await query(
      'SELECT credential_id, public_key, counter FROM user_passkeys WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1',
      [ids.reviewer]
    );
    check(reviewerPasskeyRow.rowCount === 1, 'reviewer passkey remains registered after later sign-in');

    await query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [ids.reviewer]);
    await reviewerPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForPage(reviewerPage, 'login');
    check(
      await reviewerPage.getByRole('heading', { name: 'Administrator accounts' }).count() === 0,
      'invalidated Admin session returns to Login without retained account content'
    );
    await reviewerContext.close();

    console.log(`Admin browser QA passed ${checks.length} checks.`);
    checks.forEach((label) => console.log(`PASS ${label}`));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await closeServer(server);
    await query(
      `DELETE FROM audit_logs
       WHERE actor_user_id IN ($1, $2, $3, $4)
          OR entity_id IN ($5, $6)`,
      [ids.reviewer, ids.normalAdmin, ids.manager, ids.staff, ids.managerProfile, ids.staffProfile]
    ).catch(() => {});
    await query(
      `DELETE FROM security_events
       WHERE actor_user_id IN ($1, $2, $3, $4, $5)
          OR target_user_id IN ($1, $2, $3, $4, $5)`,
      [ids.reviewer, ids.normalAdmin, ids.manager, ids.staff, ids.invited]
    ).catch(() => {});
    await query('DELETE FROM admin_invitations WHERE id = $1', [ids.invitation]).catch(() => {});
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2)', [
      ids.managerProfile,
      ids.staffProfile
    ]).catch(() => {});
    await query(
      `DELETE FROM user_sessions
       WHERE sess::text LIKE '%' || $1 || '%'
          OR sess::text LIKE '%' || $2 || '%'
          OR sess::text LIKE '%' || $3 || '%'
          OR sess::text LIKE '%' || $4 || '%'
          OR sess::text LIKE '%' || $5 || '%'`,
      [ids.reviewer, ids.normalAdmin, ids.manager, ids.staff, ids.invited]
    ).catch(() => {});
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)',
      [ids.reviewer, ids.normalAdmin, ids.manager, ids.staff, ids.invited]
    ).catch(() => {});
    await closePool();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
