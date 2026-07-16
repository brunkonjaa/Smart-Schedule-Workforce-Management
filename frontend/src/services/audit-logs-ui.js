window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.auditLogsUi = (function createAuditLogsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;

  const formatDateTime = (value) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      year: 'numeric',
      hour12: false
    });
  };

  const formatStateDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC', year: 'numeric' });
  };

  const getState = (log) => log.afterState || log.beforeState || {};

  const getStaffName = (state) => {
    const name = String(state?.fullName || '').trim();
    const placeholderNames = new Set(['Reset Staff', 'Swap Requester', 'Swap Target']);
    return name && !placeholderNames.has(name) ? name : 'Staff member';
  };

  const getReadableTime = (state) => {
    if (!state.startTime || !state.endTime) return 'Time not recorded';
    return `${String(state.startTime).slice(0, 5)}-${String(state.endTime).slice(0, 5)}`;
  };

  const getReadableShift = (state) => {
    if (!state.shiftDate) return 'Shift date not recorded';
    return `${formatStateDate(state.shiftDate)} · ${getReadableTime(state)}`;
  };

  const getReadableChange = (log) => {
    switch (log.action) {
      case 'ASSIGNMENT_CREATED':
        return 'Assigned staff member';
      case 'ASSIGNMENT_UPDATED':
        return 'Changed assignment';
    case 'ASSIGNMENT_DELETED':
      return 'Removed assignment';
    case 'SHIFT_CREATED':
      return `Created ${getState(log).requiredRole || 'work'} shift`;
      case 'SHIFT_UPDATED':
        return 'Changed shift time';
      case 'SHIFT_DELETED':
        return 'Removed shift';
      default:
        return log.summary || 'A rota change was recorded.';
    }
  };

  const renderLogs = (workspaceElement, logs) => {
    workspaceElement.textContent = '';
    const grid = helpers.createElement('div', { className: 'workspace-grid' });
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 audit-log-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Recorded changes',
      'Only manager actions recorded by the backend are shown here.'
    ));

    if (logs.length === 0) {
      panel.appendChild(helpers.createElement('p', {
        className: 'panel-copy',
        text: 'No audit records have been created yet.'
      }));
    } else {
      const tableWrap = helpers.createElement('div', { className: 'table-wrap' });
      const table = helpers.createElement('table', { className: 'audit-log-table' });
      const head = helpers.createElement('thead');
      const headRow = helpers.createElement('tr');
      ['When', 'Change', 'Manager', 'Staff member', 'Shift'].forEach((label) => {
        headRow.appendChild(helpers.createElement('th', { text: label }));
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = helpers.createElement('tbody');
      logs.forEach((log) => {
        const row = helpers.createElement('tr');
        row.appendChild(helpers.createTableCell('When', formatDateTime(log.createdAt)));
        row.appendChild(helpers.createTableCell('Change', getReadableChange(log)));
        row.appendChild(helpers.createTableCell('Manager', log.actorName || log.actorEmail || 'Manager account'));
        row.appendChild(helpers.createTableCell('Staff member', getStaffName(getState(log))));
        row.appendChild(helpers.createTableCell('Shift', getReadableShift(getState(log))));
        body.appendChild(row);
      });
      table.appendChild(body);
      tableWrap.appendChild(table);
      panel.appendChild(tableWrap);
    }

    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, workspaceElement }) => {
    if (page.id !== 'audit-logs') return;

      helpers.renderIntroMetrics([
        { label: 'Audit log', value: 'Loading...', tone: 'accent' },
      { label: 'Access', value: 'Manager', tone: 'neutral' }
    ]);

    try {
      const result = await apiClient.get('/api/v1/audit-logs?limit=100');
      helpers.renderIntroMetrics([
        { label: 'Audit log', value: String(result.logs.length), tone: 'accent' },
        { label: 'Access', value: 'Manager', tone: 'neutral' }
      ]);
      renderLogs(workspaceElement, result.logs);
    } catch (error) {
      workspaceElement.textContent = '';
      const grid = helpers.createElement('div', { className: 'workspace-grid' });
      grid.appendChild(helpers.createEmptyPanel(
        'Audit log could not load',
        helpers.getErrorFeedback(error, 'Try again after signing in as a manager.').text,
        'content-panel--span-16'
      ));
      workspaceElement.appendChild(grid);
    }
  };

  return { mount };
})();
