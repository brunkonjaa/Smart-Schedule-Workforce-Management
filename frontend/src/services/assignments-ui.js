window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.assignmentsUi = (function createAssignmentsUi() {
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const assignmentPresets = [
    {
      id: 'fri-bar',
      endTime: '22:00',
      requiredRole: 'BAR',
      shiftDate: '2026-06-19',
      startTime: '14:00',
      staff: [
        {
          baseConflict: null,
          contextNote: 'None',
          id: 'maya-quinn',
          name: 'Maya Quinn',
          role: 'BAR'
        },
        {
          baseConflict: null,
          contextNote: '26 / 30 hrs',
          id: 'alex-byrne',
          name: 'Alex Byrne',
          role: 'FLOOR'
        },
        {
          baseConflict: null,
          contextNote: '32 / 35 hrs',
          id: 'jamie-fox',
          name: 'Jamie Fox',
          role: 'BAR'
        }
      ],
      weekStart: '2026-06-15'
    },
    {
      id: 'sat-floor',
      endTime: '17:00',
      requiredRole: 'FLOOR',
      shiftDate: '2026-06-20',
      startTime: '09:00',
      staff: [
        {
          baseConflict: null,
          contextNote: 'None',
          id: 'alex-byrne',
          name: 'Alex Byrne',
          role: 'FLOOR'
        },
        {
          baseConflict: null,
          contextNote: '30 / 35 hrs',
          id: 'maya-quinn',
          name: 'Maya Quinn',
          role: 'BAR'
        },
        {
          baseConflict: 'leave',
          contextNote: 'Approved leave',
          id: 'sam-doyle',
          name: 'Sam Doyle',
          role: 'KITCHEN'
        }
      ],
      weekStart: '2026-06-15'
    }
  ];

  const cloneAssignments = () => {
    return assignmentPresets.map((assignment) => {
      return {
        ...assignment,
        assignedStaffId: null,
        staff: assignment.staff.map((staffMember) => ({ ...staffMember }))
      };
    });
  };

  const buildShiftLabel = (assignment) => {
    return `${assignment.shiftDate} - ${assignment.startTime} to ${assignment.endTime}`;
  };

  const buildState = () => {
    return {
      assignments: cloneAssignments(),
      draftShiftId: assignmentPresets[0].id,
      flash: null,
      selectedShiftId: assignmentPresets[0].id,
      selectedStaffId: null
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

  const getAssignmentById = (state, assignmentId) => {
    return (
      state.assignments.find((assignment) => assignment.id === assignmentId) ||
      state.assignments[0]
    );
  };

  const getDraftAssignment = (state) => {
    return getAssignmentById(state, state.draftShiftId);
  };

  const getSelectedAssignment = (state) => {
    return getAssignmentById(state, state.selectedShiftId);
  };

  const getStaffStatus = (assignment, staffMember) => {
    if (staffMember.baseConflict === 'leave') {
      return {
        availability: 'On leave',
        blocked: true,
        warning: 'Approved leave'
      };
    }

    if (staffMember.role !== assignment.requiredRole) {
      return {
        availability: 'Role mismatch',
        blocked: true,
        warning: 'Role conflict'
      };
    }

    return {
      availability: 'Available',
      blocked: false,
      warning: staffMember.contextNote || 'None'
    };
  };

  const getSelectedStaff = (assignment, state) => {
    return assignment.staff.find((staffMember) => staffMember.id === state.selectedStaffId) || null;
  };

  const getAssignedStaff = (assignment) => {
    return assignment.staff.find((staffMember) => staffMember.id === assignment.assignedStaffId) || null;
  };

  const updateAssignmentField = (state, fieldName, value) => {
    const assignment = getSelectedAssignment(state);
    assignment[fieldName] = value;

    if (fieldName === 'requiredRole' && assignment.assignedStaffId) {
      const assignedStaff = getAssignedStaff(assignment);
      if (assignedStaff && getStaffStatus(assignment, assignedStaff).blocked) {
        assignment.assignedStaffId = null;
      }
    }
  };

  const renderToolbar = (state, actions) => {
    const draftAssignment = getDraftAssignment(state);
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const controls = uiHelpers.createElement('div', { className: 'toolbar-controls' });

    const weekLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    weekLabel.appendChild(uiHelpers.createElement('span', { text: 'Week start' }));
    const weekInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'date', value: draftAssignment.weekStart }
    });
    weekInput.addEventListener('input', () => {
      draftAssignment.weekStart = weekInput.value;
    });
    weekLabel.appendChild(weekInput);
    controls.appendChild(weekLabel);

    const shiftLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    shiftLabel.appendChild(uiHelpers.createElement('span', { text: 'Shift' }));
    const shiftSelect = uiHelpers.createElement('select', { className: 'input-control' });
    state.assignments.forEach((assignment) => {
      const option = uiHelpers.createElement('option', { text: buildShiftLabel(assignment) });
      option.value = assignment.id;
      option.selected = state.draftShiftId === assignment.id;
      shiftSelect.appendChild(option);
    });
    shiftSelect.addEventListener('change', () => {
      state.draftShiftId = shiftSelect.value;
      actions.render();
    });
    shiftLabel.appendChild(shiftSelect);
    controls.appendChild(shiftLabel);

    const reviewButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Review shift',
      attributes: { type: 'button' }
    });
    reviewButton.addEventListener('click', () => {
      actions.reviewShift();
    });
    controls.appendChild(reviewButton);

    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderSelectedShift = (state, actions) => {
    const assignment = getSelectedAssignment(state);
    const selectedStaff = getSelectedStaff(assignment, state);
    const selectedStaffStatus = selectedStaff ? getStaffStatus(assignment, selectedStaff) : null;
    const assignedStaff = getAssignedStaff(assignment);

    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-5'
    });
    panel.appendChild(uiHelpers.createPanelHeading('Selected shift', 'Review and adjust the current assignment target.'));

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });

    const appendField = (label, inputElement, spanClass = 'form-field--span-12') => {
      const field = uiHelpers.createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      field.appendChild(inputElement);
      grid.appendChild(field);
    };

    const dateInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'date', value: assignment.shiftDate }
    });
    dateInput.addEventListener('input', () => {
      updateAssignmentField(state, 'shiftDate', dateInput.value);
    });
    appendField('Date', dateInput);

    const startInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'time', value: assignment.startTime }
    });
    startInput.addEventListener('input', () => {
      updateAssignmentField(state, 'startTime', startInput.value);
    });
    appendField('Start time', startInput, 'form-field--span-6');

    const endInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'time', value: assignment.endTime }
    });
    endInput.addEventListener('input', () => {
      updateAssignmentField(state, 'endTime', endInput.value);
    });
    appendField('End time', endInput, 'form-field--span-6');

    const roleSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['FLOOR', 'BAR', 'KITCHEN'].forEach((role) => {
      const option = uiHelpers.createElement('option', { text: role });
      option.value = role;
      option.selected = assignment.requiredRole === role;
      roleSelect.appendChild(option);
    });
    roleSelect.addEventListener('change', () => {
      updateAssignmentField(state, 'requiredRole', roleSelect.value);
      actions.render();
    });
    appendField('Required role', roleSelect);

    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const assignButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Assign selected staff',
      attributes: { type: 'button' }
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
      state.selectedStaffId = null;
      setFlash(state, 'info', 'Staff selection cleared.');
      actions.render();
    });
    actionsRow.appendChild(clearButton);
    form.appendChild(actionsRow);
    panel.appendChild(form);

    const noteList = uiHelpers.createElement('ul', { className: 'detail-list' });
    if (selectedStaff && selectedStaffStatus) {
      noteList.appendChild(
        uiHelpers.createElement('li', {
          text: `Selected staff: ${selectedStaff.name}`
        })
      );
      noteList.appendChild(
        uiHelpers.createElement('li', {
          text: `Current check: ${selectedStaffStatus.warning}`
        })
      );
    } else {
      noteList.appendChild(
        uiHelpers.createElement('li', {
          text: 'Selected staff: none yet'
        })
      );
    }

    if (assignedStaff) {
      noteList.appendChild(
        uiHelpers.createElement('li', {
          text: `Assigned now: ${assignedStaff.name}`
        })
      );
    }
    panel.appendChild(noteList);

    return panel;
  };

  const renderStaffTable = (state, actions) => {
    const assignment = getSelectedAssignment(state);
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-11'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading('Available staff', 'Candidate list for the selected shift.')
    );

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    ['Name', 'Role', 'Availability', 'Warnings', 'Action'].forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    assignment.staff.forEach((staffMember) => {
      const staffStatus = getStaffStatus(assignment, staffMember);
      const row = uiHelpers.createElement('tr', {
        className: staffMember.id === state.selectedStaffId ? 'table-row-selected' : ''
      });
      row.appendChild(uiHelpers.createElement('td', { text: staffMember.name }));
      row.appendChild(uiHelpers.createElement('td', { text: staffMember.role }));

      const availabilityCell = uiHelpers.createElement('td');
      availabilityCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${staffStatus.blocked ? 'warning' : 'success'}`,
          text: staffStatus.availability
        })
      );
      row.appendChild(availabilityCell);
      row.appendChild(uiHelpers.createElement('td', { text: staffStatus.warning }));

      const actionCell = uiHelpers.createElement('td');
      const buttonLabel =
        assignment.assignedStaffId === staffMember.id ? 'Assigned' : 'Select';
      const selectButton = uiHelpers.createElement('button', {
        className: `action-button ${
          assignment.assignedStaffId === staffMember.id ? 'button-secondary' : 'button-ghost'
        } action-button--compact`,
        text: buttonLabel,
        attributes: {
          type: 'button',
          disabled: assignment.assignedStaffId === staffMember.id
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

  const renderConflictChecks = (state) => {
    const assignment = getSelectedAssignment(state);
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-16'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading('Conflict checks', 'Applied before an assignment is confirmed.')
    );
    const list = uiHelpers.createElement('ul', { className: 'detail-list' });
    [
      `Week start checked against ${assignment.weekStart}`,
      `Required role checked against ${assignment.requiredRole}`,
      'Approved leave conflict',
      'Overlapping shift conflict',
      'Availability conflict',
      'Contract-hours warning'
    ].forEach((item) => {
      list.appendChild(uiHelpers.createElement('li', { text: item }));
    });
    panel.appendChild(list);
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

      const assignment = getSelectedAssignment(state);
      const blockedCount = assignment.staff.filter((staffMember) => {
        return getStaffStatus(assignment, staffMember).blocked;
      }).length;

      workspaceElement.textContent = '';
      const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
      metrics.appendChild(uiHelpers.createMetric('Selected shift', assignment.shiftDate, 'accent'));
      metrics.appendChild(uiHelpers.createMetric('Candidates', String(assignment.staff.length)));
      metrics.appendChild(uiHelpers.createMetric('Blocked', String(blockedCount)));
      workspaceElement.appendChild(metrics);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }
      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(renderSelectedShift(state, actions));
      grid.appendChild(renderStaffTable(state, actions));
      grid.appendChild(renderConflictChecks(state));
      workspaceElement.appendChild(grid);
    };

    const reviewShift = () => {
      state.selectedShiftId = state.draftShiftId;
      state.selectedStaffId = null;
      const assignment = getSelectedAssignment(state);
      setFlash(state, 'success', `Now reviewing the ${assignment.shiftDate} shift.`);
      render();
    };

    const selectStaff = (staffId) => {
      state.selectedStaffId = staffId;
      const assignment = getSelectedAssignment(state);
      const selectedStaff = getSelectedStaff(assignment, state);
      const staffStatus = getStaffStatus(assignment, selectedStaff);

      if (staffStatus.blocked) {
        setFlash(state, 'warning', `${selectedStaff.name} has a conflict for this shift.`, [
          staffStatus.warning
        ]);
      } else {
        setFlash(state, 'info', `${selectedStaff.name} is selected for review.`);
      }

      render();
    };

    const assignStaff = () => {
      const assignment = getSelectedAssignment(state);
      const selectedStaff = getSelectedStaff(assignment, state);

      if (!selectedStaff) {
        setFlash(state, 'warning', 'Select a staff member first.');
        render();
        return;
      }

      const staffStatus = getStaffStatus(assignment, selectedStaff);
      if (staffStatus.blocked) {
        setFlash(state, 'error', `${selectedStaff.name} cannot be assigned to this shift.`, [
          staffStatus.warning
        ]);
        render();
        return;
      }

      assignment.assignedStaffId = selectedStaff.id;
      setFlash(state, 'success', `${selectedStaff.name} assigned to the ${assignment.shiftDate} shift.`);
      render();
    };

    const actions = {
      assignStaff,
      render,
      reviewShift,
      selectStaff
    };

    render();
  };

  return {
    mount
  };
})();
