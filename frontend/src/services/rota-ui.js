window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.rotaUi = (function createRotaUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const departments = ['BAR', 'FLOOR', 'KITCHEN', 'OTHER'];
  const emptyCell = { state: 'EMPTY' };

  const buildState = () => {
    return {
      activeContext: null,
      department: 'BAR',
      flash: null,
      loading: true,
      modal: null,
      rota: null,
      selectedDay: null,
      sessionUser: null,
      staff: [],
      staffLoading: false,
      weekStart: uiHelpers.getCurrentWeekStart()
    };
  };

  const isActiveRender = (workspaceElement, renderToken) => {
    return workspaceElement.dataset.renderToken === renderToken;
  };

  const setFlash = (state, tone, text, details = []) => {
    state.flash = {
      details,
      text,
      tone
    };
  };

  const addDays = (dateValue, offsetDays) => {
    const date = new Date(`${dateValue}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };

  const formatDayShort = (day) => {
    return day.label.slice(0, 3);
  };

  const getCellLabel = (cell) => {
    if (!cell || cell.state === 'EMPTY') {
      return 'No shift required';
    }

    if (cell.state === 'OPEN') {
      return `${cell.startTime} - ${cell.endTime}`;
    }

    if (cell.state === 'APPROVED_LEAVE') {
      return 'Approved leave';
    }

    return `${cell.startTime} - ${cell.endTime}`;
  };

  const getCellSubLabel = (cell, row) => {
    if (!cell || cell.state === 'EMPTY') {
      return '';
    }

    if (cell.state === 'OPEN') {
      return 'Unassigned';
    }

    if (cell.state === 'APPROVED_LEAVE') {
      return row.staffName;
    }

    return cell.staffName || row.staffName;
  };

  const getStateClass = (cell) => {
    const state = cell?.state || 'EMPTY';
    return `rota-cell--${state.toLowerCase().replace('_', '-')}`;
  };

  const getContextCells = (context) => {
    if (!context?.row || !context?.day) {
      return [];
    }

    return context.row.days[context.day.date] || [];
  };

  const getContextCell = (context) => {
    return context?.cell || getContextCells(context)[0] || emptyCell;
  };

  const getContextTitle = (context) => {
    const cell = getContextCell(context);
    const dayLabel = context?.day ? `${context.day.label} ${context.day.date}` : 'Rota cell';

    if (cell.state === 'OPEN') {
      return `Open ${dayLabel}`;
    }

    if (cell.state === 'APPROVED_LEAVE') {
      return `Leave on ${dayLabel}`;
    }

    if (cell.state === 'ASSIGNED') {
      return `${cell.staffName || context.row.staffName} on ${dayLabel}`;
    }

    return `${context?.row?.staffName || 'Rota'} on ${dayLabel}`;
  };

  const createIconButton = (label, onClick) => {
    const button = uiHelpers.createElement('button', {
      className: 'rota-cell-menu-button',
      text: '...',
      attributes: {
        'aria-label': label,
        type: 'button'
      }
    });
    button.addEventListener('click', onClick);
    return button;
  };

  const renderWeekControls = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'rota-toolbar content-panel--span-16'
    });

    const title = uiHelpers.createElement('div', { className: 'rota-toolbar-title' });
    title.appendChild(uiHelpers.createElement('span', { text: 'Weekly rota' }));
    title.appendChild(
      uiHelpers.createElement('strong', {
        text: `${state.weekStart} to ${state.rota?.weekEnd || addDays(state.weekStart, 6)}`
      })
    );
    panel.appendChild(title);

    const controls = uiHelpers.createElement('div', { className: 'rota-week-controls' });
    [
      { label: 'Previous Week', offset: -7 },
      { label: 'Current Week', current: true },
      { label: 'Next Week', offset: 7 }
    ].forEach((control) => {
      const button = uiHelpers.createElement('button', {
        className: 'action-button button-secondary',
        text: control.label,
        attributes: { type: 'button' }
      });
      button.addEventListener('click', () => {
        state.weekStart = control.current
          ? uiHelpers.getCurrentWeekStart()
          : addDays(state.weekStart, control.offset);
        state.activeContext = null;
        state.modal = null;
        state.selectedDay = null;
        actions.loadRota();
      });
      controls.appendChild(button);
    });
    panel.appendChild(controls);

    return panel;
  };

  const renderDepartmentTabs = (state, actions) => {
    const tabs = uiHelpers.createElement('div', {
      className: 'rota-tabs',
      attributes: { role: 'tablist' }
    });

    departments.forEach((department) => {
      const button = uiHelpers.createElement('button', {
        className: `rota-tab${state.department === department ? ' is-active' : ''}`,
        text: uiHelpers.formatRole(department),
        attributes: {
          role: 'tab',
          type: 'button'
        }
      });
      button.addEventListener('click', () => {
        if (state.department === department) {
          return;
        }

        state.department = department;
        state.activeContext = null;
        state.modal = null;
        state.selectedDay = null;
        actions.loadRota();
      });
      tabs.appendChild(button);
    });

    return tabs;
  };

  const renderLegend = () => {
    const legend = uiHelpers.createElement('div', { className: 'rota-legend' });
    [
      ['Assigned', 'assigned'],
      ['Open', 'open'],
      ['Leave', 'leave'],
      ['Conflict', 'conflict'],
      ['No shift', 'empty']
    ].forEach(([label, tone]) => {
      const item = uiHelpers.createElement('span', { className: 'rota-legend-item' });
      item.appendChild(uiHelpers.createElement('span', { className: `rota-legend-swatch rota-legend-swatch--${tone}` }));
      item.appendChild(uiHelpers.createElement('span', { text: label }));
      legend.appendChild(item);
    });
    return legend;
  };

  const renderCellBlock = (state, row, day, cell, actions) => {
    const block = uiHelpers.createElement('div', {
      className: `rota-cell-block ${getStateClass(cell)}`
    });
    const cellText = uiHelpers.createElement('div', { className: 'rota-cell-text' });
    cellText.appendChild(uiHelpers.createElement('strong', { text: getCellLabel(cell) }));

    const subLabel = getCellSubLabel(cell, row);
    if (subLabel) {
      cellText.appendChild(uiHelpers.createElement('span', { text: subLabel }));
    }

    block.appendChild(cellText);
    block.appendChild(
      createIconButton('Open cell actions', () => {
        state.activeContext = { cell, day, row };
        state.modal = null;
        actions.render();
      })
    );
    return block;
  };

  const renderEmptyCellBlock = (state, row, day, actions) => {
    return renderCellBlock(state, row, day, emptyCell, actions);
  };

  const renderDesktopGrid = (state, actions) => {
    const shell = uiHelpers.createElement('section', { className: 'rota-grid-shell' });
    const grid = uiHelpers.createElement('div', { className: 'rota-grid' });
    grid.appendChild(uiHelpers.createElement('div', { className: 'rota-grid-corner', text: 'Staff' }));

    state.rota.days.forEach((day) => {
      const header = uiHelpers.createElement('div', { className: 'rota-day-header' });
      header.appendChild(uiHelpers.createElement('strong', { text: day.label }));
      header.appendChild(uiHelpers.createElement('span', { text: day.date.slice(5) }));
      grid.appendChild(header);
    });

    state.rota.rows.forEach((row) => {
      const staffCell = uiHelpers.createElement('div', {
        className: `rota-staff-header${row.systemRow ? ' rota-staff-header--system' : ''}`
      });
      staffCell.appendChild(uiHelpers.createElement('strong', { text: row.staffName }));
      if (row.contractHours !== null && typeof row.contractHours !== 'undefined') {
        staffCell.appendChild(uiHelpers.createElement('span', { text: `${row.contractHours} hrs` }));
      }
      grid.appendChild(staffCell);

      state.rota.days.forEach((day) => {
        const dayCell = uiHelpers.createElement('div', { className: 'rota-day-cell' });
        const cells = row.days[day.date] || [];

        if (cells.length === 0) {
          dayCell.appendChild(renderEmptyCellBlock(state, row, day, actions));
        } else {
          cells.forEach((cell) => {
            dayCell.appendChild(renderCellBlock(state, row, day, cell, actions));
          });
        }

        grid.appendChild(dayCell);
      });
    });

    shell.appendChild(grid);
    return shell;
  };

  const renderMobileDayStrip = (state, actions) => {
    const strip = uiHelpers.createElement('div', { className: 'rota-mobile-days' });
    state.rota.days.forEach((day) => {
      const dayCells = state.rota.rows.flatMap((row) => row.days[day.date] || []);
      const openCount = dayCells.filter((cell) => cell.state === 'OPEN').length;
      const leaveCount = dayCells.filter((cell) => cell.state === 'APPROVED_LEAVE').length;
      const button = uiHelpers.createElement('button', {
        className: `rota-mobile-day${state.selectedDay === day.date ? ' is-active' : ''}${openCount ? ' has-gap' : ''}${leaveCount && !openCount ? ' has-leave' : ''}`,
        attributes: { type: 'button' }
      });
      button.appendChild(uiHelpers.createElement('strong', { text: formatDayShort(day) }));
      button.appendChild(uiHelpers.createElement('span', { text: day.date.slice(5) }));
      button.appendChild(
        uiHelpers.createElement('em', {
          text: openCount ? `${openCount} open` : leaveCount ? `${leaveCount} leave` : 'covered'
        })
      );
      button.addEventListener('click', () => {
        state.selectedDay = day.date;
        state.activeContext = null;
        actions.render();
      });
      strip.appendChild(button);
    });
    return strip;
  };

  const renderMobileDayPanel = (state, actions) => {
    const selectedDay = state.rota.days.find((day) => day.date === state.selectedDay) || state.rota.days[0];
    const panel = uiHelpers.createElement('section', { className: 'rota-mobile-panel' });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        `${selectedDay.label} ${selectedDay.date}`,
        `${uiHelpers.formatRole(state.department)} rota for the selected day.`
      )
    );

    state.rota.rows.forEach((row) => {
      const item = uiHelpers.createElement('div', { className: 'rota-mobile-row' });
      const heading = uiHelpers.createElement('div', { className: 'rota-mobile-row-heading' });
      heading.appendChild(uiHelpers.createElement('strong', { text: row.staffName }));
      if (row.contractHours !== null && typeof row.contractHours !== 'undefined') {
        heading.appendChild(uiHelpers.createElement('span', { text: `${row.contractHours} hrs` }));
      }
      item.appendChild(heading);

      const cells = row.days[selectedDay.date] || [];
      if (cells.length === 0) {
        item.appendChild(renderEmptyCellBlock(state, row, selectedDay, actions));
      } else {
        cells.forEach((cell) => {
          item.appendChild(renderCellBlock(state, row, selectedDay, cell, actions));
        });
      }

      panel.appendChild(item);
    });

    return panel;
  };

  const getActionItems = (state, actions) => {
    const context = state.activeContext;
    const cell = getContextCell(context);
    const isManager = state.sessionUser?.role === 'MANAGER';

    if (!isManager) {
      if (cell.state === 'EMPTY') {
        return [{ label: 'View day details', onClick: () => actions.openDetailsModal() }];
      }

      return [
        { label: 'View shift details', onClick: () => actions.openDetailsModal() },
        { label: 'View department', onClick: () => actions.openDepartmentModal() }
      ];
    }

    if (cell.state === 'EMPTY') {
      return [
        { label: 'Add shift', onClick: () => actions.openShiftModal('create') },
        { label: 'View day details', onClick: () => actions.openDetailsModal() }
      ];
    }

    if (cell.state === 'OPEN') {
      return [
        { label: 'Assign employee', onClick: () => actions.openAssignModal('assign') },
        { label: 'Edit required shift', onClick: () => actions.openShiftModal('edit') },
        { label: 'Remove required shift', danger: true, onClick: () => actions.removeShift() },
        { label: 'View available staff', onClick: () => actions.openAvailableStaffModal() }
      ];
    }

    if (cell.state === 'ASSIGNED') {
      return [
        { label: 'Edit assignment', onClick: () => actions.openAssignModal('change') },
        { label: 'Change employee', onClick: () => actions.openAssignModal('change') },
        { label: 'Remove assignment', danger: true, onClick: () => actions.removeAssignment() },
        { label: 'View employee details', onClick: () => actions.openEmployeeModal() },
        { label: 'View conflicts', onClick: () => actions.openConflictModal() }
      ];
    }

    return [{ label: 'View leave marker', onClick: () => actions.openDetailsModal() }];
  };

  const renderActionSheet = (state, actions) => {
    if (!state.activeContext) {
      return null;
    }

    const sheet = uiHelpers.createElement('div', { className: 'rota-sheet-backdrop' });
    const panel = uiHelpers.createElement('section', { className: 'rota-action-sheet' });
    const header = uiHelpers.createElement('div', { className: 'rota-sheet-header' });
    header.appendChild(uiHelpers.createElement('strong', { text: getContextTitle(state.activeContext) }));
    const closeButton = uiHelpers.createElement('button', {
      className: 'rota-sheet-close',
      text: 'Close',
      attributes: { type: 'button' }
    });
    closeButton.addEventListener('click', () => {
      state.activeContext = null;
      actions.render();
    });
    header.appendChild(closeButton);
    panel.appendChild(header);

    const list = uiHelpers.createElement('div', { className: 'rota-action-list' });
    getActionItems(state, actions).forEach((item) => {
      const button = uiHelpers.createElement('button', {
        className: `rota-action-row${item.danger ? ' rota-action-row--danger' : ''}`,
        text: item.label,
        attributes: { type: 'button' }
      });
      button.addEventListener('click', item.onClick);
      list.appendChild(button);
    });
    panel.appendChild(list);
    sheet.appendChild(panel);
    return sheet;
  };

  const createModalShell = (title, state, actions) => {
    const backdrop = uiHelpers.createElement('div', { className: 'rota-sheet-backdrop' });
    const panel = uiHelpers.createElement('section', { className: 'rota-modal-panel' });
    const header = uiHelpers.createElement('div', { className: 'rota-sheet-header' });
    header.appendChild(uiHelpers.createElement('strong', { text: title }));
    const closeButton = uiHelpers.createElement('button', {
      className: 'rota-sheet-close',
      text: 'Close',
      attributes: { type: 'button' }
    });
    closeButton.addEventListener('click', () => {
      state.modal = null;
      actions.render();
    });
    header.appendChild(closeButton);
    panel.appendChild(header);
    backdrop.appendChild(panel);

    return { backdrop, panel };
  };

  const renderDetailsModal = (state, actions) => {
    const cell = getContextCell(state.modal.context);
    const { backdrop, panel } = createModalShell('Shift details', state, actions);
    panel.appendChild(
      uiHelpers.createReviewList([
        { label: 'Department', value: uiHelpers.formatRole(state.department) },
        { label: 'Day', value: state.modal.context.day.label },
        { label: 'Date', value: state.modal.context.day.date },
        { label: 'Status', value: cell.state === 'EMPTY' ? 'No shift required' : uiHelpers.formatStatus(cell.state) },
        { label: 'Time', value: cell.startTime ? `${cell.startTime} - ${cell.endTime}` : 'Not set' },
        { label: 'Staff', value: cell.staffName || state.modal.context.row.staffName }
      ])
    );
    return backdrop;
  };

  const renderDepartmentModal = (state, actions) => {
    const { backdrop, panel } = createModalShell('Department details', state, actions);
    panel.appendChild(
      uiHelpers.createReviewList([
        { label: 'Department', value: uiHelpers.formatRole(state.department) },
        { label: 'Week', value: `${state.weekStart} to ${state.rota.weekEnd}` },
        { label: 'Assigned shifts', value: String(state.rota.summary.assignedShifts) },
        { label: 'Open shifts', value: String(state.rota.summary.openShifts) }
      ])
    );
    return backdrop;
  };

  const renderEmployeeModal = (state, actions) => {
    const cell = getContextCell(state.modal.context);
    const row = state.modal.context.row;
    const { backdrop, panel } = createModalShell('Employee details', state, actions);
    panel.appendChild(
      uiHelpers.createReviewList([
        { label: 'Name', value: cell.staffName || row.staffName },
        { label: 'Role', value: uiHelpers.formatRole(row.primaryRole || state.department) },
        { label: 'Contract hours', value: row.contractHours ? `${row.contractHours} hrs` : 'Not shown' },
        { label: 'Selected shift', value: cell.startTime ? `${cell.startTime} - ${cell.endTime}` : 'Not set' }
      ])
    );
    return backdrop;
  };

  const renderConflictModal = (state, actions) => {
    const cell = getContextCell(state.modal.context);
    const { backdrop, panel } = createModalShell('Conflict check', state, actions);
    const details = [
      { label: 'Current marker', value: cell.state === 'OPEN' ? 'Unassigned required shift' : 'No conflict marker saved' },
      { label: 'Backend check', value: 'Leave, availability, overlap, role, and active staff checks run when assignments are saved.' }
    ];
    panel.appendChild(uiHelpers.createReviewList(details));
    return backdrop;
  };

  const renderAvailableStaffModal = (state, actions) => {
    const { backdrop, panel } = createModalShell('Available staff', state, actions);

    if (state.staffLoading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading staff...' }));
      return backdrop;
    }

    const list = uiHelpers.createElement('div', { className: 'rota-staff-choice-list' });
    const matchingStaff = state.staff.filter((staffMember) => {
      return staffMember.primaryRole === state.department;
    });
    const staffToShow = matchingStaff.length > 0 ? matchingStaff : state.staff;

    if (staffToShow.length === 0) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'No active staff found.' }));
      return backdrop;
    }

    staffToShow.forEach((staffMember) => {
      const item = uiHelpers.createElement('div', { className: 'rota-staff-choice' });
      item.appendChild(uiHelpers.createElement('strong', { text: staffMember.fullName }));
      item.appendChild(
        uiHelpers.createElement('span', {
          text: `${uiHelpers.formatRole(staffMember.primaryRole)} - ${staffMember.contractHours} hrs`
        })
      );
      list.appendChild(item);
    });

    panel.appendChild(list);
    return backdrop;
  };

  const renderAssignModal = (state, actions) => {
    const cell = getContextCell(state.modal.context);
    const title = state.modal.mode === 'change' ? 'Change employee' : 'Assign employee';
    const { backdrop, panel } = createModalShell(title, state, actions);

    if (state.staffLoading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading staff...' }));
      return backdrop;
    }

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });
    const field = uiHelpers.createElement('label', {
      className: 'form-field form-field--span-12'
    });
    field.appendChild(uiHelpers.createElement('span', { text: 'Staff member' }));
    const select = uiHelpers.createElement('select', { className: 'input-control' });
    state.staff.forEach((staffMember) => {
      const option = uiHelpers.createElement('option', {
        text: `${staffMember.fullName} - ${uiHelpers.formatRole(staffMember.primaryRole)}`
      });
      option.value = staffMember.id;
      option.selected = staffMember.id === cell.staffProfileId;
      select.appendChild(option);
    });
    field.appendChild(select);
    grid.appendChild(field);
    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: state.modal.mode === 'change' ? 'Save change' : 'Assign staff',
      attributes: {
        disabled: state.staff.length === 0,
        type: 'submit'
      }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await actions.saveAssignment(select.value);
    });

    panel.appendChild(form);
    return backdrop;
  };

  const renderShiftModal = (state, actions) => {
    const context = state.modal.context;
    const cell = getContextCell(context);
    const isEdit = state.modal.mode === 'edit';
    const { backdrop, panel } = createModalShell(isEdit ? 'Edit shift' : 'Add shift', state, actions);
    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });

    const appendInput = (label, type, value, spanClass = 'form-field--span-6') => {
      const field = uiHelpers.createElement('label', { className: `form-field ${spanClass}` });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      const input = uiHelpers.createElement(type === 'textarea' ? 'textarea' : 'input', {
        className: 'input-control',
        text: type === 'textarea' ? value || '' : undefined,
        attributes: {
          rows: type === 'textarea' ? 3 : undefined,
          type: type === 'textarea' ? undefined : type,
          value: type === 'textarea' ? undefined : value
        }
      });
      field.appendChild(input);
      grid.appendChild(field);
      return input;
    };

    const dateInput = appendInput('Date', 'date', cell.shiftDate || context.day.date, 'form-field--span-12');
    const startInput = appendInput('Start time', 'time', cell.startTime || '09:00');
    const endInput = appendInput('End time', 'time', cell.endTime || '17:00');
    const notesInput = appendInput('Notes', 'textarea', cell.notes || '', 'form-field--span-12');
    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: isEdit ? 'Save shift' : 'Add shift',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await actions.saveShift({
        endTime: endInput.value,
        notes: notesInput.value,
        requiredRole: state.department,
        shiftDate: dateInput.value,
        startTime: startInput.value,
        status: 'OPEN'
      });
    });

    panel.appendChild(form);
    return backdrop;
  };

  const renderModal = (state, actions) => {
    if (!state.modal) {
      return null;
    }

    switch (state.modal.type) {
      case 'assign':
        return renderAssignModal(state, actions);
      case 'available-staff':
        return renderAvailableStaffModal(state, actions);
      case 'conflicts':
        return renderConflictModal(state, actions);
      case 'department':
        return renderDepartmentModal(state, actions);
      case 'details':
        return renderDetailsModal(state, actions);
      case 'employee':
        return renderEmployeeModal(state, actions);
      case 'shift':
        return renderShiftModal(state, actions);
      default:
        return null;
    }
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'rota') {
      return;
    }

    const state = buildState();

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid rota-workspace' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      if (state.loading) {
        grid.appendChild(uiHelpers.createEmptyPanel('Loading rota', 'Loading the weekly rota from live shifts and assignments.'));
        workspaceElement.appendChild(grid);
        return;
      }

      grid.appendChild(renderWeekControls(state, actions));
      grid.appendChild(renderDepartmentTabs(state, actions));
      grid.appendChild(renderLegend());
      grid.appendChild(renderDesktopGrid(state, actions));
      grid.appendChild(renderMobileDayStrip(state, actions));
      grid.appendChild(renderMobileDayPanel(state, actions));
      workspaceElement.appendChild(grid);

      const sheet = renderActionSheet(state, actions);
      if (sheet) {
        workspaceElement.appendChild(sheet);
      }

      const modal = renderModal(state, actions);
      if (modal) {
        workspaceElement.appendChild(modal);
      }
    };

    const loadStaff = async () => {
      if (state.sessionUser?.role !== 'MANAGER' || state.staff.length > 0) {
        return;
      }

      state.staffLoading = true;
      render();

      try {
        const result = await apiClient.get('/api/v1/staff?status=ACTIVE');
        state.staff = result.staff;
      } finally {
        state.staffLoading = false;
      }
    };

    const loadRota = async (nextFlash = null) => {
      state.loading = true;
      state.flash = nextFlash || null;
      render();

      try {
        const queryString = uiHelpers.buildQueryString({
          department: state.department,
          weekStart: state.weekStart
        });
        const result = await apiClient.get(`/api/v1/rota?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.rota = result.rota;
        state.selectedDay = state.selectedDay || result.rota.days[0].date;
        state.loading = false;
        state.flash = nextFlash;
        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load the rota.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const openDetailsModal = () => {
      state.modal = { context: state.activeContext, type: 'details' };
      state.activeContext = null;
      render();
    };

    const openDepartmentModal = () => {
      state.modal = { context: state.activeContext, type: 'department' };
      state.activeContext = null;
      render();
    };

    const openEmployeeModal = () => {
      state.modal = { context: state.activeContext, type: 'employee' };
      state.activeContext = null;
      render();
    };

    const openConflictModal = () => {
      state.modal = { context: state.activeContext, type: 'conflicts' };
      state.activeContext = null;
      render();
    };

    const openAvailableStaffModal = async () => {
      state.modal = { context: state.activeContext, type: 'available-staff' };
      state.activeContext = null;
      await loadStaff();
      render();
    };

    const openAssignModal = async (mode) => {
      state.modal = { context: state.activeContext, mode, type: 'assign' };
      state.activeContext = null;
      await loadStaff();
      render();
    };

    const openShiftModal = (mode) => {
      state.modal = { context: state.activeContext, mode, type: 'shift' };
      state.activeContext = null;
      render();
    };

    const saveAssignment = async (staffProfileId) => {
      const cell = getContextCell(state.modal.context);

      try {
        if (state.modal.mode === 'change') {
          await apiClient.put(`/api/v1/assignments/${cell.assignmentId}`, {
            staffProfileId
          });
        } else {
          await apiClient.post('/api/v1/assignments', {
            shiftId: cell.shiftId,
            staffProfileId
          });
        }

        state.modal = null;
        await loadRota({
          details: [],
          text: 'Assignment saved.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not save assignment.');
        setFlash(state, 'error', feedback.text, feedback.details);
        state.modal = null;
        render();
      }
    };

    const saveShift = async (payload) => {
      const cell = getContextCell(state.modal.context);

      try {
        if (state.modal.mode === 'edit') {
          await apiClient.put(`/api/v1/shifts/${cell.shiftId}`, payload);
        } else {
          await apiClient.post('/api/v1/shifts', payload);
        }

        state.modal = null;
        await loadRota({
          details: [],
          text: 'Shift saved.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not save shift.');
        setFlash(state, 'error', feedback.text, feedback.details);
        state.modal = null;
        render();
      }
    };

    const removeShift = async () => {
      const cell = getContextCell(state.activeContext);

      if (!uiHelpers.confirmAction('Remove this required shift?')) {
        return;
      }

      try {
        await apiClient.delete(`/api/v1/shifts/${cell.shiftId}`);
        state.activeContext = null;
        await loadRota({
          details: [],
          text: 'Shift removed.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not remove shift.');
        setFlash(state, 'error', feedback.text, feedback.details);
        state.activeContext = null;
        render();
      }
    };

    const removeAssignment = async () => {
      const cell = getContextCell(state.activeContext);

      if (!uiHelpers.confirmAction('Remove this assignment?')) {
        return;
      }

      try {
        await apiClient.delete(`/api/v1/assignments/${cell.assignmentId}`);
        state.activeContext = null;
        await loadRota({
          details: [],
          text: 'Assignment removed.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not remove assignment.');
        setFlash(state, 'error', feedback.text, feedback.details);
        state.activeContext = null;
        render();
      }
    };

    const actions = {
      loadRota,
      openAssignModal,
      openAvailableStaffModal,
      openConflictModal,
      openDepartmentModal,
      openDetailsModal,
      openEmployeeModal,
      openShiftModal,
      removeAssignment,
      removeShift,
      render,
      saveAssignment,
      saveShift
    };

    try {
      const result = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = result.user;
      render();
      await loadRota();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Session required',
        'Sign in to view the weekly rota.'
      );
    }
  };

  return {
    mount
  };
})();
