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

  const buildState = (initialWeekStart) => {
    return {
      department: 'BAR',
      draft: null,
      draftLoading: false,
      draftSaving: false,
      draftSourceWeekStart: null,
      flash: null,
      loading: true,
      modal: null,
      pendingFocusKey: null,
      rota: null,
      selectedDay: null,
      sessionUser: null,
      staff: [],
      staffLoading: false,
      weekStart: /^\d{4}-\d{2}-\d{2}$/.test(initialWeekStart || '')
        ? initialWeekStart
        : uiHelpers.getCurrentWeekStart()
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

  const getFocusableElements = (container) => {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  };

  const getEntryFocusKey = (row, day, item) => {
    return [
      day.date,
      row.staffProfileId || row.staffName,
      item.kind,
      item.cell?.assignmentId || item.cell?.shiftId || item.label
    ].join('|');
  };

  const addDays = (dateValue, offsetDays) => {
    const date = new Date(`${dateValue}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };

  const getDayOffset = (dateValue) => {
    const day = new Date(`${dateValue}T00:00:00Z`).getUTCDay();
    return day === 0 ? 6 : day - 1;
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

    return `${String(hour).padStart(2, '0')}:${minuteText}`;
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

    return `${String(hour).padStart(2, '0')}:${minuteText}`;
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

  const formatDate = (dateValue) => {
    if (!dateValue || typeof dateValue !== 'string' || dateValue.length < 10) {
      return dateValue || '';
    }

    return `${dateValue.slice(8, 10)}/${dateValue.slice(5, 7)}/${dateValue.slice(0, 4)}`;
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

  const getMinutes = (timeValue) => {
    const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number);
    return (hours * 60) + minutes;
  };

  const overlaps = (left, right) => {
    return getMinutes(left.startTime) <= getMinutes(right.endTime) &&
      getMinutes(right.startTime) <= getMinutes(left.endTime);
  };

  const getCellHours = (cell) => {
    return Math.max(0, (getMinutes(cell.endTime) - getMinutes(cell.startTime)) / 60);
  };

  const collectShiftTemplates = (rota) => {
    const templates = new Map();
    (rota?.rows || []).forEach((row) => {
      Object.values(row.days || {}).flat().forEach((cell) => {
        if (!cell.shiftId || !cell.shiftDate || !cell.startTime || !cell.endTime) {
          return;
        }
        templates.set(cell.shiftId, {
          endTime: cell.endTime,
          requiredRole: cell.department || row.primaryRole,
          shiftDate: cell.shiftDate,
          startTime: cell.startTime
        });
      });
    });
    return [...templates.values()];
  };

  const buildBalancedShiftTemplates = (shiftTemplates, targetWeekStart) => {
    if (shiftTemplates.length === 0) {
      return [];
    }

    const templatesByDay = new Map();
    shiftTemplates.forEach((template) => {
      const dayOffset = getDayOffset(template.shiftDate);
      const dayTemplates = templatesByDay.get(dayOffset) || [];
      dayTemplates.push(template);
      templatesByDay.set(dayOffset, dayTemplates);
    });

    const busiestDayTemplates = [...templatesByDay.values()]
      .sort((left, right) => right.length - left.length)[0] || [];

    return Array.from({ length: 7 }, (_, dayOffset) => {
      const shiftDate = addDays(targetWeekStart, dayOffset);
      return busiestDayTemplates.map((template) => ({
        ...template,
        shiftDate,
        shiftId: null,
        generated: true
      }));
    }).flat();
  };

  const buildDraftRota = (state, shiftTemplates = []) => {
    const existingOpenShifts = getOpenShiftItems(state).map((item) => ({
      endTime: item.cell.endTime,
      requiredRole: item.cell.department,
      shiftDate: item.day.date,
      shiftId: item.cell.shiftId,
      startTime: item.cell.startTime
    }));
    const existingKeys = new Set(existingOpenShifts.map((shift) => `${shift.shiftDate}|${shift.startTime}|${shift.endTime}|${shift.requiredRole}`));
    const generatedShifts = buildBalancedShiftTemplates(shiftTemplates, state.weekStart)
      .filter((shift) => {
        const key = `${shift.shiftDate}|${shift.startTime}|${shift.endTime}|${shift.requiredRole}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
    const openShifts = [...existingOpenShifts, ...generatedShifts];
    const staffRows = (state.rota?.rows || []).filter((row) => !row.systemRow);
    const workloads = new Map();

    staffRows.forEach((row) => {
      const workload = { hours: 0, shifts: 0, cells: [] };
      Object.values(row.days || {}).flat().forEach((cell) => {
        if (cell.state === 'ASSIGNED') {
          workload.hours += getCellHours(cell);
          workload.shifts += 1;
          workload.cells.push(cell);
        }
      });
      workloads.set(row.staffProfileId, workload);
    });

    const suggestions = [];
    const unfilled = [];
    const orderedShifts = [...openShifts].sort((left, right) => {
      const leftMatches = state.staff.filter((staff) => staff.primaryRole === left.requiredRole).length;
      const rightMatches = state.staff.filter((staff) => staff.primaryRole === right.requiredRole).length;
      return leftMatches - rightMatches || left.shiftDate.localeCompare(right.shiftDate) || left.startTime.localeCompare(right.startTime);
    });

    orderedShifts.forEach((shift) => {
      const candidates = state.staff.filter((staff) => {
        const workload = workloads.get(staff.id);
        const row = staffRows.find((candidateRow) => candidateRow.staffProfileId === staff.id);
        const dayCells = row?.days?.[shift.shiftDate] || [];
        const onLeave = dayCells.some((cell) => cell.state === 'APPROVED_LEAVE');
        const hasConflict = [...(workload?.cells || []), ...(suggestions.filter((item) => item.staffProfileId === staff.id))]
          .some((cell) => cell.shiftDate === shift.shiftDate && overlaps(cell, shift));

        return staff.primaryRole === shift.requiredRole &&
          workload &&
          !onLeave &&
          !hasConflict &&
          workload.shifts < 5 &&
          workload.hours + getCellHours(shift) <= 40;
      }).sort((left, right) => {
        const leftWorkload = workloads.get(left.id);
        const rightWorkload = workloads.get(right.id);
        return (leftWorkload.shifts - rightWorkload.shifts) ||
          (leftWorkload.hours - rightWorkload.hours) ||
          left.fullName.localeCompare(right.fullName);
      });

      const selectedStaff = candidates[0];
      if (!selectedStaff) {
        unfilled.push({ ...shift, reason: 'No eligible staff member passed the role, leave, conflict, and weekly-limit checks.' });
        return;
      }

      const workload = workloads.get(selectedStaff.id);
      const suggestion = {
        ...shift,
        fullName: selectedStaff.fullName,
        staffProfileId: selectedStaff.id,
        status: 'SUGGESTED'
      };
      suggestions.push(suggestion);
      workload.shifts += 1;
      workload.hours += getCellHours(shift);
    });

    return {
      suggestions,
      sourceShiftCount: shiftTemplates.length,
      unfilled,
      generatedShifts: generatedShifts.length,
      weekStart: state.weekStart,
      summary: {
        assigned: suggestions.length,
        hours: Number(suggestions.reduce((total, shift) => total + getCellHours(shift), 0).toFixed(2)),
        unfilled: unfilled.length
      }
    };
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
    const dayText = `${context.day.label} ${formatDate(context.day.date)}`;

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
        text: `${formatDate(state.weekStart)} to ${formatDate(state.rota?.weekEnd || addDays(state.weekStart, 6))}`
      })
    );
    panel.appendChild(title);

    const controls = uiHelpers.createElement('div', { className: 'rota-week-controls' });
    [
      { label: 'Previous Week', offset: -7 },
      { label: 'This Week', current: true },
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
        state.modal = null;
        state.selectedDay = null;
        actions.loadRota();
      });
      controls.appendChild(button);
    });
    if (state.sessionUser?.role === 'MANAGER') {
      const populateButton = uiHelpers.createElement('button', {
        className: 'action-button button-primary rota-populate-button',
        text: 'Populate next week',
        attributes: { disabled: state.draftLoading, type: 'button' }
      });
      populateButton.addEventListener('click', actions.generateDraft);
      controls.appendChild(populateButton);
    }
    panel.appendChild(controls);

    return panel;
  };

  const renderDraftPreview = (state, actions) => {
    if (!state.draft) {
      return null;
    }

    const shell = uiHelpers.createElement('section', { className: 'rota-draft-shell' });
    const heading = uiHelpers.createElement('div', { className: 'rota-draft-heading' });
    heading.appendChild(uiHelpers.createElement('div', {
      className: 'rota-draft-eyebrow',
      text: 'Draft rota · not saved yet'
    }));
    heading.appendChild(uiHelpers.createElement('h2', { text: `Next week starting ${formatDate(state.draft.weekStart)}` }));
    heading.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'The shift pattern is copied from this week, then staff are suggested for next week. Review it before approval. Nothing is saved yet.' }));
    shell.appendChild(heading);

    const legend = uiHelpers.createElement('div', { className: 'rota-draft-legend' });
    [
      ['Suggested', 'New assignment from this preview', 'is-suggested'],
      ['Existing', 'Already saved on the rota', 'is-existing'],
      ['Leave', 'Approved leave marker', 'is-leave']
    ].forEach(([label, explanation, tone]) => {
      const item = uiHelpers.createElement('span', { className: 'rota-draft-legend-item' });
      item.appendChild(uiHelpers.createElement('b', { className: `rota-draft-legend-dot ${tone}` }));
      item.appendChild(uiHelpers.createElement('strong', { text: label }));
      item.appendChild(uiHelpers.createElement('small', { text: explanation }));
      legend.appendChild(item);
    });
    shell.appendChild(legend);

    if (state.draft.sourceShiftCount === 0 && state.draft.summary.assigned === 0) {
      const emptyNotice = uiHelpers.createElement('div', { className: 'rota-draft-warning' });
      emptyNotice.appendChild(uiHelpers.createElement('strong', { text: 'No shift pattern found' }));
      emptyNotice.appendChild(uiHelpers.createElement('span', { text: 'Create at least one shift in the current week first. The next-week preview copies the current rota pattern.' }));
      shell.appendChild(emptyNotice);
    }

    const cards = uiHelpers.createElement('div', { className: 'rota-draft-cards' });
    [
      ['New shifts', state.draft.generatedShifts, 'accent'],
      ['Suggested', state.draft.summary.assigned, 'accent'],
      ['Hours', state.draft.summary.hours, 'neutral'],
      ['Needs attention', state.draft.summary.unfilled, state.draft.summary.unfilled ? 'warning' : 'success']
    ].forEach(([label, value, tone]) => {
      const card = uiHelpers.createElement('article', { className: `rota-draft-card rota-draft-card--${tone}` });
      card.appendChild(uiHelpers.createElement('span', { text: label }));
      card.appendChild(uiHelpers.createElement('strong', { text: String(value) }));
      cards.appendChild(card);
    });
    shell.appendChild(cards);

    const tablePanel = uiHelpers.createElement('div', { className: 'rota-draft-table-panel' });
    const table = uiHelpers.createElement('table', { className: 'rota-draft-table' });
    const header = uiHelpers.createElement('tr');
    header.appendChild(uiHelpers.createElement('th', { text: 'Staff member' }));
    (state.rota?.days || []).forEach((day) => header.appendChild(uiHelpers.createElement('th', { text: day.label.slice(0, 3) })));
    table.appendChild(header);
    (state.rota?.rows || []).filter((row) => !row.systemRow).forEach((row) => {
      const tableRow = uiHelpers.createElement('tr');
      tableRow.appendChild(uiHelpers.createElement('th', { text: row.staffName }));
      (state.rota?.days || []).forEach((day) => {
        const cell = uiHelpers.createElement('td');
        const existing = (row.days?.[day.date] || []).filter((entry) => entry.state === 'ASSIGNED' || entry.state === 'APPROVED_LEAVE');
        const drafts = state.draft.suggestions.filter((entry) => entry.staffProfileId === row.staffProfileId && entry.shiftDate === day.date);
        [...existing, ...drafts].forEach((entry) => {
          const badge = uiHelpers.createElement('span', { className: `rota-draft-shift${entry.status === 'SUGGESTED' ? ' is-suggested' : ''}`, text: entry.state === 'APPROVED_LEAVE' ? 'Leave' : `${formatCompactClock(entry.startTime)}-${formatCompactClock(entry.endTime)}` });
          cell.appendChild(badge);
        });
        if (!cell.childNodes.length) cell.appendChild(uiHelpers.createElement('span', { className: 'rota-draft-off', text: '—' }));
        tableRow.appendChild(cell);
      });
      table.appendChild(tableRow);
    });
    tablePanel.appendChild(table);
    shell.appendChild(tablePanel);

    if (state.draft.unfilled.length > 0) {
      const warning = uiHelpers.createElement('div', { className: 'rota-draft-warning' });
      warning.appendChild(uiHelpers.createElement('strong', { text: `${state.draft.unfilled.length} shift${state.draft.unfilled.length === 1 ? '' : 's'} still open` }));
      state.draft.unfilled.slice(0, 4).forEach((shift) => warning.appendChild(uiHelpers.createElement('span', { text: `${formatDate(shift.shiftDate)} · ${formatCompactClock(shift.startTime)}-${formatCompactClock(shift.endTime)} · ${shift.reason}` })));
      shell.appendChild(warning);
    }

    const actionsRow = uiHelpers.createElement('div', { className: 'rota-draft-actions' });
    const approve = uiHelpers.createElement('button', { className: 'action-button button-primary', text: `Approve ${state.draft.summary.assigned} suggestions`, attributes: { disabled: state.draft.summary.assigned === 0 || state.draftSaving, type: 'button' } });
    const retry = uiHelpers.createElement('button', { className: 'action-button button-secondary', text: 'Try again', attributes: { disabled: state.draftSaving, type: 'button' } });
    const dismiss = uiHelpers.createElement('button', { className: 'action-button button-ghost', text: 'Dismiss', attributes: { disabled: state.draftSaving, type: 'button' } });
    approve.addEventListener('click', actions.approveDraft);
    retry.addEventListener('click', actions.generateDraft);
    dismiss.addEventListener('click', actions.dismissDraft);
    actionsRow.append(approve, retry, dismiss);
    shell.appendChild(actionsRow);
    return shell;
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
        actions.loadRota(null, true);
      });
      tabs.appendChild(button);
    });

    return tabs;
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
        const focusKey = getEntryFocusKey(row, day, item);
        const markerButton = uiHelpers.createElement('button', {
          className: 'rota-required-marker rota-required-marker--button',
          text: '*',
          attributes: {
            'aria-label': 'Open rota options',
            'data-rota-focus-key': focusKey,
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
            returnFocusKey: focusKey,
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
        className: 'rota-table-corner',
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
        actions.loadRota(null, true);
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
    title.appendChild(uiHelpers.createElement('strong', { text: formatDate(selectedDay.date) }));
    header.appendChild(title);

    const controls = uiHelpers.createElement('div', { className: 'rota-mobile-day-controls' });
    [
      { label: 'Previous Week', offset: -7 },
      { label: 'This Week', current: true },
      { label: 'Next Week', offset: 7 }
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
    headRow.appendChild(uiHelpers.createElement('th', { className: 'rota-mobile-corner', text: '' }));
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
    const titleId = `rota-modal-title-${state.modal.type}`;
    const closeModal = () => {
      state.pendingFocusKey = state.modal?.returnFocusKey || null;
      state.modal = null;
      actions.render();
    };
    const backdrop = uiHelpers.createElement('div', { className: 'rota-sheet-backdrop' });
    const panel = uiHelpers.createElement('section', {
      className: 'rota-modal-panel',
      attributes: {
        'aria-labelledby': titleId,
        'aria-modal': 'true',
        role: 'dialog',
        tabindex: '-1'
      }
    });
    const header = uiHelpers.createElement('div', { className: 'rota-sheet-header' });
    header.appendChild(uiHelpers.createElement('h2', {
      text: title,
      attributes: { id: titleId }
    }));

    const cancelButton = uiHelpers.createElement('button', {
      className: 'rota-sheet-close',
      text: 'Cancel',
      attributes: { type: 'button' }
    });
    cancelButton.addEventListener('click', closeModal);
    header.appendChild(cancelButton);

    panel.appendChild(header);
    const body = uiHelpers.createElement('div', { className: 'rota-modal-body' });
    panel.appendChild(body);
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', (event) => {
      if (event.target !== backdrop) {
        return;
      }

      closeModal();
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });

    return { backdrop, body, panel };
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
        { label: 'Date', value: formatDate(state.modal.context.day.date) }
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
      state.pendingFocusKey = state.modal?.returnFocusKey || null;
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
        { label: 'Date', value: formatDate(state.modal.context.day.date) }
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
      state.pendingFocusKey = state.modal?.returnFocusKey || null;
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
        { label: 'Date', value: formatDate(context.day.date) },
        { label: 'Shift', value: context.label }
      ])
    );
    body.appendChild(uiHelpers.createElement('p', {
      className: 'panel-copy',
      text: 'Choose a colleague or leave this open for any eligible colleague to accept.'
    }));
    renderModalError(body, state.modal.error);

    const form = uiHelpers.createElement('form', { className: 'form-shell' });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });
    const targetField = uiHelpers.createElement('label', { className: 'form-field form-field--span-12' });
    targetField.appendChild(uiHelpers.createElement('span', { text: 'Request from' }));
    const targetSelect = uiHelpers.createElement('select', { className: 'input-control' });
    targetSelect.appendChild(uiHelpers.createElement('option', {
      text: 'Anyone eligible',
      attributes: { value: '' }
    }));
    const candidates = (state.rota?.rows || []).filter((row) => {
      return row.staffProfileId && row.staffProfileId !== state.sessionUser?.staffProfileId && row.primaryRole === context.cell?.department;
    });
    candidates.forEach((candidate) => {
      targetSelect.appendChild(uiHelpers.createElement('option', {
        text: candidate.staffName,
        attributes: { value: candidate.staffProfileId }
      }));
    });
    targetField.appendChild(targetSelect);
    grid.appendChild(targetField);
    const reasonField = uiHelpers.createElement('label', { className: 'form-field form-field--span-12' });
    reasonField.appendChild(uiHelpers.createElement('span', { text: 'Reason (optional)' }));
    const reasonInput = uiHelpers.createElement('textarea', { className: 'input-control input-control--textarea', attributes: { rows: 3, maxlength: 500 } });
    reasonField.appendChild(reasonInput);
    grid.appendChild(reasonField);
    form.appendChild(grid);
    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', { className: 'action-button button-primary', text: 'Send swap request', attributes: { type: 'submit' } });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
      await actions.requestSwap({
        assignmentId: context.cell.assignmentId,
        reason: reasonInput.value.trim(),
        targetStaffProfileId: targetSelect.value || null
      });
    });
    body.appendChild(form);

    return backdrop;
  };

  const renderStaffMenuModal = (state, actions) => {
    const { backdrop, body } = createModalShell('My shift options', state, actions);
    const context = state.modal.context;

    body.appendChild(uiHelpers.createReviewList([
      { label: 'Day', value: context.day.label },
      { label: 'Date', value: formatDate(context.day.date) },
      { label: 'Shift', value: context.label }
    ]));
    body.appendChild(uiHelpers.createElement('p', {
      className: 'panel-copy',
      text: 'Only you can see these options for your own assigned shift.'
    }));

    const swapButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Request swap',
      attributes: { type: 'button' }
    });
    swapButton.addEventListener('click', () => actions.openStaffSwapModal(context));
    body.appendChild(uiHelpers.createElement('div', { className: 'actions-row' }));
    body.lastChild.appendChild(swapButton);
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
      case 'staff-menu':
        return renderStaffMenuModal(state, actions);
      default:
        return null;
    }
  };

  const mount = async ({ page, workspaceElement, renderToken, initialWeekStart }) => {
    if (page.id !== 'rota') {
      return;
    }

    const state = buildState(initialWeekStart);

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      clearModalHost();
      workspaceElement.textContent = '';
      const grid = uiHelpers.createElement('div', { className: 'workspace-grid rota-workspace rota-protected-view' });
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

      if (state.draft) {
        grid.appendChild(renderDraftPreview(state, actions));
        workspaceElement.appendChild(grid);
        return;
      }

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
        window.requestAnimationFrame(() => {
          const panel = modal.querySelector('[role="dialog"]');
          const body = panel?.querySelector('.rota-modal-body');
          const firstBodyControl = body ? getFocusableElements(body)[0] : null;
          (firstBodyControl || panel)?.focus();
        });
      } else if (state.pendingFocusKey) {
        const focusKey = state.pendingFocusKey;
        state.pendingFocusKey = null;
        window.requestAnimationFrame(() => {
          const trigger = Array.from(
            document.querySelectorAll('[data-rota-focus-key]')
          ).find((element) => element.dataset.rotaFocusKey === focusKey);
          trigger?.focus();
        });
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

    const animateDepartmentChange = async (direction) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      const animation = workspaceElement.animate(
        direction === 'out'
          ? [
              { opacity: 1, transform: 'translateY(0)' },
              { opacity: 0, transform: 'translateY(8px)' }
            ]
          : [
              { opacity: 0, transform: 'translateY(-8px)' },
              { opacity: 1, transform: 'translateY(0)' }
            ],
        {
          duration: direction === 'out' ? 140 : 260,
          easing: direction === 'out'
            ? 'cubic-bezier(0.4, 0, 0.2, 1)'
            : 'cubic-bezier(0.32, 0.72, 0, 1)',
          fill: 'forwards'
        }
      );

      await animation.finished.catch(() => undefined);
    };

    const loadRota = async (nextFlash = null, shouldAnimate = false) => {
      if (shouldAnimate) {
        await animateDepartmentChange('out');
      }

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
        if (shouldAnimate) {
          await animateDepartmentChange('in');
        }
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load the rota.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
        if (shouldAnimate) {
          await animateDepartmentChange('in');
        }
      }
    };

    const dismissDraft = () => {
      state.draft = null;
      state.draftSaving = false;
      state.draftSourceWeekStart = null;
      state.weekStart = uiHelpers.getCurrentWeekStart();
      loadRota();
    };

    const generateDraft = async () => {
      const sourceWeekStart = state.draftSourceWeekStart || state.weekStart;
      state.draftSourceWeekStart = sourceWeekStart;
      state.draftLoading = true;
      state.draft = null;
      state.draftSaving = false;
      state.weekStart = sourceWeekStart;
      state.selectedDay = null;
      render();
      try {
        await loadRota();
        const shiftTemplates = collectShiftTemplates(state.rota);
        state.weekStart = addDays(sourceWeekStart, 7);
        state.selectedDay = null;
        await loadRota();
        await loadStaff();
        state.draft = buildDraftRota(state, shiftTemplates);
      } catch (error) {
        state.weekStart = sourceWeekStart;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not prepare next week.');
        setFlash(state, 'error', feedback.text, feedback.details);
      }
      state.draftLoading = false;
      render();
    };

    const approveDraft = async () => {
      if (!state.draft || state.draft.suggestions.length === 0) {
        return;
      }

      state.draftSaving = true;
      render();
      let savedCount = 0;
      try {
        for (const suggestion of state.draft.suggestions) {
          let shiftId = suggestion.shiftId;
          if (!shiftId) {
            const createdShift = await apiClient.post('/api/v1/shifts', {
              endTime: suggestion.endTime,
              notes: 'Generated from the busiest previous day pattern across all seven days.',
              requiredRole: suggestion.requiredRole,
              shiftDate: suggestion.shiftDate,
              startTime: suggestion.startTime,
              status: 'OPEN'
            });
            shiftId = createdShift.shift.id;
          }
          await apiClient.post('/api/v1/assignments', {
            shiftId,
            staffProfileId: suggestion.staffProfileId
          });
          savedCount += 1;
        }
        state.draft = null;
        state.draftSaving = false;
        state.draftSourceWeekStart = null;
        await loadRota({
          details: [],
          text: `${savedCount} next-week assignment${savedCount === 1 ? '' : 's'} approved and saved.`,
          tone: 'success'
        });
      } catch (error) {
        state.draftSaving = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Approval stopped because one assignment changed.');
        await loadRota({
          details: feedback.details,
          text: `${savedCount} saved. ${feedback.text}`,
          tone: 'warning'
        });
      }
    };

    const openEntryContext = async (context) => {
      if (state.sessionUser?.role === 'MANAGER') {
        state.modal = {
          context,
          error: null,
          returnFocusKey: context.returnFocusKey,
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
        returnFocusKey: context.returnFocusKey,
        type: 'staff-menu'
      };
      render();
    };

    const openStaffSwapModal = (context) => {
      state.modal = {
        context,
        returnFocusKey: state.modal?.returnFocusKey || context.returnFocusKey,
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
        returnFocusKey: state.modal?.returnFocusKey || context.returnFocusKey,
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
        returnFocusKey: state.modal?.returnFocusKey || context.returnFocusKey,
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

    const requestSwap = async (swapInput) => {
      try {
        await apiClient.post('/api/v1/shift-swaps', swapInput);
        state.modal = null;
        await loadRota({
          details: [],
          text: 'Swap request sent to the manager.',
          tone: 'success'
        });
      } catch (error) {
        state.modal = {
          ...state.modal,
          error: uiHelpers.getErrorFeedback(error, 'Could not send the swap request.')
        };
        render();
      }
    };

    const actions = {
      addShiftForStaff,
      approveDraft,
      dismissDraft,
      generateDraft,
      loadRota,
      openAddModal,
      openEditTimeModal,
      openEntryContext,
      openStaffSwapModal,
      removeShiftById,
      render,
      requestSwap,
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
