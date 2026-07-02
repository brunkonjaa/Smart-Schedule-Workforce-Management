window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.assignmentsUi = (function createAssignmentsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const buildState = () => {
    return {
      assignments: [],
      flash: null,
      loading: true,
      selectedShiftId: '',
      selectedStaffProfileId: '',
      sessionUser: null,
      shifts: [],
      staff: [],
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

  const getSelectedShift = (state) => {
    return state.shifts.find((shift) => shift.id === state.selectedShiftId) || null;
  };

  const getSelectedStaff = (state) => {
    return state.staff.find((staffMember) => {
      return staffMember.id === state.selectedStaffProfileId;
    }) || null;
  };

  const getAssignmentForShift = (state, shiftId) => {
    return state.assignments.find((assignment) => assignment.shiftId === shiftId) || null;
  };

  const getShiftLabel = (shift) => {
    return `${shift.shiftDate} ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)} ${uiHelpers.formatRole(shift.requiredRole)}`;
  };

  const getAssignmentWarningDetails = (result) => {
    if (!Array.isArray(result?.warnings)) {
      return [];
    }

    return result.warnings
      .map((warning) => warning.message)
      .filter(Boolean);
  };

  const getCandidateStatus = (shift, staffMember, existingAssignment) => {
    if (existingAssignment) {
      return {
        blocked: true,
        label: 'Shift already assigned',
        tone: 'muted',
        warning: `${existingAssignment.fullName} is already saved on this shift.`
      };
    }

    if (shift && staffMember.primaryRole !== shift.requiredRole) {
      return {
        blocked: true,
        label: 'Role blocked',
        tone: 'warning',
        warning: `Backend blocks this because staff role is ${uiHelpers.formatRole(staffMember.primaryRole)} and shift needs ${uiHelpers.formatRole(shift.requiredRole)}.`
      };
    }

    return {
      blocked: false,
      label: 'Ready to check',
      tone: 'success',
      warning: 'Backend will still check leave, availability, overlapping or back-to-back shifts, and contract hours when saving.'
    };
  };

  const renderToolbar = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16 assignment-toolbar-panel'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Choose week and shift' }));
    toolbarRow.appendChild(toolbarTitle);

    const controls = uiHelpers.createElement('div', { className: 'toolbar-controls' });

    const weekLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    weekLabel.appendChild(uiHelpers.createElement('span', { text: 'Week start' }));
    const weekInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: {
        type: 'date',
        value: state.weekStart
      }
    });
    weekLabel.appendChild(weekInput);
    controls.appendChild(weekLabel);

    const shiftLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    shiftLabel.appendChild(uiHelpers.createElement('span', { text: 'Shift' }));
    const shiftSelect = uiHelpers.createElement('select', { className: 'input-control' });

    if (state.shifts.length === 0) {
      const option = uiHelpers.createElement('option', { text: 'No shifts this week' });
      option.value = '';
      shiftSelect.appendChild(option);
    } else {
      state.shifts.forEach((shift) => {
        const assignment = getAssignmentForShift(state, shift.id);
        const option = uiHelpers.createElement('option', {
          text: `${getShiftLabel(shift)}${assignment ? ` - assigned to ${assignment.fullName}` : ''}`
        });
        option.value = shift.id;
        option.selected = state.selectedShiftId === shift.id;
        shiftSelect.appendChild(option);
      });
    }

    shiftSelect.addEventListener('change', () => {
      state.selectedShiftId = shiftSelect.value;
      state.selectedStaffProfileId = '';
      actions.render();
    });
    shiftLabel.appendChild(shiftSelect);
    controls.appendChild(shiftLabel);

    const loadButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Load week',
      attributes: { type: 'button' }
    });
    loadButton.addEventListener('click', () => {
      state.weekStart = weekInput.value;
      state.selectedShiftId = '';
      state.selectedStaffProfileId = '';
      actions.loadAssignmentData();
    });
    controls.appendChild(loadButton);

    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderSelectedShift = (state, actions) => {
    const shift = getSelectedShift(state);
    const assignment = shift ? getAssignmentForShift(state, shift.id) : null;
    const selectedStaff = getSelectedStaff(state);
    const staffStatus = shift && selectedStaff
      ? getCandidateStatus(shift, selectedStaff, assignment)
      : null;
    const isBlocked = Boolean(staffStatus?.blocked);

    if (!shift) {
      return uiHelpers.createEmptyPanel(
        'No shift selected',
        'Create a shift first, then come back here to save an assignment.',
        'content-panel--span-6 assignment-shift-panel',
        {
          label: 'Create shift',
          targetPage: 'shifts',
          tone: 'primary'
        }
      );
    }

    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6 assignment-shift-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Selected shift',
        assignment
          ? 'This shift already has a saved backend assignment.'
          : 'Choose staff and save the assignment after backend conflict checks pass.'
      )
    );

    panel.appendChild(
      uiHelpers.createReviewList([
        { label: 'Date', value: shift.shiftDate },
        { label: 'Time', value: `${shift.startTime.slice(0, 5)} - ${shift.endTime.slice(0, 5)}` },
        { label: 'Required role', value: uiHelpers.formatRole(shift.requiredRole) },
        { label: 'Saved assignment', value: assignment ? assignment.fullName : 'Not assigned yet' },
        { label: 'Selected staff', value: selectedStaff ? selectedStaff.fullName : 'None selected' },
        { label: 'Current warning', value: staffStatus ? staffStatus.warning : 'Select staff to check.' }
      ])
    );

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const assignButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: assignment ? 'Already assigned' : 'Save assignment',
      attributes: {
        disabled: Boolean(assignment) || !selectedStaff || isBlocked,
        type: 'button'
      }
    });
    assignButton.addEventListener('click', () => {
      actions.assignStaff();
    });
    actionsRow.appendChild(assignButton);

    const clearButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Clear selection',
      attributes: { type: 'button' }
    });
    clearButton.addEventListener('click', () => {
      state.selectedStaffProfileId = '';
      setFlash(state, 'info', 'Staff selection cleared.');
      actions.render();
    });
    actionsRow.appendChild(clearButton);
    panel.appendChild(actionsRow);

    return panel;
  };

  const renderStaffTable = (state, actions) => {
    const shift = getSelectedShift(state);

    if (state.staff.length === 0) {
      return uiHelpers.createEmptyPanel(
        'No active staff found',
        'Add active staff before saving assignments.',
        'content-panel--span-10',
        {
          label: 'Add staff',
          targetPage: 'staff',
          tone: 'primary'
        }
      );
    }

    const assignment = shift ? getAssignmentForShift(state, shift.id) : null;
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10 assignment-staff-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Active staff',
        'Role, leave, availability, overlap, back-to-back shift, and contract-hours checks now run when the assignment is saved.'
      )
    );

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    ['Name', 'Role', 'Hours', 'Check', 'Action'].forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    state.staff.forEach((staffMember) => {
      const staffStatus = shift
        ? getCandidateStatus(shift, staffMember, assignment)
        : {
            blocked: true,
            label: 'No shift',
            tone: 'muted',
            warning: 'Choose a shift first.'
          };
      const row = uiHelpers.createElement('tr', {
        className: staffMember.id === state.selectedStaffProfileId ? 'table-row-selected' : ''
      });
      row.appendChild(uiHelpers.createTableCell('Name', staffMember.fullName));
      row.appendChild(uiHelpers.createTableCell('Role', uiHelpers.formatRole(staffMember.primaryRole)));
      row.appendChild(uiHelpers.createTableCell('Hours', `${staffMember.contractHours} hrs`));

      const statusCell = uiHelpers.createElement('td', {
        attributes: { 'data-label': 'Check' }
      });
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${staffStatus.tone}`,
          text: staffStatus.label
        })
      );
      row.appendChild(statusCell);

      const actionCell = uiHelpers.createElement('td', {
        attributes: { 'data-label': 'Action' }
      });
      const selectButton = uiHelpers.createElement('button', {
        className: 'action-button button-ghost action-button--compact',
        text: staffMember.id === state.selectedStaffProfileId ? 'Selected' : 'Select',
        attributes: {
          disabled: Boolean(assignment),
          type: 'button'
        }
      });
      selectButton.addEventListener('click', () => {
        actions.selectStaff(staffMember.id);
      });
      actionCell.appendChild(selectButton);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const renderSavedAssignments = (state) => {
    if (state.assignments.length === 0) {
      return uiHelpers.createEmptyPanel(
        'No saved assignments this week',
        'Assignments saved through the backend will appear here after you assign staff to a shift.',
        'content-panel--span-16'
      );
    }

    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-16'
    });
    panel.classList.add('assignment-saved-panel');
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Saved backend assignments',
        'These records come from /api/v1/assignments for the selected week.'
      )
    );

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    ['Shift', 'Role', 'Staff', 'Assigned at'].forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    state.assignments.forEach((assignment) => {
      const row = uiHelpers.createElement('tr');
      row.appendChild(
        uiHelpers.createTableCell(
          'Shift',
          `${assignment.shiftDate} ${assignment.startTime.slice(0, 5)}-${assignment.endTime.slice(0, 5)}`
        )
      );
      row.appendChild(uiHelpers.createTableCell('Role', uiHelpers.formatRole(assignment.requiredRole)));
      row.appendChild(uiHelpers.createTableCell('Staff', assignment.fullName));
      row.appendChild(
        uiHelpers.createTableCell(
          'Assigned at',
          assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleString() : 'Not set'
        )
      );
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'assignments') {
      return;
    }

    const state = buildState();

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      workspaceElement.textContent = '';
      uiHelpers.renderIntroMetrics([
        { label: 'Week start', value: state.weekStart, tone: 'accent' },
        {
          label: 'Shifts',
          value: state.loading ? 'Loading...' : String(state.shifts.length),
          tone: 'neutral'
        },
        {
          label: 'Saved assignments',
          value: state.loading ? 'Loading...' : String(state.assignments.length),
          tone: 'neutral'
        }
      ]);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--assignments' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      if (state.loading) {
        grid.appendChild(
          uiHelpers.createEmptyPanel(
            'Loading assignments',
            'Loading shifts, active staff, and saved backend assignments for this week.'
          )
        );
        workspaceElement.appendChild(grid);
        return;
      }

      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(
        uiHelpers.createStepsPanel(
          'How assignment works now',
          'This screen saves assignments to the backend and checks the main conflicts before a record is created.',
          [
            'Choose a week and shift from live shift records.',
            'Select an active staff member from the backend staff list.',
            'Save the assignment. The backend blocks duplicate shifts, role mismatch, approved leave, missing availability, and overlapping or back-to-back shifts. Contract hours return a warning.'
          ],
          'assignment-guide-panel'
        )
      );
      grid.appendChild(renderSelectedShift(state, actions));
      grid.appendChild(renderStaffTable(state, actions));
      grid.appendChild(renderSavedAssignments(state));

      workspaceElement.appendChild(grid);
    };

    const loadAssignmentData = async (nextFlash = null) => {
      state.loading = true;
      state.flash = nextFlash || {
        details: [],
        text: 'Loading assignment data...',
        tone: 'info'
      };
      render();

      try {
        const [shiftResult, staffResult, assignmentResult] = await Promise.all([
          apiClient.get(`/api/v1/shifts?weekStart=${state.weekStart}`),
          apiClient.get('/api/v1/staff?status=ACTIVE'),
          apiClient.get(`/api/v1/assignments?weekStart=${state.weekStart}`)
        ]);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.shifts = shiftResult.shifts;
        state.staff = staffResult.staff;
        state.assignments = assignmentResult.assignments;
        state.loading = false;
        state.flash = nextFlash;

        if (!state.selectedShiftId || !state.shifts.some((shift) => shift.id === state.selectedShiftId)) {
          const unassignedShift = state.shifts.find((shift) => !getAssignmentForShift(state, shift.id));
          state.selectedShiftId = unassignedShift ? unassignedShift.id : state.shifts[0]?.id || '';
        }

        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load assignment data.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const selectStaff = (staffProfileId) => {
      state.selectedStaffProfileId = staffProfileId;
      const selectedStaff = getSelectedStaff(state);
      const selectedShift = getSelectedShift(state);
      const assignment = selectedShift ? getAssignmentForShift(state, selectedShift.id) : null;
      const staffStatus = selectedShift && selectedStaff
        ? getCandidateStatus(selectedShift, selectedStaff, assignment)
        : null;

      if (selectedStaff && staffStatus) {
        setFlash(state, staffStatus.tone === 'warning' ? 'warning' : 'info', `${selectedStaff.fullName} selected.`, [
          staffStatus.warning
        ]);
      }

      render();
    };

    const assignStaff = async () => {
      const selectedShift = getSelectedShift(state);
      const selectedStaff = getSelectedStaff(state);

      if (!selectedShift || !selectedStaff) {
        setFlash(state, 'warning', 'Choose a shift and staff member first.');
        render();
        return;
      }

      if (getAssignmentForShift(state, selectedShift.id)) {
        setFlash(state, 'warning', 'This shift already has a saved assignment.');
        render();
        return;
      }

      const staffStatus = getCandidateStatus(
        selectedShift,
        selectedStaff,
        getAssignmentForShift(state, selectedShift.id)
      );

      if (staffStatus.blocked) {
        setFlash(state, 'warning', 'This assignment cannot be saved yet.', [
          staffStatus.warning
        ]);
        render();
        return;
      }

      try {
        const result = await apiClient.post('/api/v1/assignments', {
          shiftId: selectedShift.id,
          staffProfileId: selectedStaff.id
        });
        const warningDetails = getAssignmentWarningDetails(result);

        state.selectedStaffProfileId = '';
        await loadAssignmentData({
          details: warningDetails,
          text: warningDetails.length > 0
            ? `${selectedStaff.fullName} assigned to ${selectedShift.shiftDate}, but check the contract-hours warning.`
            : `${selectedStaff.fullName} assigned to ${selectedShift.shiftDate}.`,
          tone: warningDetails.length > 0 ? 'warning' : 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not save this assignment.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const actions = {
      assignStaff,
      loadAssignmentData,
      render,
      selectStaff
    };

    try {
      const sessionResult = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = sessionResult.user;

      if (state.sessionUser.role !== 'MANAGER') {
        uiHelpers.renderUnauthorized(
          workspaceElement,
          'Manager access required',
          'Only managers can assign staff to shifts.'
        );
        return;
      }

      await loadAssignmentData();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Session required',
        'Sign in with a manager account to assign staff to shifts.'
      );
    }
  };

  return {
    mount
  };
})();
