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

  const formatWeekLabel = (week) => {
    const format = (dateValue) => `${dateValue.slice(8, 10)}/${dateValue.slice(5, 7)}/${dateValue.slice(0, 4)}`;
    return `${format(week.weekStart)} - ${format(week.weekEnd)}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue || dateValue.length < 10) return dateValue || '';
    return `${dateValue.slice(8, 10)}/${dateValue.slice(5, 7)}/${dateValue.slice(0, 4)}`;
  };

  const createStaffHistorySection = (weeks, weekStart) => {
    const section = uiHelpers.createElement('section', {
      className: 'content-panel overview-staff-history-card'
    });
    section.appendChild(uiHelpers.createElement('p', { className: 'intro-kicker', text: 'My work' }));
    section.appendChild(uiHelpers.createElement('h2', { text: 'Your schedule history' }));
    section.appendChild(uiHelpers.createElement('p', {
      className: 'intro-summary',
      text: `Current week starts ${formatDate(weekStart)}. Previous worked weeks are shown below.`
    }));
    const historyGrid = uiHelpers.createElement('div', { className: 'staff-history-grid' });

    if (weeks.length === 0) {
      historyGrid.appendChild(uiHelpers.createElement('p', {
        className: 'panel-copy',
        text: 'Previous weeks will appear here after you have worked assigned shifts.'
      }));
    } else {
      weeks.forEach((week) => {
        const card = uiHelpers.createElement('article', { className: 'staff-history-card' });
        const heading = uiHelpers.createElement('div', { className: 'staff-history-card-heading' });
        heading.appendChild(uiHelpers.createElement('div', {
          className: 'staff-history-week',
          text: formatWeekLabel(week)
        }));
        heading.appendChild(uiHelpers.createElement('strong', {
          className: 'staff-history-hours',
          text: `${week.hours} hours`
        }));
        card.appendChild(heading);
        const shiftList = uiHelpers.createElement('div', { className: 'staff-history-shifts' });
        week.shifts.forEach((shift) => {
          shiftList.appendChild(uiHelpers.createElement('span', {
            className: 'staff-history-shift',
            text: `${shift.day} ${shift.startTime}-${shift.endTime}`
          }));
        });
        card.appendChild(shiftList);
        historyGrid.appendChild(card);
      });
    }

    section.appendChild(historyGrid);
    return section;
  };

  const createStaffSwapSection = (requests, sessionUser, onAccept) => {
    const section = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-8 staff-swap-section'
    });
    section.appendChild(uiHelpers.createPanelHeading(
      'Swap requests',
      'Requests connected to your future shifts.'
    ));
    const list = uiHelpers.createElement('div', { className: 'staff-swap-list' });

    if (requests.length === 0) {
      list.appendChild(uiHelpers.createElement('p', {
        className: 'panel-copy',
        text: 'No swap requests are waiting.'
      }));
    } else {
      requests.forEach((request) => {
        const item = uiHelpers.createElement('article', { className: 'staff-swap-item' });
        item.appendChild(uiHelpers.createElement('strong', {
          text: `${formatDate(request.shiftDate)} · ${request.shiftStartTime.slice(0, 5)}-${request.shiftEndTime.slice(0, 5)}`
        }));
        item.appendChild(uiHelpers.createElement('span', {
          className: 'staff-swap-item-copy',
          text: request.requesterStaffProfileId === sessionUser.staffProfileId
            ? `Your request · ${request.status.toLowerCase()}`
            : `${request.requesterName} · ${request.status.toLowerCase()}`
        }));
        const canAccept = request.status === 'PENDING' &&
          request.requesterStaffProfileId !== sessionUser.staffProfileId &&
          (!request.targetStaffProfileId || request.targetStaffProfileId === sessionUser.staffProfileId);
        if (canAccept) {
          const acceptButton = uiHelpers.createElement('button', {
            className: 'action-button button-secondary',
            text: 'Accept swap',
            attributes: { type: 'button' }
          });
          acceptButton.addEventListener('click', () => onAccept(request.id, acceptButton));
          item.appendChild(acceptButton);
        }
        list.appendChild(item);
      });
    }

    section.appendChild(list);
    const actions = uiHelpers.createElement('div', { className: 'actions-row' });
    actions.appendChild(createButton('Open swap requests', 'swap-requests', 'ghost'));
    section.appendChild(actions);
    return section;
  };

  const createManagerSummarySection = (weekStart, openShifts) => {
    const section = uiHelpers.createElement('section', {
      className: 'content-panel overview-manager-summary-card'
    });
    section.appendChild(uiHelpers.createElement('p', { className: 'intro-kicker', text: 'Manager view' }));
    section.appendChild(uiHelpers.createElement('h2', { text: 'Weekly rota overview' }));
    section.appendChild(uiHelpers.createElement('p', {
      className: 'intro-summary',
      text: `Week starting ${formatDate(weekStart)}. Check requests first, then open the rota to fill any gaps.`
    }));

    const summaryGrid = uiHelpers.createElement('div', { className: 'overview-manager-summary-grid' });
    const startBlock = uiHelpers.createElement('div', { className: 'overview-manager-summary-block' });
    startBlock.appendChild(uiHelpers.createElement('h3', { text: 'Start here' }));
    const steps = uiHelpers.createElement('ol', { className: 'step-list' });
    ['Check time off, password, and swap requests.', 'Open the rota to change the week or fill open shifts.'].forEach((text, index) => {
      const item = uiHelpers.createElement('li', { className: 'step-item' });
      item.appendChild(uiHelpers.createElement('span', { className: 'step-marker', text: String(index + 1) }));
      item.appendChild(uiHelpers.createElement('span', { text }));
      steps.appendChild(item);
    });
    startBlock.appendChild(steps);
    summaryGrid.appendChild(startBlock);

    const openBlock = uiHelpers.createElement('div', { className: 'overview-manager-summary-block' });
    openBlock.appendChild(uiHelpers.createElement('h3', { text: 'Open shifts this week' }));
    if (openShifts.length === 0) {
      openBlock.appendChild(uiHelpers.createElement('p', {
        className: 'panel-copy',
        text: 'No open shifts found for this week.'
      }));
    } else {
      const list = uiHelpers.createElement('ul', { className: 'detail-list' });
      openShifts.slice(0, 4).forEach((shift) => {
        list.appendChild(uiHelpers.createElement('li', {
          text: `${formatDate(shift.shiftDate)} ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)} needs ${uiHelpers.formatRole(shift.requiredRole)}`
        }));
      });
      openBlock.appendChild(list);
    }
    const actions = uiHelpers.createElement('div', { className: 'actions-row' });
    actions.appendChild(createButton('Open rota', 'rota', 'ghost'));
    openBlock.appendChild(actions);
    summaryGrid.appendChild(openBlock);
    section.appendChild(summaryGrid);
    return section;
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
    const [staffResult, leaveResult, shiftResult, passwordResult, swapResult] = await Promise.all([
      apiClient.get('/api/v1/staff?status=ALL'),
      apiClient.get('/api/v1/leave-requests?status=ALL'),
      apiClient.get(`/api/v1/shifts?weekStart=${weekStart}`),
      apiClient.get('/api/v1/auth/password-reset/requests'),
      apiClient.get('/api/v1/shift-swaps')
    ]);

    const activeStaff = staffResult.staff.filter((staff) => staff.isActive);
    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');
    const openShifts = shiftResult.shifts.filter((shift) => shift.status === 'OPEN');

    return {
      activeStaff,
      openShifts,
      pendingLeave,
      passwordResetRequests: passwordResult.requests,
      recentLeave: pendingLeave.slice(0, 4),
      shifts: shiftResult.shifts,
      swapRequests: swapResult.requests
    };
  };

  const loadStaffDashboard = async () => {
    const [leaveResult, historyResult, swapResult] = await Promise.all([
      apiClient.get('/api/v1/leave-requests?status=ALL'),
      apiClient.get('/api/v1/rota/history'),
      apiClient.get('/api/v1/shift-swaps')
    ]);
    const pendingLeave = leaveResult.leaveRequests.filter((request) => request.status === 'PENDING');

    return {
      history: historyResult.weeks,
      leaveRequests: leaveResult.leaveRequests,
      pendingLeave,
      swapRequests: swapResult.requests
    };
  };

  const renderManagerDashboard = (workspaceElement, weekStart, dashboard) => {
    workspaceElement.textContent = '';

    uiHelpers.renderIntroMetrics([
      { label: 'Time off waiting', value: String(dashboard.pendingLeave.length), tone: 'accent' },
      { label: 'Open shifts', value: String(dashboard.openShifts.length), tone: 'neutral' },
      { label: 'Password requests', value: String(dashboard.passwordResetRequests.length), tone: 'neutral' }
    ]);

    const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--manager-overview' });
    grid.appendChild(createManagerSummarySection(weekStart, dashboard.openShifts));
    const sideColumn = uiHelpers.createElement('div', { className: 'manager-overview-side-column' });
    sideColumn.appendChild(createDashboardPanel(
        'Password Requests',
        'Recent recovery requests from active staff accounts.',
        dashboard.passwordResetRequests.slice(0, 4).map((request) => {
          return `${request.fullName || request.email}: ${new Date(request.createdAt).toLocaleString()}`;
        }),
        'No password requests are waiting.',
        'overview',
        'Refresh overview',
        'manager-overview-panel'
      ));
    sideColumn.appendChild(createDashboardPanel(
        'Shift swaps',
        'Requests waiting for a staff member or manager decision.',
        dashboard.swapRequests.slice(0, 4).map((request) => {
          return `${request.requesterName}: ${formatDate(request.shiftDate)} ${request.shiftStartTime.slice(0, 5)}-${request.shiftEndTime.slice(0, 5)} (${request.status})`;
        }),
        'No shift swap requests are waiting.',
        'swap-requests',
        'Open swap requests',
        'manager-overview-panel'
      ));
    sideColumn.appendChild(createDashboardPanel(
        'Time off waiting',
        'These still need a yes or no.',
        dashboard.recentLeave.map((request) => {
          return `${request.fullName || 'Staff member'}: ${request.startDate} to ${request.endDate} (${request.reason})`;
        }),
        'No time off requests are waiting right now.',
        'leave',
        'Open time off',
        'manager-overview-panel'
      ));
    sideColumn.appendChild(uiHelpers.createElement('button', {
      className: 'content-panel overview-rota-link-card',
      text: 'Back to main Rota',
      attributes: {
        'aria-label': 'Back to main Rota',
        'data-target-page': 'rota',
        type: 'button'
      }
    }));
    grid.appendChild(sideColumn);
    workspaceElement.appendChild(grid);
  };

  const renderStaffDashboard = (workspaceElement, weekStart, dashboard, sessionUser, onAcceptSwap) => {
    workspaceElement.textContent = '';
    const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--staff-overview' });
    grid.appendChild(createStaffHistorySection(dashboard.history, weekStart));
    const sideColumn = uiHelpers.createElement('div', { className: 'staff-overview-side-column' });
    sideColumn.appendChild(createStaffSwapSection(dashboard.swapRequests, sessionUser, onAcceptSwap));
    sideColumn.appendChild(createDashboardPanel(
      'Time off',
      'Your leave requests and decisions.',
      dashboard.leaveRequests.slice(0, 4).map((request) => `${formatDate(request.startDate)} to ${formatDate(request.endDate)}: ${uiHelpers.formatStatus(request.status)}`),
      'You have not asked for time off yet.',
      'leave',
      'Open time off',
      'content-panel--span-8 staff-time-off-section'
    ));
    sideColumn.appendChild(uiHelpers.createElement('button', {
      className: 'content-panel overview-rota-link-card',
      text: 'Back to main Rota',
      attributes: {
        'aria-label': 'Back to main Rota',
        'data-target-page': 'rota',
        type: 'button'
      }
    }));
    grid.appendChild(sideColumn);
    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'overview') {
      return;
    }

    const weekStart = uiHelpers.getCurrentWeekStart();

    workspaceElement.textContent = '';
    uiHelpers.renderIntroMetrics([
      { label: 'Overview', value: 'Loading...', tone: 'accent' },
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
        const refresh = async (swapId, button) => {
          button.disabled = true;
          button.textContent = 'Accepting...';
          try {
            await apiClient.post(`/api/v1/shift-swaps/${swapId}/accept`, {});
            const refreshed = await loadStaffDashboard(weekStart);
            renderStaffDashboard(workspaceElement, weekStart, refreshed, sessionResult.user, refresh);
          } catch (error) {
            button.disabled = false;
            button.textContent = error.message || 'Could not accept';
          }
        };
        renderStaffDashboard(workspaceElement, weekStart, dashboard, sessionResult.user, refresh);
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
        { label: 'Overview', value: 'Error', tone: 'accent' },
        { label: 'Week start', value: weekStart, tone: 'neutral' },
        { label: 'Live data', value: 'Problem', tone: 'neutral' }
      ]);

      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      grid.appendChild(
        uiHelpers.createEmptyPanel(
          'Overview could not load',
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
