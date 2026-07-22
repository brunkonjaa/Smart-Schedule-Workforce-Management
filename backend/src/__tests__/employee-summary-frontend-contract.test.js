const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '../../..');
const readFrontendFile = (relativePath) => {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
};

describe('Employee Summary frontend contract', () => {
  const panelSource = readFrontendFile('frontend/src/services/employee-summary-ui.js');
  const appSource = readFrontendFile('frontend/src/scripts/app.js');
  const helperSource = readFrontendFile('frontend/src/services/live-ui-helpers.js');
  const styles = readFrontendFile('frontend/src/styles/main.css');

  test('uses a strict route-backed employee summary hash', () => {
    expect(panelSource).toContain("const routePattern = /^staff\\/([0-9a-f-]+)\\/summary$/i");
    expect(panelSource).toContain('sourcePage');
    expect(appSource).toContain('employeeSummaryUi?.parseRoute()');
  });

  test.each([
    ['Rota', 'frontend/src/services/rota-ui.js'],
    ['Staff', 'frontend/src/services/staff-manager.js'],
    ['Time Off', 'frontend/src/services/leave-ui.js'],
    ['Swap Requests', 'frontend/src/services/swap-requests-ui.js'],
    ['Audit Log', 'frontend/src/services/audit-logs-ui.js']
  ])('%s includes an Employee Summary link integration', (label, relativePath) => {
    expect(readFrontendFile(relativePath)).toContain('createEmployeeLink');
  });

  test('manager-only link checks keep staff names as text', () => {
    expect(readFrontendFile('frontend/src/services/rota-ui.js')).toContain(
      "state.sessionUser?.role === 'MANAGER'"
    );
    expect(readFrontendFile('frontend/src/services/leave-ui.js')).toContain(
      "state.sessionUser.role === 'MANAGER'"
    );
    expect(readFrontendFile('frontend/src/services/swap-requests-ui.js')).toContain(
      "sessionUser.role === 'MANAGER'"
    );

    const context = { window: { SmartSchedule: {} } };
    vm.runInNewContext(helperSource, context);
    const { formatAccountFunction } = context.window.SmartSchedule.liveUiHelpers;
    expect(formatAccountFunction({ primaryRole: 'FLOOR', role: 'MANAGER' })).toBe('Floor Manager');
    expect(formatAccountFunction({ primaryRole: 'FLOOR', role: 'STAFF' })).toBe('Floor Staff');
    expect(formatAccountFunction({ primaryRole: 'BAR', role: 'STAFF' })).toBe('Bar Staff');
    expect(formatAccountFunction({ primaryRole: 'KITCHEN', role: 'STAFF' })).toBe('Kitchen Staff');
    expect(formatAccountFunction({ primaryRole: 'OTHER', role: 'STAFF' })).toBe('Kitchen Porter Staff');
    expect(formatAccountFunction({ role: 'ADMIN' })).toBe('Administrator');
    expect(appSource).toContain('formatAccountFunction(result.user)');
    expect(readFrontendFile('frontend/src/services/audit-logs-ui.js')).toContain(
      'getActorDescription(log)'
    );
  });

  test('supports Escape, focus containment and source focus return', () => {
    expect(panelSource).toContain("event.key === 'Escape'");
    expect(panelSource).toContain("event.key !== 'Tab'");
    expect(panelSource).toContain('summaryReturnFocusStaffId');
    expect(panelSource).toContain('?.focus()');
  });

  test('rechecks the manager session after app switching without requesting summary data', () => {
    expect(panelSource).toContain("document.addEventListener('visibilitychange', recheckVisibleSession)");
    const recheckBody = panelSource.slice(
      panelSource.indexOf('const recheckVisibleSession'),
      panelSource.indexOf('const bindResumeCheck')
    );
    expect(recheckBody).toContain("apiClient.get('/api/v1/auth/me')");
    expect(recheckBody).not.toContain('getSummaryRequestPath');
  });

  test('records a protected print request before opening the print dialog', () => {
    const printRequestIndex = panelSource.indexOf('/summary/print-request');
    const printDialogIndex = panelSource.indexOf('window.print()');
    expect(printRequestIndex).toBeGreaterThan(-1);
    expect(printDialogIndex).toBeGreaterThan(printRequestIndex);
    expect(panelSource).toContain('The print request was not recorded');
  });

  test('defines desktop, tablet and mobile panel sizes with reduced motion', () => {
    const mobileStyles = styles.slice(
      styles.indexOf('@media (max-width: 700px)'),
      styles.indexOf('@media (prefers-reduced-motion: reduce)')
    );
    expect(styles).toContain('width: min(50vw, 920px)');
    expect(styles).toContain('height: 90vh');
    expect(styles).toContain('width: 74vw');
    expect(styles).toContain('width: 96vw');
    expect(styles).toContain('height: 96vh');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(panelSource).toContain("text: 'Back'");
    expect(mobileStyles).not.toMatch(/\.employee-summary-back\s*\{[^}]*display:\s*none/);
  });

  test('defines A4 print output and excludes screen-only information', () => {
    expect(styles).toContain('size: A4 portrait');
    expect(styles).toContain('.employee-summary-screen-only');
    expect(styles).toContain('.employee-summary-print-excluded');
    expect(styles).toContain('.employee-summary-print-footer');
    expect(panelSource).toContain('Prepared by');
  });

  test('clears the remembered summary route on deliberate logout', () => {
    expect(appSource).toContain('clearProtectedState({ clearReturnRoute: true })');
    expect(appSource).toContain('summaryReturnRoute: null');
    expect(appSource).toContain("text: 'You have signed out.'");
  });
});
