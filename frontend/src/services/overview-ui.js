window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.overviewUi = (function createOverviewUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const isActiveRender = (workspaceElement, renderToken) => {
    return workspaceElement.dataset.renderToken === renderToken;
  };

  const createButton = (label, targetPage, tone = 'secondary') => {
    return uiHelpers.createElement('button', {
      className: `action-button button-${tone}`,
      text: label,
      attributes: {
        'data-target-page': targetPage,
        type: 'button'
      }
    });
  };

  const createDashboardPanel = (
    title,
    caption,
    rows,
    emptyText,
    targetPage,
    actionLabel = 'Open page',
    panelClassName = 'content-panel--span-8'
  ) => {
    const panel = uiHelpers.createElement('section', {
      className: `content-panel content-panel--summary ${panelClassName}`
    });
    panel.appendChild(uiHelpers.createPanelHeading(title, caption));

    if (rows.length === 0) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: emptyText }));
    } else {
      const list = uiHelpers.createElement('ul', { className: 'detail-list' });
      rows.forEach((row) => {
        list.appendChild(uiHelpers.createElement('li', { text: row }));
      });
      panel.appendChild(list);
    }

    const actions = uiHelpers.createElement('div', { className: 'actions-row' });
    actions.appendChild(createButton(actionLabel, targetPage, rows.length === 0 ? 'secondary' : 'ghost'));
    panel.appendChild(actions);
    return panel;
  };

  const createSignInPanel = (workspaceElement) => {
    workspaceElement.textContent = '';

    uiHelpers.renderIntroMetrics([
      { label: 'Sign in', value: 'Needed', tone: 'accent' },
      { label: 'Page', value: 'Locked', tone: 'neutral' },
      { label: 'Account', value: 'Work', tone: 'neutral' }
    ]);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--empty content-panel--span-16'
    });
    const emptyState = uiHelpers.createElement('div', { className: 'empty-state' });
    emptyState.appendChild(uiHelpers.createElement('h3', { text: 'Sign in to see this week' }));
    emptyState.appendChild(
      uiHelpers.createElement('p', {
        text: 'Use your work account first. Then the app shows the pages you can use.'
      })
    );
    emptyState.appendChild(createButton('Go to login', 'login', 'primary'));
    panel.appendChild(emptyState);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const loadManagerDashboard = async (weekStart) => {
    const [staffResult, leaveResult, shiftResult] = await Promise.all([
      apiClient.get('/api/v1/staff?status=ALL'),
      apiClient.get('/api/v1/leave-requests?status=ALL'),
      apiClient.get(`/api/v1/shifts?weekStart=${weekStart}`)
    ]);

    const activeStaff = staffResult.staff.filter((staff) => staff.isActive);
    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');
    const openShifts = shiftResult.shifts.filter((shift) => shift.status === 'OPEN');

    return {
      activeStaff,
      openShifts,
      pendingLeave,
      recentLeave: pendingLeave.slice(0, 4),
      shifts: shiftResult.shifts
    };
  };

  const loadStaffDashboard = async () => {
    const leaveResult = await apiClient.get('/api/v1/leave-requests?status=ALL');
    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');

    return {
      leaveRequests: leaveResult.leaveRequests,
      pendingLeave
    };
  };

  const renderManagerDashboard = (workspaceElement, weekStart, dashboard) => {
    workspaceElement.textContent = '';

    uiHelpers.renderIntroMetrics([
      { label: 'Time off waiting', value: String(dashboard.pendingLeave.length), tone: 'accent' },
      { label: 'Open shifts', value: String(dashboard.openShifts.length), tone: 'neutral' },
      { label: 'Active staff', value: String(dashboard.activeStaff.length), tone: 'neutral' }
    ]);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--overview-manager' });
    grid.appendChild(
      uiHelpers.createStepsPanel(
        'Start here',
        `Week starting ${weekStart}.`,
        [
          'Check time off first.',
          'Open the rota to change the week.'
        ],
        'overview-panel overview-panel--equal'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Time off waiting',
        'These still need a yes or no.',
        dashboard.recentLeave.map((request) => {
          return `${request.fullName || 'Staff member'}: ${request.startDate} to ${request.endDate} (${request.reason})`;
        }),
        'No time off requests are waiting right now.',
        'leave',
        'Open time off',
        'overview-panel'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Open shifts this week',
        'Open the rota and use the * menu to place someone on them.',
        dashboard.openShifts.slice(0, 4).map((shift) => {
          return `${shift.shiftDate} ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)} needs ${uiHelpers.formatRole(shift.requiredRole)}`;
        }),
        'No open shifts found for this week.',
        'rota',
        'Open rota',
        'overview-panel'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Rota',
        'Open the rota to change names or times.',
        [
          'Use the * button inside the rota.',
          'Open shifts stay at the top until they are filled.'
        ],
        'The rota is now the main screen after login.',
        'rota',
        'Open rota',
        'overview-panel'
      )
    );

    workspaceElement.appendChild(grid);
  };

  const renderStaffDashboard = (workspaceElement, weekStart, dashboard) => {
    workspaceElement.textContent = '';

    const approvedLeaveCount = dashboard.leaveRequests.filter((request) => request.status === 'APPROVED').length;

    uiHelpers.renderIntroMetrics([
      { label: 'My rota', value: 'View', tone: 'accent' },
      { label: 'Time off waiting', value: String(dashboard.pendingLeave.length), tone: 'neutral' },
      { label: 'Time off approved', value: String(approvedLeaveCount), tone: 'neutral' }
    ]);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
    grid.appendChild(
      uiHelpers.createStepsPanel(
        'My week',
        `Week starting ${weekStart}.`,
        [
          'Check your rota first.',
          'Open time off only if you need a day away.'
        ],
        'content-panel--span-16'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'My time off',
        'This shows whether your time off was approved.',
        dashboard.leaveRequests.slice(0, 5).map((request) => {
          return `${request.startDate} to ${request.endDate}: ${uiHelpers.formatStatus(request.status)}`;
        }),
        'You have not asked for time off yet.',
        'leave',
        'Ask for time off'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Weekly rota',
        'Open the rota to check your shift and who else is working.',
        [
          'Your own shift still has the * option.',
          'The full team rota shows there as well.'
        ],
        'Your rota is empty for this week.',
        'rota',
        'Open rota'
      )
    );

    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'overview') {
      return;
    }

    const weekStart = uiHelpers.getCurrentWeekStart();

    workspaceElement.textContent = '';
    uiHelpers.renderIntroMetrics([
      { label: 'This week', value: 'Loading...', tone: 'accent' },
      { label: 'Week start', value: weekStart, tone: 'neutral' },
      { label: 'Page', value: 'Checking', tone: 'neutral' }
    ]);

    try {
      const sessionResult = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      if (sessionResult.user.role === 'MANAGER') {
        const dashboard = await loadManagerDashboard(weekStart);
        if (isActiveRender(workspaceElement, renderToken)) {
          renderManagerDashboard(workspaceElement, weekStart, dashboard);
        }
        return;
      }

      const dashboard = await loadStaffDashboard(weekStart);
      if (isActiveRender(workspaceElement, renderToken)) {
        renderStaffDashboard(workspaceElement, weekStart, dashboard);
      }
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      if (error.status === 401) {
        createSignInPanel(workspaceElement);
        return;
      }

      uiHelpers.renderIntroMetrics([
        { label: 'This week', value: 'Error', tone: 'accent' },
        { label: 'Week start', value: weekStart, tone: 'neutral' },
        { label: 'Live data', value: 'Problem', tone: 'neutral' }
      ]);

      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      grid.appendChild(
        uiHelpers.createEmptyPanel(
          'This week could not load',
          'Try signing in again or reload the page.',
          'content-panel--span-16',
          {
            label: 'Go to login',
            targetPage: 'login',
            tone: 'primary'
          }
        )
      );
      workspaceElement.appendChild(grid);
    }
  };

  return {
    mount
  };
})();
