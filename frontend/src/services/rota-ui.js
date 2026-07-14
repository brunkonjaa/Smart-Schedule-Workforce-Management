window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.rotaUi = (function createRotaUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const departments = ['BAR', 'FLOOR', 'KITCHEN', 'OTHER'];
  const defaultShiftTimesByDepartment = {
    BAR: { endTime: '17:00', startTime: '10:00' },
    FLOOR: { endTime: '17:00', startTime: '12:00' },
    KITCHEN: { endTime: '21:00', startTime: '12:00' },
    OTHER: { endTime: '17:00', startTime: '12:00' }
  };
  const modalHostId = 'rota-modal-host';

  const buildState = () => {
    return {
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

  const clearModalHost = () => {
    document.getElementById(modalHostId)?.remove();
  };

  const addDays = (dateValue, offsetDays) => {
    const date = new Date(`${dateValue}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };

  const getCurrentIsoDate = () => {
    return new Date().toISOString().slice(0, 10);
  };

  const getInitialSelectedDay = (days, selectedDay) => {
    if (selectedDay && days.some((day) => day.date === selectedDay)) {
      return selectedDay;
    }

    const currentDay = getCurrentIsoDate();
    if (days.some((day) => day.date === currentDay)) {
      return currentDay;
    }

    return days[0]?.date || null;
  };

  const getAssignmentWarningDetails = (result) => {
    if (!Array.isArray(result?.warnings)) {
      return [];
    }

    return result.warnings
      .map((warning) => warning.message)
      .filter(Boolean);
  };

  const sortCells = (cells) => {
    return [...cells].sort((left, right) => {
      const leftTime = left.startTime || '99:99';
      const rightTime = right.startTime || '99:99';
      return leftTime.localeCompare(rightTime);
    });
  };

  const formatClock = (timeValue) => {
    if (!timeValue) {
      return '';
    }

    const [hourText, minuteText = '00'] = String(timeValue).split(':');
    const hour = Number(hourText);

    if (Number.isNaN(hour)) {
      return String(timeValue);
    }

    const suffix = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 || 12;
    return minuteText === '00'
      ? `${displayHour}${suffix}`
      : `${displayHour}:${minuteText}${suffix}`;
  };

  const formatCompactClock = (timeValue) => {
    if (!timeValue) {
      return '';
    }

    const [hourText, minuteText = '00'] = String(timeValue).split(':');
    const hour = Number(hourText);

    if (Number.isNaN(hour)) {
      return String(timeValue);
    }

    const displayHour = hour % 12 || 12;
    return minuteText === '00' ? `${displayHour}` : `${displayHour}:${minuteText}`;
  };

  const formatShiftTime = (cell) => {
    if (!cell?.startTime || !cell?.endTime) {
      return '';
    }

    return `${formatClock(cell.startTime)}-${formatClock(cell.endTime)}`;
  };

  const formatTableShiftTime = (cell) => {
    if (!cell?.startTime || !cell?.endTime) {
      return '';
    }

    return `${formatCompactClock(cell.startTime)}-${formatCompactClock(cell.endTime)}`;
  };

  const formatShortDate = (dateValue) => {
    if (!dateValue || typeof dateValue !== 'string' || dateValue.length < 10) {
      return dateValue || '';
    }

    return `${dateValue.slice(5, 7)}/${dateValue.slice(8, 10)}`;
  };

  const getVisibleRows = (state) => {
    return (state.rota?.rows || []).filter((row) => {
      return !row.systemRow && (state.department === 'ALL' || row.primaryRole === state.department);
    });
  };

  const getMobileRows = (state) => {
    return (state.rota?.rows || []).filter((row) => !row.systemRow);
  };

  const getCompactDayLabel = (day) => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return labels[Number(day?.dayOfWeek) - 1] || String(day?.label || '').slice(0, 3);
  };

  const getCompactStaffName = (staffName) => {
    const parts = String(staffName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      return parts[0] || 'Staff';
    }

    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  };

  const getOpenShiftRow = (state) => {
    return (state.rota?.rows || []).find((row) => row.systemRow === 'OPEN_SHIFTS') || null;
  };

  const getOpenShiftItems = (state) => {
    const openRow = getOpenShiftRow(state);

    if (!openRow || !state.rota) {
      return [];
    }

    return state.rota.days.flatMap((day) => {
      return sortCells(openRow.days[day.date] || []).map((cell) => {
        return {
          cell,
          day,
          kind: 'open',
          label: formatShiftTime(cell) || 'Open shift',
          row: openRow
        };
      });
    });
  };

  const getCellsForDay = (row, dayDate) => {
    return Array.isArray(row?.days?.[dayDate]) ? row.days[dayDate] : [];
  };

  const getCellEntries = (row, dayDate) => {
    const cells = sortCells(getCellsForDay(row, dayDate));
    const sickCell = cells.find((cell) => {
      const state = String(cell.state || '').toUpperCase();
      const leaveType = String(cell.leaveType || '').toUpperCase();
      return state.includes('SICK') || leaveType.includes('SICK');
    });

    if (sickCell) {
      return [{ cell: sickCell, kind: 'sick', label: 'S' }];
    }

    const leaveCell = cells.find((cell) => cell.state === 'APPROVED_LEAVE');

    if (leaveCell) {
      return [
        {
          cell: leaveCell,
          kind: 'leave',
          label: 'H'
        }
      ];
    }

    const shiftCells = cells.filter((cell) => cell.state !== 'APPROVED_LEAVE');

    if (shiftCells.length > 0) {
      return shiftCells.map((cell) => {
        return {
          cell,
          kind: cell.state === 'OPEN' ? 'open' : 'assigned',
          label: formatTableShiftTime(cell) || 'Shift'
        };
      });
    }

    return [
      {
        cell: null,
        kind: 'off',
        label: 'OFF'
      }
    ];
  };

  const canOpenEntryMenu = (state, row, item) => {
    if (state.sessionUser?.role === 'MANAGER') {
      return true;
    }

    return (
      item.kind === 'assigned' &&
      row.staffProfileId === state.sessionUser?.staffProfileId
    );
  };

  const getContextTitle = (context) => {
    const dayText = `${context.day.label} ${context.day.date}`;

    if (context.kind === 'open') {
      return `${dayText} ${context.label}`.trim();
    }

    if (context.kind === 'off') {
      return `${context.row.staffName} ${dayText}`;
    }

    return `${context.row.staffName} ${dayText}`.trim();
  };

  const getDefaultShiftTimes = (department, context) => {
    if (context?.cell?.startTime && context?.cell?.endTime) {
      return {
        endTime: context.cell.endTime,
        startTime: context.cell.startTime
      };
    }

    return defaultShiftTimesByDepartment[department] || defaultShiftTimesByDepartment.OTHER;
  };

  const findRowByStaffProfileId = (rows, staffProfileId) => {
    return rows.find((row) => row.staffProfileId === staffProfileId) || null;
  };

  const findShiftCellForStaff = (rows, dayDate, staffProfileId, startTime, endTime) => {
    const row = findRowByStaffProfileId(rows, staffProfileId);

    if (!row) {
      return null;
    }

    return sortCells(getCellsForDay(row, dayDate)).find((cell) => {
      return (
        cell.state !== 'APPROVED_LEAVE' &&
        cell.startTime === startTime &&
        cell.endTime === endTime
      );
    }) || null;
  };

  const findOpenShiftCell = (state, dayDate, startTime, endTime) => {
    const openRow = getOpenShiftRow(state);

    if (!openRow) {
      return null;
    }

    return sortCells(getCellsForDay(openRow, dayDate)).find((cell) => {
      return cell.startTime === startTime && cell.endTime === endTime;
    }) || null;
  };

  const getDepartmentStaff = (state, selectedStaffProfileId = null) => {
    const matchingStaff = state.staff.filter((staffMember) => {
      return staffMember.primaryRole === state.department;
    });

    const staffToShow = matchingStaff.length > 0 ? matchingStaff : state.staff;

    return [...staffToShow].sort((left, right) => {
      const leftPriority = left.id === selectedStaffProfileId ? 0 : 1;
      const rightPriority = right.id === selectedStaffProfileId ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.fullName.localeCompare(right.fullName);
    });
  };

  const buildManagerChoices = (state, context) => {
    const isOpenContext = context.cell?.state === 'OPEN';
    const hasLockedTime = Boolean(context.cell?.startTime && context.cell?.endTime);

    return getDepartmentStaff(state, context.row?.staffProfileId || null).map((staffMember) => {
      const matchingCell = hasLockedTime
        ? findShiftCellForStaff(
            state.rota.rows,
            context.day.date,
            staffMember.id,
            context.cell.startTime,
            context.cell.endTime
          )
        : null;

      if (isOpenContext) {
        return {
          buttonLabel: matchingCell ? 'Busy' : 'Add',
          disabled: Boolean(matchingCell),
          existingCell: matchingCell,
          mode: 'add',
          staffMember
        };
      }

      if (matchingCell) {
        return {
          buttonLabel: 'Remove',
          disabled: false,
          existingCell: matchingCell,
          mode: 'remove',
          staffMember
        };
      }

      return {
        buttonLabel: 'Add',
        disabled: false,
        existingCell: null,
        mode: 'add',
        staffMember
      };
    });
  };

  const createMenuButton = (label, onClick) => {
    const button = uiHelpers.createElement('button', {
      className: 'rota-cell-menu-button',
      text: '*',
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
      className: 'rota-toolbar'
    });

    const title = uiHelpers.createElement('div', { className: 'rota-toolbar-title' });
    title.appendChild(
      uiHelpers.createElement('span', {
        text:
          state.sessionUser?.role === 'STAFF'
            ? 'Full roster'
            : `${uiHelpers.formatRole(state.department)} rota`
      })
    );
    title.appendChild(
      uiHelpers.createElement('strong', {
        text: `${state.weekStart} to ${state.rota?.weekEnd || addDays(state.weekStart, 6)}`
      })
    );
    panel.appendChild(title);

    const controls = uiHelpers.createElement('div', { className: 'rota-week-controls' });
    [
      { label: 'Prev', offset: -7 },
      { label: 'This week', current: true },
      { label: 'Next', offset: 7 }
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
        state.modal = null;
        state.selectedDay = null;
        actions.loadRota();
      });
      tabs.appendChild(button);
    });

    return tabs;
  };

  const renderOpenShiftStrip = (state, actions, selectedDayOnly = false) => {
    if (state.sessionUser?.role !== 'MANAGER') {
      return null;
    }

    const items = getOpenShiftItems(state).filter((item) => {
      return !selectedDayOnly || item.day.date === selectedDayOnly;
    });

    if (items.length === 0) {
      return null;
    }

    const section = uiHelpers.createElement('section', {
      className: 'rota-open-strip'
    });
    const heading = uiHelpers.createElement('div', { className: 'rota-open-heading' });
    heading.appendChild(uiHelpers.createElement('strong', { text: 'Open shifts' }));
    section.appendChild(heading);

    const list = uiHelpers.createElement('div', { className: 'rota-open-list' });
    items.forEach((item) => {
      const row = uiHelpers.createElement('div', { className: 'rota-open-item' });
      const copy = uiHelpers.createElement('div', { className: 'rota-open-copy' });
      copy.appendChild(
        uiHelpers.createElement('strong', {
          text: `${item.day.label} ${formatShortDate(item.day.date)}`
        })
      );
      copy.appendChild(uiHelpers.createElement('span', { text: item.label }));
      row.appendChild(copy);
      row.appendChild(
        createMenuButton('Open shift options', () => {
          actions.openEntryContext(item);
        })
      );
      list.appendChild(row);
    });
    section.appendChild(list);

    return section;
  };

  const renderCellEntry = (state, row, day, item, actions) => {
    const entry = uiHelpers.createElement('div', {
      className: `rota-entry rota-entry--${item.kind}`
    });
    const entryText = uiHelpers.createElement('span', {
      className: 'rota-entry-text',
      text: item.label
    });
    const shouldShowMarker =
      state.sessionUser?.role === 'MANAGER' ||
      row.staffProfileId === state.sessionUser?.staffProfileId;
    const canOpenMenu = canOpenEntryMenu(state, row, item);

    if (shouldShowMarker) {
      if (canOpenMenu) {
        const markerButton = uiHelpers.createElement('button', {
          className: 'rota-required-marker rota-required-marker--button',
          text: '*',
          attributes: {
            'aria-label': 'Open rota options',
            type: 'button'
          }
        });
        markerButton.addEventListener('click', (event) => {
          event.stopPropagation();
          actions.openEntryContext({
            cell: item.cell,
            day,
            kind: item.kind,
            label: item.label,
            row
          });
        });
        entryText.appendChild(markerButton);
      } else {
        entryText.appendChild(
          uiHelpers.createElement('sup', {
            className: 'rota-required-marker',
            text: '*'
          })
        );
      }
    }

    entry.appendChild(entryText);

    if (canOpenEntryMenu(state, row, item)) {
      entry.appendChild(
        createMenuButton('Open rota options', () => {
          actions.openEntryContext({
            cell: item.cell,
            day,
            kind: item.kind,
            label: item.label,
            row
          });
        })
      );
    }

    return entry;
  };

  const renderDesktopGrid = (state, actions) => {
    const shell = uiHelpers.createElement('section', { className: 'rota-grid-shell' });
    const rows = getVisibleRows(state);

    if (rows.length === 0) {
      shell.appendChild(
        uiHelpers.createElement('p', {
          className: 'panel-copy',
          text: 'No rota rows found for this week.'
        })
      );
      return shell;
    }

    const table = uiHelpers.createElement('table', { className: 'rota-table' });
    const colgroup = uiHelpers.createElement('colgroup');
    colgroup.appendChild(uiHelpers.createElement('col', { className: 'rota-table-staff-col' }));
    state.rota.days.forEach(() => {
      colgroup.appendChild(uiHelpers.createElement('col', { className: 'rota-table-day-col' }));
    });
    table.appendChild(colgroup);

    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    headRow.appendChild(
      uiHelpers.createElement('th', {
        className: 'rota-table-staff-heading',
        text: ''
      })
    );
    state.rota.days.forEach((day) => {
      const headingClasses = [
        'rota-table-day-heading',
        day.dayOfWeek >= 6 ? 'rota-table-day-heading--weekend' : '',
        day.date === getCurrentIsoDate() ? 'rota-table-day-heading--today' : ''
      ]
        .filter(Boolean)
        .join(' ');
      headRow.appendChild(
        uiHelpers.createElement('th', {
          className: headingClasses,
          text: day.label
        })
      );
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    rows.forEach((row) => {
      const isOwnRow = row.staffProfileId && row.staffProfileId === state.sessionUser?.staffProfileId;
      const tableRow = uiHelpers.createElement('tr', {
        className: isOwnRow ? 'rota-table-row rota-table-row--current' : 'rota-table-row'
      });
      const nameCell = uiHelpers.createElement('th', {
        className: 'rota-table-staff-name',
        text: row.staffName,
        attributes: { scope: 'row' }
      });
      tableRow.appendChild(nameCell);

      state.rota.days.forEach((day) => {
        const entries = getCellEntries(row, day.date);
        const dayClasses = [
          'rota-table-cell',
          day.dayOfWeek >= 6 ? 'rota-table-cell--weekend' : '',
          day.date === getCurrentIsoDate() ? 'rota-table-cell--today' : '',
          entries.some((entry) => entry.kind === 'assigned') ? 'rota-table-cell--filled' : ''
        ]
          .filter(Boolean)
          .join(' ');
        const cell = uiHelpers.createElement('td', { className: dayClasses });
        const entryList = uiHelpers.createElement('div', { className: 'rota-day-cell' });
        entries.forEach((item) => {
          entryList.appendChild(renderCellEntry(state, row, day, item, actions));
        });
        cell.appendChild(entryList);
        tableRow.appendChild(cell);
      });

      tbody.appendChild(tableRow);
    });

    table.appendChild(tbody);
    shell.appendChild(table);
    return shell;
  };

  const renderMobileDepartmentTabs = (state, actions) => {
    const tabs = uiHelpers.createElement('div', { className: 'rota-mobile-tabs' });
    departments.forEach((department) => {
      const button = uiHelpers.createElement('button', {
        className: `rota-mobile-tab${state.department === department ? ' is-active' : ''}`,
        text: uiHelpers.formatRole(department),
        attributes: { type: 'button' }
      });
      button.addEventListener('click', () => {
        if (state.department === department) {
          return;
        }

        state.department = department;
        state.selectedDay = null;
        state.modal = null;
        actions.loadRota();
      });
      tabs.appendChild(button);
    });
    return tabs;
  };

  const renderMobilePanel = (state, actions) => {
    const selectedDay = state.rota.days.find((day) => day.date === state.selectedDay) || state.rota.days[0];

    const panel = uiHelpers.createElement('section', { className: 'rota-mobile-panel' });
    const header = uiHelpers.createElement('div', { className: 'rota-mobile-panel-header' });
    const title = uiHelpers.createElement('div', { className: 'rota-mobile-panel-title' });
    title.appendChild(uiHelpers.createElement('span', { text: selectedDay.label }));
    title.appendChild(uiHelpers.createElement('strong', { text: selectedDay.date }));
    header.appendChild(title);

    const controls = uiHelpers.createElement('div', { className: 'rota-mobile-day-controls' });
    [
      { label: 'Prev week', offset: -7 },
      { label: 'Current week', current: true },
      { label: 'Next week', offset: 7 }
    ].forEach((control) => {
      const button = uiHelpers.createElement('button', {
        className: `action-button ${control.current ? 'button-ghost' : 'button-secondary'} rota-mobile-day-button`,
        text: control.label,
        attributes: {
          type: 'button'
        }
      });
      button.addEventListener('click', () => {
        state.weekStart = control.current
          ? uiHelpers.getCurrentWeekStart()
          : addDays(state.weekStart, control.offset);
        state.selectedDay = null;
        state.modal = null;
        actions.loadRota();
      });
      controls.appendChild(button);
    });
    header.appendChild(controls);
    panel.appendChild(header);

    const mobileTabs = renderMobileDepartmentTabs(state, actions);
    if (mobileTabs) {
      panel.appendChild(mobileTabs);
    }

    const mobileRows = getMobileRows(state).filter((row) => {
      return state.department === 'ALL' || row.primaryRole === state.department;
    });
    const tableWrap = uiHelpers.createElement('div', { className: 'rota-mobile-table-wrap' });
    const table = uiHelpers.createElement('table', { className: 'rota-mobile-table' });
    const headRow = uiHelpers.createElement('tr');
    headRow.appendChild(uiHelpers.createElement('th', { className: 'rota-mobile-staff-heading', text: 'Staff' }));
    state.rota.days.forEach((day) => {
      headRow.appendChild(uiHelpers.createElement('th', {
        className: `rota-mobile-day-heading${day.date === selectedDay.date ? ' is-selected' : ''}`,
        text: getCompactDayLabel(day)
      }));
    });
    const thead = uiHelpers.createElement('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    mobileRows.forEach((row) => {
      const tableRow = uiHelpers.createElement('tr', {
        className: row.staffProfileId === state.sessionUser?.staffProfileId ? 'is-current' : ''
      });
      tableRow.appendChild(uiHelpers.createElement('th', {
        className: 'rota-mobile-staff-name',
        text: getCompactStaffName(row.staffName),
        attributes: { scope: 'row', title: row.staffName }
      }));
      state.rota.days.forEach((day) => {
        const entries = getCellEntries(row, day.date);
        const cell = uiHelpers.createElement('td', {
          className: [
            'rota-mobile-week-cell',
            day.date === selectedDay.date ? 'is-selected' : '',
            entries.some((entry) => entry.kind === 'assigned') ? 'is-filled' : ''
          ].filter(Boolean).join(' ')
        });
        entries.forEach((entry) => {
          cell.appendChild(renderCellEntry(state, row, day, entry, actions));
        });
        tableRow.appendChild(cell);
      });
      tbody.appendChild(tableRow);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);

    return panel;
  };

  const createModalShell = (title, state, actions) => {
    const backdrop = uiHelpers.createElement('div', { className: 'rota-sheet-backdrop' });
    const panel = uiHelpers.createElement('section', { className: 'rota-modal-panel' });
    const header = uiHelpers.createElement('div', { className: 'rota-sheet-header' });
    header.appendChild(uiHelpers.createElement('strong', { text: title }));

    const cancelButton = uiHelpers.createElement('button', {
      className: 'rota-sheet-close',
      text: 'Cancel',
      attributes: { type: 'button' }
    });
    cancelButton.addEventListener('click', () => {
      state.modal = null;
      actions.render();
    });
    header.appendChild(cancelButton);

    panel.appendChild(header);
    const body = uiHelpers.createElement('div', { className: 'rota-modal-body' });
    panel.appendChild(body);
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', (event) => {
      if (event.target !== backdrop) {
        return;
      }

      state.modal = null;
      actions.render();
    });

    return { backdrop, body };
  };

  const renderModalError = (body, error) => {
    if (!error) {
      return;
    }

    const panel = uiHelpers.createElement('div', { className: 'rota-modal-error' });
    panel.appendChild(
      uiHelpers.createElement('p', {
        className: 'panel-copy panel-copy--strong',
        text: error.text
      })
    );

    if (Array.isArray(error.details) && error.details.length > 0) {
      const detailsList = uiHelpers.createElement('ul', {
        className: 'detail-list detail-list--dense'
      });
      error.details.forEach((detail) => {
        detailsList.appendChild(uiHelpers.createElement('li', { text: detail }));
      });
      panel.appendChild(detailsList);
    }

    body.appendChild(panel);
  };

  const renderManagerMenuModal = (state, actions) => {
    const context = state.modal.context;
    const { backdrop, body } = createModalShell(getContextTitle(context), state, actions);

    body.appendChild(
      uiHelpers.createElement('p', {
        className: 'panel-copy',
        text:
          context.kind === 'off' || context.kind === 'leave'
            ? 'Pick a name. Add asks for the time next.'
            : context.label
      })
    );

    renderModalError(body, state.modal.error);

    if (context.cell?.shiftId) {
      const quickActions = uiHelpers.createElement('div', {
        className: 'actions-row rota-modal-actions'
      });

      const changeTimeButton = uiHelpers.createElement('button', {
        className: 'action-button button-secondary',
        text: 'Change time',
        attributes: { type: 'button' }
      });
      changeTimeButton.addEventListener('click', () => {
        actions.openEditTimeModal(context);
      });
      quickActions.appendChild(changeTimeButton);

      if (context.cell.state === 'OPEN') {
        const removeShiftButton = uiHelpers.createElement('button', {
          className: 'action-button button-ghost',
          text: 'Delete shift',
          attributes: { type: 'button' }
        });
        removeShiftButton.addEventListener('click', async () => {
          await actions.removeShiftById(context.cell.shiftId, 'Open shift removed.');
        });
        quickActions.appendChild(removeShiftButton);
      }

      body.appendChild(quickActions);
    }

    if (state.staffLoading) {
      body.appendChild(
        uiHelpers.createElement('p', {
          className: 'panel-copy',
          text: 'Loading staff...'
        })
      );
      return backdrop;
    }

    const choices = buildManagerChoices(state, context);

    if (choices.length === 0) {
      body.appendChild(
        uiHelpers.createElement('p', {
          className: 'panel-copy',
          text: 'No active staff found.'
        })
      );
      return backdrop;
    }

    const list = uiHelpers.createElement('div', { className: 'rota-choice-list' });
    choices.forEach((choice) => {
      const row = uiHelpers.createElement('div', { className: 'rota-choice-row' });
      row.appendChild(
        uiHelpers.createElement('strong', {
          text: choice.staffMember.fullName
        })
      );

      const actionButton = uiHelpers.createElement('button', {
        className: 'action-button button-secondary rota-choice-button',
        text: choice.buttonLabel,
        attributes: {
          disabled: choice.disabled,
          type: 'button'
        }
      });
      actionButton.addEventListener('click', async () => {
        if (choice.mode === 'remove' && choice.existingCell?.shiftId) {
          await actions.removeShiftById(choice.existingCell.shiftId, 'Shift removed from the rota.');
          return;
        }

        actions.openAddModal(context, choice.staffMember);
      });

      row.appendChild(actionButton);
      list.appendChild(row);
    });
    body.appendChild(list);

    return backdrop;
  };

  const renderManagerAddModal = (state, actions) => {
    const { backdrop, body } = createModalShell(`Add ${state.modal.staffName}`, state, actions);

    body.appendChild(
      uiHelpers.createReviewList([
        { label: 'Day', value: state.modal.context.day.label },
        { label: 'Date', value: state.modal.context.day.date }
      ])
    );

    renderModalError(body, state.modal.error);

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });

    const createTimeField = (label, value, spanClass, updateField) => {
      const field = uiHelpers.createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      const input = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: {
          type: 'time',
          value
        }
      });
      input.addEventListener('input', () => {
        state.modal[updateField] = input.value;
        state.modal.error = null;
      });
      field.appendChild(input);
      grid.appendChild(field);
    };

    createTimeField('Start time', state.modal.startTime, 'form-field--span-6', 'startTime');
    createTimeField('End time', state.modal.endTime, 'form-field--span-6', 'endTime');
    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', {
      className: 'actions-row rota-modal-actions'
    });
    const cancelButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Cancel',
      attributes: { type: 'button' }
    });
    cancelButton.addEventListener('click', () => {
      state.modal = null;
      actions.render();
    });
    actionsRow.appendChild(cancelButton);

    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Add and save',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await actions.addShiftForStaff();
    });

    body.appendChild(form);
    return backdrop;
  };

  const renderManagerEditModal = (state, actions) => {
    const { backdrop, body } = createModalShell('Change time', state, actions);

    body.appendChild(
      uiHelpers.createReviewList([
        { label: 'Day', value: state.modal.context.day.label },
        { label: 'Date', value: state.modal.context.day.date }
      ])
    );

    renderModalError(body, state.modal.error);

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });

    const createTimeField = (label, value, spanClass, updateField) => {
      const field = uiHelpers.createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      const input = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: {
          type: 'time',
          value
        }
      });
      input.addEventListener('input', () => {
        state.modal[updateField] = input.value;
        state.modal.error = null;
      });
      field.appendChild(input);
      grid.appendChild(field);
    };

    createTimeField('Start time', state.modal.startTime, 'form-field--span-6', 'startTime');
    createTimeField('End time', state.modal.endTime, 'form-field--span-6', 'endTime');
    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', {
      className: 'actions-row rota-modal-actions'
    });
    const cancelButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Cancel',
      attributes: { type: 'button' }
    });
    cancelButton.addEventListener('click', () => {
      state.modal = null;
      actions.render();
    });
    actionsRow.appendChild(cancelButton);

    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Save time',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await actions.saveEditedTime();
    });

    body.appendChild(form);
    return backdrop;
  };

  const renderStaffSwapModal = (state, actions) => {
    const { backdrop, body } = createModalShell('Request swap', state, actions);
    const context = state.modal.context;

    body.appendChild(
      uiHelpers.createReviewList([
        { label: 'Day', value: context.day.label },
        { label: 'Date', value: context.day.date },
        { label: 'Shift', value: context.label }
      ])
    );
    body.appendChild(
      uiHelpers.createElement('p', {
        className: 'panel-copy',
        text: 'Ask the manager to change this shift.'
      })
    );

    return backdrop;
  };

  const renderModal = (state, actions) => {
    if (!state.modal) {
      return null;
    }

    switch (state.modal.type) {
      case 'manager-menu':
        return renderManagerMenuModal(state, actions);
      case 'manager-add':
        return renderManagerAddModal(state, actions);
      case 'manager-edit':
        return renderManagerEditModal(state, actions);
      case 'staff-swap':
        return renderStaffSwapModal(state, actions);
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

      clearModalHost();
      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid rota-workspace' });
      const flashPanel = uiHelpers.renderFlash(state.flash);

      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      if (state.loading) {
        grid.appendChild(uiHelpers.createEmptyPanel('Loading rota', 'Loading this week.'));
        workspaceElement.appendChild(grid);
        return;
      }

      grid.appendChild(renderWeekControls(state, actions));

      const tabs = renderDepartmentTabs(state, actions);
      if (tabs) {
        grid.appendChild(tabs);
      }

      grid.appendChild(renderDesktopGrid(state, actions));
      grid.appendChild(renderMobilePanel(state, actions));
      workspaceElement.appendChild(grid);

      const modal = renderModal(state, actions);
      if (modal) {
        modal.id = modalHostId;
        document.body.appendChild(modal);
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
          department: 'ALL',
          weekStart: state.weekStart
        });
        const result = await apiClient.get(`/api/v1/rota?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.rota = result.rota;
        state.selectedDay = getInitialSelectedDay(result.rota.days, state.selectedDay);
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

    const openEntryContext = async (context) => {
      if (state.sessionUser?.role === 'MANAGER') {
        state.modal = {
          context,
          error: null,
          type: 'manager-menu'
        };
        render();
        await loadStaff();
        render();
        return;
      }

      if (context.kind !== 'assigned') {
        return;
      }

      state.modal = {
        context,
        type: 'staff-swap'
      };
      render();
    };

    const openAddModal = (context, staffMember) => {
      const defaultTimes = getDefaultShiftTimes(state.department, context);
      state.modal = {
        context,
        endTime: defaultTimes.endTime,
        error: null,
        staffName: staffMember.fullName,
        staffProfileId: staffMember.id,
        startTime: defaultTimes.startTime,
        type: 'manager-add'
      };
      render();
    };

    const openEditTimeModal = (context) => {
      state.modal = {
        context,
        endTime: context.cell?.endTime || '17:00',
        error: null,
        startTime: context.cell?.startTime || '09:00',
        type: 'manager-edit'
      };
      render();
    };

    const removeShiftById = async (shiftId, successText) => {
      try {
        await apiClient.delete(`/api/v1/shifts/${shiftId}`);
        state.modal = null;
        await loadRota({
          details: [],
          text: successText,
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not remove this shift.');

        if (state.modal) {
          state.modal = {
            ...state.modal,
            error: feedback
          };
          render();
          return;
        }

        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const addShiftForStaff = async () => {
      const modal = state.modal;
      const context = modal.context;
      const shiftPayload = {
        endTime: modal.endTime,
        notes: null,
        requiredRole: state.department,
        shiftDate: context.day.date,
        startTime: modal.startTime,
        status: 'OPEN'
      };

      let createdShiftId = null;

      try {
        let shiftId = context.cell?.state === 'OPEN' ? context.cell.shiftId : null;

        if (shiftId) {
          if (
            context.cell.startTime !== modal.startTime ||
            context.cell.endTime !== modal.endTime
          ) {
            await apiClient.put(`/api/v1/shifts/${shiftId}`, {
              endTime: modal.endTime,
              startTime: modal.startTime
            });
          }
        } else {
          const reusableOpenShift = findOpenShiftCell(
            state,
            context.day.date,
            modal.startTime,
            modal.endTime
          );

          if (reusableOpenShift) {
            shiftId = reusableOpenShift.shiftId;
          } else {
            const createdShift = await apiClient.post('/api/v1/shifts', shiftPayload);
            shiftId = createdShift.shift.id;
            createdShiftId = shiftId;
          }
        }

        const result = await apiClient.post('/api/v1/assignments', {
          shiftId,
          staffProfileId: modal.staffProfileId
        });
        const warningDetails = getAssignmentWarningDetails(result);
        state.modal = null;
        await loadRota({
          details: warningDetails,
          text:
            warningDetails.length > 0
              ? 'Saved, but check the hours warning.'
              : 'Shift added to the rota.',
          tone: warningDetails.length > 0 ? 'warning' : 'success'
        });
      } catch (error) {
        if (createdShiftId) {
          try {
            await apiClient.delete(`/api/v1/shifts/${createdShiftId}`);
          } catch (cleanupError) {
            // Ignore cleanup failures and show the original error.
          }
        }

        state.modal = {
          ...state.modal,
          error: uiHelpers.getErrorFeedback(error, 'Could not save this shift.')
        };
        render();
      }
    };

    const saveEditedTime = async () => {
      const modal = state.modal;

      try {
        await apiClient.put(`/api/v1/shifts/${modal.context.cell.shiftId}`, {
          endTime: modal.endTime,
          startTime: modal.startTime
        });

        state.modal = null;
        await loadRota({
          details: [],
          text: 'Shift time changed.',
          tone: 'success'
        });
      } catch (error) {
        state.modal = {
          ...state.modal,
          error: uiHelpers.getErrorFeedback(error, 'Could not change this shift time.')
        };
        render();
      }
    };

    const actions = {
      addShiftForStaff,
      loadRota,
      openAddModal,
      openEditTimeModal,
      openEntryContext,
      removeShiftById,
      render,
      saveEditedTime
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

      clearModalHost();
      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Sign in needed',
        'Sign in to view the weekly rota.'
      );
    }
  };

  return {
    mount
  };
})();
