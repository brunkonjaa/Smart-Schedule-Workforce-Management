const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const readFrontendFile = (relativePath) => {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
};

describe('Administrator frontend contract', () => {
  const adminSource = readFrontendFile('frontend/src/services/admin-ui.js');
  const bannerSource = readFrontendFile('frontend/src/services/submission-review-ui.js');
  const sessionSource = readFrontendFile('frontend/src/services/session-ui.js');
  const pageConfig = readFrontendFile('frontend/src/pages/page-config.js');
  const auditSource = readFrontendFile('frontend/src/services/audit-logs-ui.js');
  const styles = readFrontendFile('frontend/src/styles/main.css');
  const indexSource = readFrontendFile('frontend/public/index.html');

  test('keeps Admin separate from the operational Manager pages', () => {
    expect(pageConfig).toContain("id: 'admin'");
    expect(pageConfig).toContain("audience: 'admin'");
    expect(pageConfig).toContain('Administrator access is separate from rota and employee-record access.');
    expect(pageConfig).toContain("id: 'audit-logs'");
    expect(pageConfig).toContain("audience: 'manager'");
  });

  test('loads the narrow Admin workspace without HTML string rendering', () => {
    expect(indexSource).toContain('../src/services/admin-ui.js');
    expect(adminSource).toContain('/api/v1/admin/accounts');
    expect(adminSource).toContain('/api/v1/admin/security-events');
    expect(adminSource).toContain('Confirm administrator action');
    expect(adminSource).not.toContain('.innerHTML');
    expect(styles).toContain('.admin-workspace');
    expect(styles).toContain('@media (max-width: 760px)');
  });

  test('shows the reviewer exception only for the marked account and dismisses it per browser session', () => {
    expect(bannerSource).toContain('isSubmissionReviewer');
    expect(bannerSource).toContain('optional for this account only');
    expect(bannerSource).toContain('not intended for a real workplace');
    expect(bannerSource).toContain('window.sessionStorage.setItem');
    expect(bannerSource).toContain("focusPasswordControl('current-password')");
    expect(bannerSource).toContain("focusPasswordControl('register-passkey')");
    expect(sessionSource).toContain('submissionReviewUi?.clearDismissals?.()');
    expect(sessionSource).toContain("title.textContent = signedIn ? 'Password and passkeys' : 'Sign in'");
  });

  test('requires the invited administrator to register a passkey after choosing a password', () => {
    expect(pageConfig).toContain("id: 'activate-admin'");
    expect(sessionSource).toContain('Register administrator passkey');
    expect(sessionSource).toContain('The password is saved. Register a passkey now to activate this administrator account.');
    expect(sessionSource).toContain('/api/v1/auth/admin-invitations/accept');
    expect(sessionSource).toContain('/api/v1/auth/passkeys/registration/verify');
  });

  test('keeps the audit explanation beside the real append-only records', () => {
    expect(auditSource).toContain("text: 'About these records'");
    expect(auditSource).toContain('Smart Schedule records rota changes and access to protected Employee Summaries.');
    expect(auditSource).toContain('Routine navigation and background refreshes are not recorded.');
    expect(styles).toContain('.audit-log-information');
  });
});
