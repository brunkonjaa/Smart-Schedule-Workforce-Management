window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.auditLogsUi = (function createAuditLogsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;
  const employeeSummaryUi = window.SmartSchedule.employeeSummaryUi;

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
      : date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'UTC',
          year: 'numeric'
        });
  };

  const getWeekStart = (dateValue) => {
    if (!dateValue) return null;
    const date = new Date(`${dateValue}T00:00:00Z`);
    const offset = (date.getUTCDay() || 7) - 1;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  };

  const getState = (log) => log.afterState || log.beforeState || {};

  const getStaffName = (state) => {
    const name = String(state?.fullName || '').trim();
    return name || '—';
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

  const getAccessAction = (action) => ({
    EMPLOYEE_SUMMARY_ACCESS_DENIED: 'Denied Employee Summary access',
    EMPLOYEE_SUMMARY_PRINT_REQUESTED: 'Requested Employee Summary print',
    EMPLOYEE_SUMMARY_VIEWED: 'Viewed Employee Summary'
  }[action] || action);

  const renderPagination = ({ label, onNext, onPrevious, pagination }) => {
    const paginationElement = helpers.createElement('nav', {
      className: 'audit-log-pagination',
      attributes: { 'aria-label': label }
    });
    const previous = helpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Previous',
      attributes: {
        disabled: !pagination.hasPrevious,
        type: 'button'
      }
    });
    previous.addEventListener('click', onPrevious);
    const pageText = helpers.createElement('span', {
      text: `${pagination.total} records · Page ${pagination.page} of ${pagination.totalPages}`
    });
    const next = helpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Next',
      attributes: {
        disabled: !pagination.hasNext,
        type: 'button'
      }
    });
    next.addEventListener('click', onNext);
    paginationElement.append(previous, pageText, next);
    return paginationElement;
  };

  const renderTabs = (state, actions) => {
    const tabs = helpers.createElement('div', {
      className: 'audit-log-tabs',
      attributes: { 'aria-label': 'Audit Log sections', role: 'tablist' }
    });
    [
      ['rota', 'Rota activity'],
      ['employee', 'Employee access']
    ].forEach(([value, label]) => {
      const active = state.tab === value;
      const button = helpers.createElement('button', {
        className: `audit-log-tab${active ? ' is-active' : ''}`,
        text: label,
        attributes: {
          'aria-selected': String(active),
          role: 'tab',
          type: 'button'
        }
      });
      button.addEventListener('click', () => actions.selectTab(value));
      tabs.appendChild(button);
    });
    return tabs;
  };

  const renderRotaActivity = (state, actions) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 audit-log-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Rota activity',
      'The existing shift and assignment changes remain in this section.'
    ));

    if (state.rotaLogs.length === 0) {
      panel.appendChild(helpers.createElement('p', {
        className: 'panel-copy',
        text: 'No rota activity has been recorded yet.'
      }));
    } else {
      const tableWrap = helpers.createElement('div', { className: 'table-wrap' });
      const table = helpers.createElement('table', {
        className: 'audit-log-table audit-log-table--rota'
      });
      const head = helpers.createElement('thead');
      const headRow = helpers.createElement('tr');
      ['When', 'Change', 'Manager', 'Staff member', 'Shift'].forEach((label) => {
        headRow.appendChild(helpers.createElement('th', { text: label }));
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = helpers.createElement('tbody');
      state.rotaLogs.forEach((log) => {
        const logState = getState(log);
        const row = helpers.createElement('tr');
        row.appendChild(helpers.createTableCell('When', formatDateTime(log.createdAt)));
        row.appendChild(helpers.createTableCell('Change', getReadableChange(log)));
        row.appendChild(helpers.createTableCell(
          'Manager',
          log.actorName || log.actorEmail || '—'
        ));
        const staffCell = helpers.createElement('td', {
          attributes: { 'data-label': 'Staff member' }
        });
        if (logState.staffProfileId) {
          staffCell.appendChild(employeeSummaryUi.createEmployeeLink({
            fullName: getStaffName(logState),
            source: 'audit-log',
            staffProfileId: logState.staffProfileId,
            weekStart: getWeekStart(logState.shiftDate)
          }));
        } else {
          staffCell.textContent = getStaffName(logState);
        }
        row.appendChild(staffCell);
        row.appendChild(helpers.createTableCell('Shift', getReadableShift(logState)));
        body.appendChild(row);
      });
      table.appendChild(body);
      tableWrap.appendChild(table);
      panel.appendChild(tableWrap);
    }

    panel.appendChild(renderPagination({
      label: 'Rota activity pages',
      onNext: () => actions.loadRotaPage(state.rotaPagination.page + 1),
      onPrevious: () => actions.loadRotaPage(state.rotaPagination.page - 1),
      pagination: state.rotaPagination
    }));
    return panel;
  };

  const renderEmployeeAccess = (state, actions) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 audit-log-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Employee access',
      'View, print-request and denied access events are append-only.'
    ));

    if (state.employeeLogs.length === 0) {
      panel.appendChild(helpers.createElement('p', {
        className: 'panel-copy',
        text: 'No Employee Summary access has been recorded yet. Opening a summary or requesting its print view creates the first record.'
      }));
    } else {
      const tableWrap = helpers.createElement('div', { className: 'table-wrap' });
      const table = helpers.createElement('table', {
        className: 'audit-log-table audit-log-table--employee-access'
      });
      const head = helpers.createElement('thead');
      const headRow = helpers.createElement('tr');
      ['When', 'Action', 'Account', 'Employee', 'Result', 'Source'].forEach((label) => {
        headRow.appendChild(helpers.createElement('th', { text: label }));
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = helpers.createElement('tbody');
      state.employeeLogs.forEach((log) => {
        const row = helpers.createElement('tr');
        row.appendChild(helpers.createTableCell('When', formatDateTime(log.createdAt)));
        row.appendChild(helpers.createTableCell('Action', getAccessAction(log.action)));
        row.appendChild(helpers.createTableCell(
          'Account',
          log.actorName || log.actorEmail || '—'
        ));
        row.appendChild(helpers.createTableCell(
          'Employee',
          log.targetEmployeeName || '—'
        ));
        row.appendChild(helpers.createTableCell('Result', helpers.formatStatus(log.result)));
        row.appendChild(helpers.createTableCell(
          'Source',
          log.source ? helpers.formatRole(log.source) : 'Direct address'
        ));
        body.appendChild(row);
      });
      table.appendChild(body);
      tableWrap.appendChild(table);
      panel.appendChild(tableWrap);
    }

    panel.appendChild(renderPagination({
      label: 'Employee access pages',
      onNext: () => actions.loadEmployeePage(state.pagination.page + 1),
      onPrevious: () => actions.loadEmployeePage(state.pagination.page - 1),
      pagination: state.pagination
    }));
    return panel;
  };

  const mount = async ({ page, workspaceElement }) => {
    if (page.id !== 'audit-logs') return;

    const state = {
      employeeLogs: [],
      loading: true,
      pagination: {
        hasNext: false,
        hasPrevious: false,
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 1
      },
      rotaLogs: [],
      rotaPagination: {
        hasNext: false,
        hasPrevious: false,
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 1
      },
      tab: 'rota'
    };

    const render = () => {
      workspaceElement.textContent = '';
      helpers.renderIntroMetrics([
        {
          label: state.tab === 'rota' ? 'Rota activity' : 'Employee access',
          value: state.loading
            ? 'Loading...'
            : String(state.tab === 'rota' ? state.rotaPagination.total : state.pagination.total),
          tone: 'accent'
        },
        { label: 'Access', value: 'Manager', tone: 'neutral' }
      ]);
      const grid = helpers.createElement('div', {
        className: 'workspace-grid workspace-grid--audit-log'
      });
      const tabPanel = helpers.createElement('section', {
        className: 'content-panel content-panel--span-16 audit-log-tabs-panel'
      });
      tabPanel.appendChild(renderTabs(state, actions));
      const information = helpers.createElement('details', {
        className: 'audit-log-information'
      });
      information.appendChild(helpers.createElement('summary', {
        text: 'About these records'
      }));
      information.appendChild(helpers.createElement('p', {
        text: 'Smart Schedule records rota changes and access to protected Employee Summaries. The records are append-only. Routine navigation and background refreshes are not recorded.'
      }));
      tabPanel.appendChild(information);
      grid.appendChild(tabPanel);

      if (state.loading) {
        grid.appendChild(helpers.createEmptyPanel(
          'Loading Audit Log',
          'Loading protected manager records.',
          'content-panel--span-16'
        ));
      } else {
        grid.appendChild(
          state.tab === 'rota'
            ? renderRotaActivity(state, actions)
            : renderEmployeeAccess(state, actions)
        );
      }
      workspaceElement.appendChild(grid);
    };

    const loadRotaPage = async (requestedPage) => {
      state.loading = true;
      render();
      try {
        const result = await apiClient.get(`/api/v1/audit-logs?page=${requestedPage}`);
        state.rotaLogs = result.logs;
        state.rotaPagination = result.pagination;
        state.loading = false;
        render();
      } catch (error) {
        state.loading = false;
        workspaceElement.textContent = '';
        const grid = helpers.createElement('div', {
          className: 'workspace-grid workspace-grid--audit-log'
        });
        grid.appendChild(helpers.createEmptyPanel(
          'Audit Log could not load',
          helpers.getErrorFeedback(error, 'Try again after signing in as a manager.').text,
          'content-panel--span-16'
        ));
        workspaceElement.appendChild(grid);
      }
    };

    const loadEmployeePage = async (requestedPage) => {
      state.loading = true;
      render();
      try {
        const result = await apiClient.get(
          `/api/v1/audit-logs/employee-access?page=${requestedPage}`
        );
        state.employeeLogs = result.logs;
        state.pagination = result.pagination;
        state.loading = false;
        render();
      } catch (error) {
        state.loading = false;
        render();
      }
    };

    const actions = {
      loadEmployeePage,
      loadRotaPage,
      selectTab: async (tab) => {
        if (tab === state.tab) return;
        state.tab = tab;
        if (tab === 'employee') {
          await loadEmployeePage(1);
        } else {
          await loadRotaPage(1);
        }
      }
    };

    await loadRotaPage(1);
  };

  return { mount };
})();
