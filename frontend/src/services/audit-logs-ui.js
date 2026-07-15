window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.auditLogsUi = (function createAuditLogsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;

  const formatDateTime = (value) => {
    if (!value) return 'Unknown time';
    return new Date(value).toLocaleString();
  };

  const formatState = (value) => {
    if (!value) return 'No recorded state';
    return JSON.stringify(value, null, 2);
  };

  const createStateDetails = (log) => {
    const details = helpers.createElement('details', { className: 'audit-log-details' });
    details.appendChild(helpers.createElement('summary', { text: 'Show recorded state' }));
    const state = helpers.createElement('div', { className: 'audit-log-state' });
    const before = helpers.createElement('div');
    before.appendChild(helpers.createElement('strong', { text: 'Before' }));
    before.appendChild(helpers.createElement('pre', { text: formatState(log.beforeState) }));
    const after = helpers.createElement('div');
    after.appendChild(helpers.createElement('strong', { text: 'After' }));
    after.appendChild(helpers.createElement('pre', { text: formatState(log.afterState) }));
    state.append(before, after);
    details.appendChild(state);
    return details;
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
      ['When', 'Action', 'Actor', 'Record', 'Details'].forEach((label) => {
        headRow.appendChild(helpers.createElement('th', { text: label }));
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = helpers.createElement('tbody');
      logs.forEach((log) => {
        const row = helpers.createElement('tr');
        row.appendChild(helpers.createTableCell('When', formatDateTime(log.createdAt)));
        row.appendChild(helpers.createTableCell('Action', log.action));
        row.appendChild(helpers.createTableCell('Actor', log.actorName || log.actorEmail || 'System record'));
        row.appendChild(helpers.createTableCell('Record', `${log.entityType} ${log.entityId}`));
        const detailsCell = helpers.createElement('td', { attributes: { 'data-label': 'Details' } });
        detailsCell.appendChild(helpers.createElement('p', { className: 'audit-log-summary', text: log.summary }));
        detailsCell.appendChild(createStateDetails(log));
        row.appendChild(detailsCell);
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
      { label: 'Access', value: 'Manager', tone: 'neutral' },
      { label: 'Source', value: 'Backend', tone: 'neutral' }
    ]);

    try {
      const result = await apiClient.get('/api/v1/audit-logs?limit=100');
      helpers.renderIntroMetrics([
        { label: 'Audit log', value: String(result.logs.length), tone: 'accent' },
        { label: 'Access', value: 'Manager', tone: 'neutral' },
        { label: 'Source', value: 'Backend', tone: 'neutral' }
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
