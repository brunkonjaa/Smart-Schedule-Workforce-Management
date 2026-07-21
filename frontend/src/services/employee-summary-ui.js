window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.employeeSummaryUi = (function createEmployeeSummaryUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;
  const previewState = window.SmartSchedule.previewState;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const routePattern = /^staff\/([0-9a-f-]+)\/summary$/i;
  const sourceDetails = {
    'audit-log': { api: 'audit-log', page: 'audit-logs' },
    direct: { api: 'direct', page: 'staff' },
    rota: { api: 'rota', page: 'rota' },
    staff: { api: 'staff', page: 'staff' },
    'swap-requests': { api: 'swap-requests', page: 'swap-requests' },
    'time-off': { api: 'time-off', page: 'leave' }
  };
  let currentRouteKey = null;
  let internalOpenPending = false;
  let panelState = null;
  let resumeCheckBound = false;

  const createElement = (tagName, options = {}) => {
    return helpers.createElement(tagName, options);
  };

  const getHashParts = (hashValue = window.location.hash) => {
    const normalized = String(hashValue || '').replace(/^#\/?/, '');
    const [path, query = ''] = normalized.split('?');
    return { path, query };
  };

  const parseRoute = (hashValue = window.location.hash) => {
    const { path, query } = getHashParts(hashValue);
    const match = routePattern.exec(path);

    if (!match || !uuidPattern.test(match[1])) {
      return null;
    }

    const parameters = new URLSearchParams(query);
    const requestedSource = String(parameters.get('from') || 'direct').toLowerCase();
    const source = sourceDetails[requestedSource] ? requestedSource : 'direct';
    const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(parameters.get('week') || '')
      ? parameters.get('week')
      : null;
    const department = /^(ALL|BAR|FLOOR|KITCHEN|OTHER)$/i.test(
      parameters.get('department') || ''
    )
      ? parameters.get('department').toUpperCase()
      : null;
    const scrollValue = Number(parameters.get('scroll'));

    return {
      department,
      source,
      sourcePage: sourceDetails[source].page,
      staffId: match[1],
      scrollY: Number.isFinite(scrollValue) && scrollValue >= 0 ? scrollValue : 0,
      weekStart
    };
  };

  const buildSummaryHref = ({
    department = null,
    source = 'staff',
    staffProfileId,
    weekStart = null
  }) => {
    const safeSource = sourceDetails[source] ? source : 'staff';
    const parameters = new URLSearchParams({ from: safeSource });

    if (weekStart) {
      parameters.set('week', weekStart);
    }

    if (department) {
      parameters.set('department', department);
    }

    return `#staff/${staffProfileId}/summary?${parameters.toString()}`;
  };

  const createEmployeeLink = ({
    className = 'employee-summary-link',
    department = null,
    fullName,
    source = 'staff',
    staffProfileId,
    weekStart = null
  }) => {
    return createElement('a', {
      className,
      text: fullName || 'Employee',
      attributes: {
        'data-department': department || '',
        'data-employee-summary-link': 'true',
        'data-source': source,
        'data-staff-id': staffProfileId,
        'data-week-start': weekStart || '',
        href: buildSummaryHref({
          department,
          source,
          staffProfileId,
          weekStart
        })
      }
    });
  };

  const updateSourceContextBeforeOpen = (link) => {
    const scrollY = Math.max(0, Math.round(window.scrollY));
    const sourceContext = {
      department: link.dataset.department || null,
      focusStaffId: link.dataset.staffId,
      scrollY,
      weekStart: link.dataset.weekStart || null
    };
    const href = new URL(link.href, window.location.href);
    const hashParts = getHashParts(href.hash);
    const parameters = new URLSearchParams(hashParts.query);
    parameters.set('scroll', String(scrollY));
    link.setAttribute('href', `#${hashParts.path}?${parameters.toString()}`);
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        smartScheduleSourceContext: sourceContext
      },
      '',
      window.location.href
    );
    previewState.set({
      ...previewState.get(),
      rotaDepartment: sourceContext.department,
      rotaWeekStart: sourceContext.weekStart,
      summaryReturnFocusStaffId: sourceContext.focusStaffId
    });
    internalOpenPending = true;
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-employee-summary-link="true"]');

    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    updateSourceContextBeforeOpen(link);
  }, true);

  const setSourceInactive = (inactive) => {
    const appShell = document.querySelector('.app-shell');

    if (!appShell) {
      return;
    }

    if (inactive) {
      appShell.setAttribute('aria-hidden', 'true');
      appShell.inert = true;
      document.body.classList.add('employee-summary-open');
      return;
    }

    appShell.removeAttribute('aria-hidden');
    appShell.inert = false;
    document.body.classList.remove('employee-summary-open');
  };

  const getFocusableElements = (container) => {
    return Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), details > summary, [tabindex]:not([tabindex="-1"])'
    )).filter((element) => {
      return !element.hidden && element.getAttribute('aria-hidden') !== 'true';
    });
  };

  const closePanelDom = ({ restoreContext = true } = {}) => {
    const state = panelState;
    document.getElementById('employee-summary-host')?.remove();
    panelState = null;
    currentRouteKey = null;
    setSourceInactive(false);

    if (!restoreContext) {
      return;
    }

    const sourceContext = window.history.state?.smartScheduleSourceContext;
    window.setTimeout(() => {
      if (sourceContext && Number.isFinite(sourceContext.scrollY)) {
        window.scrollTo({ left: 0, top: sourceContext.scrollY, behavior: 'instant' });
      }

      const focusStaffId = sourceContext?.focusStaffId || state?.route?.staffId;
      if (focusStaffId) {
        document.querySelector(
          `[data-employee-summary-link="true"][data-staff-id="${focusStaffId}"]`
        )?.focus();
      }
    }, 0);
  };

  const dispatchRouteRender = () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const replaceHash = (hashValue) => {
    window.history.replaceState(null, '', hashValue);
    dispatchRouteRender();
  };

  const requestClose = () => {
    if (window.history.state?.smartScheduleEmployeeSummary === true) {
      window.history.back();
      return;
    }

    closePanelDom({ restoreContext: false });
    replaceHash('#staff');
  };

  const ensurePanel = (route) => {
    let host = document.getElementById('employee-summary-host');

    if (host && panelState) {
      panelState.route = route;
      return panelState;
    }

    host = createElement('div', {
      className: 'employee-summary-host',
      attributes: { id: 'employee-summary-host' }
    });
    const backdrop = createElement('div', {
      className: 'employee-summary-backdrop',
      attributes: { 'aria-hidden': 'true' }
    });
    const panel = createElement('section', {
      className: 'employee-summary-panel',
      attributes: {
        'aria-labelledby': 'employee-summary-title',
        'aria-modal': 'true',
        role: 'dialog',
        tabindex: '-1'
      }
    });
    const header = createElement('header', { className: 'employee-summary-header' });
    const heading = createElement('div', { className: 'employee-summary-header-copy' });
    heading.appendChild(createElement('span', {
      className: 'employee-summary-eyebrow',
      text: 'Employee Summary'
    }));
    heading.appendChild(createElement('h2', {
      attributes: { id: 'employee-summary-title' },
      text: 'Employee Summary'
    }));
    const controls = createElement('div', { className: 'employee-summary-controls' });
    const backButton = createElement('button', {
      className: 'action-button button-ghost employee-summary-back',
      text: 'Back',
      attributes: { type: 'button' }
    });
    const printButton = createElement('button', {
      className: 'action-button button-secondary employee-summary-print',
      text: 'Print summary',
      attributes: { type: 'button' }
    });
    const closeButton = createElement('button', {
      className: 'employee-summary-close',
      text: 'Close',
      attributes: {
        'aria-label': 'Close Employee Summary',
        type: 'button'
      }
    });
    controls.append(backButton, printButton, closeButton);
    header.append(heading, controls);
    const notice = createElement('div', {
      className: 'employee-summary-notice',
      attributes: { 'aria-live': 'polite' }
    });
    const body = createElement('div', { className: 'employee-summary-body' });
    const footer = createElement('footer', {
      className: 'employee-summary-print-footer',
      text: ''
    });
    const cover = createElement('div', {
      className: 'employee-summary-verification-cover',
      attributes: {
        'aria-live': 'assertive',
        hidden: true
      }
    });
    panel.append(header, notice, body, footer, cover);
    host.append(backdrop, panel);
    document.body.appendChild(host);
    setSourceInactive(true);

    const state = {
      body,
      cover,
      footer,
      notice,
      panel,
      printButton,
      route,
      summary: null
    };
    panelState = state;

    backButton.addEventListener('click', requestClose);
    closeButton.addEventListener('click', requestClose);
    backdrop.addEventListener('click', (event) => event.preventDefault());
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    printButton.addEventListener('click', () => requestPrint(state));
    window.requestAnimationFrame(() => panel.focus());
    return state;
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Date not retained';
    }

    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          timeZone: 'UTC',
          year: 'numeric'
        });
  };

  const formatHours = (value) => `${Number(value || 0).toFixed(2).replace(/\.00$/, '')} hrs`;
  const formatRole = (value) => helpers.formatRole(value || '');
  const formatStatus = (value) => helpers.formatStatus(value || '');
  const formatShiftTime = (record) => {
    if (!record.startTime || !record.endTime) {
      return 'Time not retained';
    }

    return `${record.startTime}-${record.endTime}`;
  };

  const appendDefinition = (list, label, value, className = '') => {
    list.appendChild(createElement('dt', { className, text: label }));
    list.appendChild(createElement('dd', { className, text: value || 'Not recorded' }));
  };

  const renderWeekHours = (week, headingText) => {
    const section = createElement('section', { className: 'employee-summary-week' });
    section.appendChild(createElement('h4', { text: headingText }));
    section.appendChild(createElement('p', {
      className: 'employee-summary-week-range',
      text: `${formatDate(week.weekStart)} to ${formatDate(week.weekEnd)}`
    }));
    const list = createElement('dl', { className: 'employee-summary-inline-details' });
    appendDefinition(list, 'Active assignment hours', formatHours(week.activeAssignmentHours));
    appendDefinition(list, 'Contracted weekly hours', formatHours(week.contractedWeeklyHours));
    appendDefinition(
      list,
      'Deleted or cancelled hours',
      formatHours(week.deletedOrCancelledAssignmentHours)
    );
    const difference = week.contractComparison.differenceHours;
    const comparisonText = difference === 0
      ? 'Matches contract'
      : `${formatHours(Math.abs(difference))} ${difference > 0 ? 'over' : 'under'} contract`;
    appendDefinition(list, 'Contract comparison', comparisonText);
    section.appendChild(list);
    return section;
  };

  const renderShiftList = (shifts, emptyText) => {
    if (!shifts.length) {
      return createElement('p', { className: 'employee-summary-empty', text: emptyText });
    }

    const list = createElement('ul', { className: 'employee-summary-list' });
    shifts.forEach((shift) => {
      const item = createElement('li');
      item.appendChild(createElement('strong', { text: formatDate(shift.shiftDate) }));
      item.appendChild(createElement('span', {
        text: `${formatShiftTime(shift)} · ${formatRole(shift.department)}`
      }));
      list.appendChild(item);
    });
    return list;
  };

  const createRecordLink = (hashValue, label) => {
    return createElement('a', {
      className: 'employee-summary-record-link',
      text: label,
      attributes: { href: hashValue }
    });
  };

  const renderTimeOffList = (records) => {
    if (!records.length) {
      return createElement('p', {
        className: 'employee-summary-empty',
        text: 'No requests in this group.'
      });
    }

    const list = createElement('ul', { className: 'employee-summary-list' });
    records.forEach((record) => {
      const item = createElement('li');
      item.appendChild(createRecordLink(
        `#leave?record=${encodeURIComponent(record.id)}`,
        `${formatDate(record.startDate)} to ${formatDate(record.endDate)}`
      ));
      item.appendChild(createElement('span', { text: formatStatus(record.status) }));
      item.appendChild(createElement('span', {
        className: 'employee-summary-screen-only employee-summary-free-text',
        text: record.reason || 'No reason recorded'
      }));
      list.appendChild(item);
    });
    return list;
  };

  const renderSwapList = (records) => {
    if (!records.length) {
      return createElement('p', {
        className: 'employee-summary-empty',
        text: 'No requests in this group.'
      });
    }

    const list = createElement('ul', { className: 'employee-summary-list' });
    records.forEach((record) => {
      const item = createElement('li');
      item.appendChild(createRecordLink(
        `#swap-requests?record=${encodeURIComponent(record.id)}`,
        `${formatDate(record.shiftDate)} · ${formatShiftTime(record)}`
      ));
      item.appendChild(createElement('span', {
        text: `${formatRole(record.department)} · ${formatStatus(record.status)}`
      }));
      if (record.otherEmployee) {
        item.appendChild(createElement('span', { text: `Other employee: ${record.otherEmployee}` }));
      }
      item.appendChild(createElement('span', {
        className: 'employee-summary-screen-only employee-summary-free-text',
        text: record.reason || 'No note recorded'
      }));
      list.appendChild(item);
    });
    return list;
  };

  const renderCompletedHistory = (title, content) => {
    const details = createElement('details', { className: 'employee-summary-completed' });
    details.appendChild(createElement('summary', {
      text: `${title} (10)`
    }));
    details.appendChild(content);
    return details;
  };

  const renderSummary = (state, summary) => {
    state.summary = summary;
    state.notice.textContent = '';
    state.body.textContent = '';
    const employee = summary.employee;
    const inactive = employee.accountStatus !== 'ACTIVE' || employee.employmentStatus !== 'ACTIVE';
    const identity = createElement('section', { className: 'employee-summary-identity' });
    const titleRow = createElement('div', { className: 'employee-summary-identity-title' });
    titleRow.appendChild(createElement('h3', { text: employee.fullName }));
    titleRow.appendChild(createElement('span', {
      className: `status-tag status-tag--${inactive ? 'muted' : 'success'}`,
      text: inactive ? 'Inactive employee' : 'Active employee'
    }));
    identity.appendChild(titleRow);
    identity.appendChild(createElement('p', {
      className: 'employee-summary-role-line',
      text: `${formatRole(employee.department)} · ${formatRole(employee.role)}`
    }));
    const contactDetails = createElement('dl', { className: 'employee-summary-details' });
    appendDefinition(contactDetails, 'Email', employee.email, 'employee-summary-print-excluded');
    appendDefinition(contactDetails, 'Phone', employee.phone, 'employee-summary-print-excluded');
    appendDefinition(contactDetails, 'Contracted weekly hours', formatHours(employee.contractedWeeklyHours));
    appendDefinition(contactDetails, 'Employment start date', formatDate(employee.employmentStartDate));
    appendDefinition(contactDetails, 'Account status', formatStatus(employee.accountStatus));
    appendDefinition(contactDetails, 'Employment status', formatStatus(employee.employmentStatus));
    identity.appendChild(contactDetails);
    state.body.appendChild(identity);

    const hoursSection = createElement('section', { className: 'employee-summary-section' });
    hoursSection.appendChild(createElement('h3', { text: 'Scheduled-hours comparison' }));
    hoursSection.appendChild(renderWeekHours(summary.hours.selectedRotaWeek, 'Selected rota week'));
    if (summary.hours.currentCalendarWeek) {
      hoursSection.appendChild(renderWeekHours(summary.hours.currentCalendarWeek, 'Current calendar week'));
    }
    const previousHeading = createElement('div', { className: 'employee-summary-subheading' });
    previousHeading.appendChild(createElement('h4', { text: 'Four previous completed weeks' }));
    previousHeading.appendChild(createElement('strong', {
      text: `Average: ${formatHours(summary.hours.fourPreviousCompletedWeekAverage)}`
    }));
    hoursSection.appendChild(previousHeading);
    summary.hours.previousCompletedWeeks.forEach((week) => {
      hoursSection.appendChild(renderWeekHours(week, `Week starting ${formatDate(week.weekStart)}`));
    });
    state.body.appendChild(hoursSection);

    const selectedAssignments = createElement('section', { className: 'employee-summary-section' });
    selectedAssignments.appendChild(createElement('h3', { text: 'Selected rota week' }));
    selectedAssignments.appendChild(createElement('p', {
      className: 'employee-summary-section-copy',
      text: `${formatDate(summary.assignments.selectedWeek.weekStart)} to ${formatDate(summary.assignments.selectedWeek.weekEnd)}`
    }));
    selectedAssignments.appendChild(renderShiftList(
      summary.assignments.selectedWeek.shifts,
      'No active shifts are assigned in the selected rota week.'
    ));
    state.body.appendChild(selectedAssignments);

    const laterAssignments = createElement('section', { className: 'employee-summary-section' });
    laterAssignments.appendChild(createElement('h3', { text: 'Later upcoming shifts' }));
    laterAssignments.appendChild(renderShiftList(
      summary.assignments.laterUpcoming.shifts,
      'No later shifts are scheduled in the next 30 days.'
    ));
    state.body.appendChild(laterAssignments);

    const timeOffSection = createElement('section', { className: 'employee-summary-section' });
    timeOffSection.appendChild(createElement('h3', { text: 'Time Off requests' }));
    timeOffSection.appendChild(createElement('h4', { text: 'Waiting or active' }));
    timeOffSection.appendChild(renderTimeOffList(summary.timeOff.waitingOrActive));
    timeOffSection.appendChild(renderCompletedHistory(
      'Show recent completed requests',
      renderTimeOffList(summary.timeOff.completed)
    ));
    state.body.appendChild(timeOffSection);

    const swapsSection = createElement('section', { className: 'employee-summary-section' });
    swapsSection.appendChild(createElement('h3', { text: 'Swap Requests' }));
    swapsSection.appendChild(createElement('h4', { text: 'Waiting or active' }));
    swapsSection.appendChild(renderSwapList(summary.swapRequests.waitingOrActive));
    swapsSection.appendChild(renderCompletedHistory(
      'Show recent completed requests',
      renderSwapList(summary.swapRequests.completed)
    ));
    state.body.appendChild(swapsSection);

    const inactiveSection = createElement('section', { className: 'employee-summary-section' });
    inactiveSection.appendChild(createElement('h3', { text: 'Deleted or cancelled assignments' }));
    if (!summary.deletedOrCancelledAssignments.length) {
      inactiveSection.appendChild(createElement('p', {
        className: 'employee-summary-empty',
        text: 'No deleted or cancelled assignments were retained.'
      }));
    } else {
      const list = createElement('ul', { className: 'employee-summary-list' });
      summary.deletedOrCancelledAssignments.forEach((record) => {
        const item = createElement('li');
        item.appendChild(createElement('strong', {
          text: record.shiftDate ? formatDate(record.shiftDate) : formatStatus(record.status)
        }));
        if (record.detailsRetained) {
          item.appendChild(createElement('span', {
            text: `${formatShiftTime(record)} · ${formatRole(record.department)} · ${formatStatus(record.status)}`
          }));
        } else {
          const retained = [
            record.startTime && record.endTime ? formatShiftTime(record) : null,
            record.department ? formatRole(record.department) : null,
            formatStatus(record.status)
          ].filter(Boolean).join(' · ');
          item.appendChild(createElement('span', { text: retained }));
          item.appendChild(createElement('span', {
            className: 'employee-summary-retention-note',
            text: 'Further shift details were not retained'
          }));
        }
        list.appendChild(item);
      });
      inactiveSection.appendChild(list);
    }
    state.body.appendChild(inactiveSection);

    const recordSection = createElement('section', {
      className: 'employee-summary-section employee-summary-screen-only'
    });
    recordSection.appendChild(createRecordLink(
      `#staff?record=${encodeURIComponent(employee.id)}`,
      'Open full Staff record'
    ));
    state.body.appendChild(recordSection);
  };

  const renderLoading = (state) => {
    state.summary = null;
    state.body.textContent = '';
    state.body.appendChild(createElement('div', {
      className: 'employee-summary-loading',
      text: 'Loading Employee Summary...'
    }));
  };

  const renderFailure = (state, title, message, retry = true) => {
    state.summary = null;
    state.body.textContent = '';
    const section = createElement('section', { className: 'employee-summary-failure' });
    section.appendChild(createElement('h3', { text: title }));
    section.appendChild(createElement('p', { text: message }));
    const actions = createElement('div', { className: 'actions-row' });
    if (retry) {
      const retryButton = createElement('button', {
        className: 'action-button button-primary',
        text: 'Try Again',
        attributes: { type: 'button' }
      });
      retryButton.addEventListener('click', () => loadRoute(state.route, previewState.get().role));
      actions.appendChild(retryButton);
    }
    const backButton = createElement('button', {
      className: 'action-button button-ghost',
      text: 'Back',
      attributes: { type: 'button' }
    });
    backButton.addEventListener('click', requestClose);
    actions.appendChild(backButton);
    section.appendChild(actions);
    state.body.appendChild(section);
  };

  const setLoginState = (message) => {
    const returnRoute = parseRoute(window.location.hash) ? window.location.hash : null;
    previewState.set({
      ...previewState.get(),
      loginFlash: message
        ? {
            text: message,
            tone: 'warning'
          }
        : null,
      page: 'login',
      role: 'guest',
      summaryReturnRoute: returnRoute
    });
    closePanelDom({ restoreContext: false });
    replaceHash('#login');
  };

  const handleStaffDenial = () => {
    previewState.set({
      ...previewState.get(),
      page: 'rota',
      role: 'staff',
      summaryReturnRoute: null
    });
    closePanelDom({ restoreContext: false });
    replaceHash('#rota');
  };

  const getSummaryRequestPath = (route) => {
    const parameters = new URLSearchParams({
      source: sourceDetails[route.source].api
    });

    if (route.weekStart) {
      parameters.set('weekStart', route.weekStart);
    }

    return `/api/v1/staff/${route.staffId}/summary?${parameters.toString()}`;
  };

  const markInternalSummaryHistory = () => {
    if (!internalOpenPending) {
      return;
    }

    internalOpenPending = false;
    window.history.replaceState(
      {
        ...(window.history.state || {}),
        smartScheduleEmployeeSummary: true
      },
      '',
      window.location.href
    );
  };

  const loadRoute = async (route, role) => {
    const routeKey = window.location.hash;
    currentRouteKey = routeKey;
    markInternalSummaryHistory();
    if (route.scrollY > 0) {
      window.scrollTo({ left: 0, top: route.scrollY, behavior: 'instant' });
    }
    const state = ensurePanel(route);
    renderLoading(state);

    let sessionResult;
    try {
      sessionResult = await apiClient.get('/api/v1/auth/me');
    } catch (error) {
      if (currentRouteKey !== routeKey) {
        return;
      }

      if (error.status === 401) {
        setLoginState(
          role === 'manager'
            ? 'Your session has ended\n\nSign in again to continue. After manager verification, Smart Schedule will return you to the Employee Summary you were viewing.'
            : null
        );
      } else {
        renderFailure(
          state,
          'Employee Summary could not connect',
          'Smart Schedule could not verify the manager session. Check the connection and try again.'
        );
      }
      return;
    }

    if (sessionResult.user.role !== 'MANAGER') {
      try {
        await apiClient.get(getSummaryRequestPath(route));
      } catch (error) {
        // The expected 403 is deliberately silent in the staff interface.
      }
      handleStaffDenial();
      return;
    }

    if (role !== 'manager') {
      previewState.set({
        ...previewState.get(),
        page: route.sourcePage,
        role: 'manager'
      });
      dispatchRouteRender();
      return;
    }

    try {
      const result = await apiClient.get(getSummaryRequestPath(route));

      if (currentRouteKey !== routeKey || !parseRoute()) {
        return;
      }

      renderSummary(state, result.summary);
    } catch (error) {
      if (currentRouteKey !== routeKey) {
        return;
      }

      if (error.status === 401) {
        setLoginState(
          'Your session has ended\n\nSign in again to continue. After manager verification, Smart Schedule will return you to the Employee Summary you were viewing.'
        );
      } else if (error.status === 403) {
        handleStaffDenial();
      } else if (error.status === 404) {
        renderFailure(
          state,
          'This employee record is no longer available.',
          'The retained Staff record could not be found.',
          false
        );
      } else {
        renderFailure(
          state,
          'Employee Summary could not load',
          error.status
            ? error.message
            : 'The server could not be reached. Check the connection and try again.'
        );
      }
    }
  };

  async function requestPrint(state) {
    if (!state.summary || state.printButton.disabled) {
      return;
    }

    state.printButton.disabled = true;
    state.printButton.textContent = 'Checking...';
    state.notice.textContent = '';

    try {
      const sessionResult = await apiClient.get('/api/v1/auth/me');
      if (sessionResult.user.role !== 'MANAGER') {
        handleStaffDenial();
        return;
      }

      await apiClient.post(
        `/api/v1/staff/${state.route.staffId}/summary/print-request`,
        { source: sourceDetails[state.route.source].api }
      );
      const preparedAt = new Date();
      state.footer.textContent = `Prepared by ${sessionResult.user.fullName || 'Manager'} on ${preparedAt.toLocaleDateString('en-GB')} at ${preparedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      const details = Array.from(state.panel.querySelectorAll('details'));
      const openStates = details.map((element) => element.open);
      details.forEach((element) => { element.open = true; });
      window.print();
      details.forEach((element, index) => { element.open = openStates[index]; });
    } catch (error) {
      if (error.status === 401) {
        setLoginState(
          'Your session has ended\n\nSign in again to continue. After manager verification, Smart Schedule will return you to the Employee Summary you were viewing.'
        );
        return;
      }

      state.notice.textContent = '';
      const message = createElement('span', {
        text: 'The print request was not recorded, so the print dialog did not open.'
      });
      const retry = createElement('button', {
        className: 'employee-summary-inline-retry',
        text: 'Try Again',
        attributes: { type: 'button' }
      });
      retry.addEventListener('click', () => requestPrint(state));
      state.notice.append(message, retry);
    } finally {
      if (panelState === state) {
        state.printButton.disabled = false;
        state.printButton.textContent = 'Print summary';
      }
    }
  }

  const showVerificationCover = (state, message, retryHandler = null) => {
    state.cover.textContent = '';
    state.cover.hidden = false;
    state.cover.appendChild(createElement('strong', { text: message }));
    if (retryHandler) {
      const retry = createElement('button', {
        className: 'action-button button-primary',
        text: 'Try Again',
        attributes: { type: 'button' }
      });
      retry.addEventListener('click', retryHandler);
      state.cover.appendChild(retry);
    }
  };

  const recheckVisibleSession = async () => {
    const state = panelState;
    if (!state || document.visibilityState !== 'visible') {
      return;
    }

    const scrollTop = state.body.scrollTop;
    showVerificationCover(state, 'Checking manager session...');

    try {
      const result = await apiClient.get('/api/v1/auth/me');
      if (panelState !== state) {
        return;
      }
      if (result.user.role !== 'MANAGER') {
        handleStaffDenial();
        return;
      }
      state.cover.hidden = true;
      state.body.scrollTop = scrollTop;
    } catch (error) {
      if (panelState !== state) {
        return;
      }
      if (error.status === 401) {
        state.summary = null;
        state.body.textContent = '';
        setLoginState(
          'Your session has ended\n\nSign in again to continue. After manager verification, Smart Schedule will return you to the Employee Summary you were viewing.'
        );
      } else {
        showVerificationCover(
          state,
          'Smart Schedule could not verify the manager session. Employee information is covered until the connection returns.',
          recheckVisibleSession
        );
      }
    }
  };

  const bindResumeCheck = () => {
    if (resumeCheckBound) {
      return;
    }
    resumeCheckBound = true;
    document.addEventListener('visibilitychange', recheckVisibleSession);
  };

  const clearProtectedState = ({ clearReturnRoute = false } = {}) => {
    closePanelDom({ restoreContext: false });
    if (clearReturnRoute) {
      previewState.set({
        ...previewState.get(),
        summaryReturnRoute: null,
        summaryReturnFocusStaffId: null
      });
    }
  };

  const mount = async ({ role }) => {
    bindResumeCheck();
    const route = parseRoute();

    if (!route) {
      if (panelState) {
        closePanelDom({ restoreContext: true });
      }
      return;
    }

    await loadRoute(route, role);
  };

  return {
    buildSummaryHref,
    clearProtectedState,
    createEmployeeLink,
    mount,
    parseRoute
  };
})();
