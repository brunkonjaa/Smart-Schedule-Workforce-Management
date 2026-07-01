window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.overviewUi = (function createOverviewUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const getDayLabel = (dayOfWeek) => {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOfWeek - 1] || String(dayOfWeek);
  };

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

  const createDashboardPanel = (title, caption, rows, emptyText, targetPage, actionLabel = 'Open page') => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-8'
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

    const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
    metrics.appendChild(uiHelpers.createMetric('Dashboard', 'Sign in', 'accent'));
    metrics.appendChild(uiHelpers.createMetric('Live data', 'Locked'));
    metrics.appendChild(uiHelpers.createMetric('Role', 'Unknown'));
    workspaceElement.appendChild(metrics);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--empty content-panel--span-16'
    });
    const emptyState = uiHelpers.createElement('div', { className: 'empty-state' });
    emptyState.appendChild(uiHelpers.createElement('h3', { text: 'Sign in to see the live dashboard' }));
    emptyState.appendChild(
      uiHelpers.createElement('p', {
        text: 'The dashboard uses the real staff, leave, availability, and shift routes, so it needs a signed-in account first.'
      })
    );
    emptyState.appendChild(createButton('Go to login', 'login', 'primary'));
    panel.appendChild(emptyState);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const loadManagerDashboard = async (weekStart) => {
    const [staffResult, leaveResult, availabilityResult, shiftResult] = await Promise.all([
      apiClient.get('/api/v1/staff?status=ALL'),
      apiClient.get('/api/v1/leave-requests?status=ALL'),
      apiClient.get(`/api/v1/availability?weekStart=${weekStart}`),
      apiClient.get(`/api/v1/shifts?weekStart=${weekStart}`)
    ]);

    const activeStaff = staffResult.staff.filter((staff) => staff.isActive);
    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');
    const openShifts = shiftResult.shifts.filter((shift) => shift.status === 'OPEN');
    const staffWithAvailability = new Set(
      availabilityResult.availability.map((entry) => entry.staffProfileId)
    );
    const missingAvailabilityCount = Math.max(activeStaff.length - staffWithAvailability.size, 0);

    return {
      activeStaff,
      availability: availabilityResult.availability,
      missingAvailabilityCount,
      openShifts,
      pendingLeave,
      recentLeave: pendingLeave.slice(0, 4),
      shifts: shiftResult.shifts
    };
  };

  const loadStaffDashboard = async (weekStart) => {
    const [leaveResult, availabilityResult] = await Promise.all([
      apiClient.get('/api/v1/leave-requests?status=ALL'),
      apiClient.get(`/api/v1/availability?weekStart=${weekStart}`)
    ]);

    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');

    return {
      availability: availabilityResult.availability,
      leaveRequests: leaveResult.leaveRequests,
      pendingLeave
    };
  };

  const renderManagerDashboard = (workspaceElement, weekStart, dashboard) => {
    workspaceElement.textContent = '';

    const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
    metrics.appendChild(uiHelpers.createMetric('Pending leave', String(dashboard.pendingLeave.length), 'accent'));
    metrics.appendChild(uiHelpers.createMetric('Open shifts', String(dashboard.openShifts.length)));
    metrics.appendChild(uiHelpers.createMetric('Missing availability', String(dashboard.missingAvailabilityCount)));
    workspaceElement.appendChild(metrics);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
    grid.appendChild(
      uiHelpers.createStepsPanel(
        'Manager dashboard',
        `Live summary for the week starting ${weekStart}.`,
        [
          'Check leave requests before final planning.',
          'Check missing availability before creating more shifts.',
          'Use open shifts to decide what still needs staff.'
        ],
        'content-panel--span-16'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Leave waiting for manager',
        'These requests still need a decision.',
        dashboard.recentLeave.map((request) => {
          return `${request.fullName || 'Staff member'}: ${request.startDate} to ${request.endDate} (${request.reason})`;
        }),
        'No leave requests are waiting right now.',
        'leave',
        'Open leave'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Open shifts this week',
        'These shifts exist but are not fully handled yet.',
        dashboard.openShifts.slice(0, 4).map((shift) => {
          return `${shift.shiftDate} ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)} needs ${uiHelpers.formatRole(shift.requiredRole)}`;
        }),
        'No open shifts found for this week.',
        'shifts',
        'Create shift'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Availability check',
        'Use this before building or changing shifts.',
        [
          `${dashboard.availability.length} availability entries saved for this week.`,
          `${dashboard.missingAvailabilityCount} active staff still have no entry this week.`
        ],
        'No availability has been added for this week yet.',
        'availability',
        'Check availability'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Rota boundary',
        'The dashboard can show live planning inputs now.',
        [
          'Staff, leave, availability, shifts, assignments, and rota are live.',
          'Contract-hours warnings now show after assignment save. Audit logging still comes later.'
        ],
        'The rota is now the main screen after login.',
        'rota',
        'Open rota'
      )
    );

    workspaceElement.appendChild(grid);
  };

  const renderStaffDashboard = (workspaceElement, weekStart, dashboard) => {
    workspaceElement.textContent = '';

    const availabilityCount = dashboard.availability.length;
    const approvedLeaveCount = dashboard.leaveRequests.filter((request) => request.status === 'APPROVED').length;

    const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
    metrics.appendChild(uiHelpers.createMetric('My availability', String(availabilityCount), 'accent'));
    metrics.appendChild(uiHelpers.createMetric('Leave waiting', String(dashboard.pendingLeave.length)));
    metrics.appendChild(uiHelpers.createMetric('Approved leave', String(approvedLeaveCount)));
    workspaceElement.appendChild(metrics);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
    grid.appendChild(
      uiHelpers.createStepsPanel(
        'My week',
        `Live summary for the week starting ${weekStart}.`,
        [
          'Check if your availability is saved for this week.',
          'Look at leave requests that are still waiting.',
          'Use the leave and availability pages when something changes.'
        ],
        'content-panel--span-16'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'My availability',
        'These are the times saved for the selected week.',
        dashboard.availability.slice(0, 5).map((entry) => {
          return `${getDayLabel(entry.dayOfWeek)} ${entry.startTime.slice(0, 5)}-${entry.endTime.slice(0, 5)}: ${uiHelpers.formatStatus(entry.status)}`;
        }),
        'You have not added availability for this week yet.',
        'availability',
        'Add availability'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'My leave requests',
        'This shows your current leave request status.',
        dashboard.leaveRequests.slice(0, 5).map((request) => {
          return `${request.startDate} to ${request.endDate}: ${uiHelpers.formatStatus(request.status)}`;
        }),
        'You have not sent any leave requests yet.',
        'leave',
        'Ask for leave'
      )
    );

    grid.appendChild(
      createDashboardPanel(
        'Assigned shifts',
        'This now opens the live rota view for the selected week.',
        [
          'Live availability, leave, assignments, and rota records are connected.',
          'Staff can use the rota page for read-only shift visibility.'
        ],
        'No assigned-shift feed is available yet.',
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
    const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
    metrics.appendChild(uiHelpers.createMetric('Dashboard', 'Loading...', 'accent'));
    metrics.appendChild(uiHelpers.createMetric('Week start', weekStart));
    metrics.appendChild(uiHelpers.createMetric('Live data', 'Checking'));
    workspaceElement.appendChild(metrics);

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

      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      grid.appendChild(
        uiHelpers.createEmptyPanel(
          'Dashboard could not load',
          'One of the live summary routes could not be read. Try signing in again or reload the page.',
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
