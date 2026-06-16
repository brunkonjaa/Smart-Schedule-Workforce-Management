window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.shiftsUi = (function createShiftsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const buildState = () => {
    return {
      filters: {
        requiredRole: 'ALL',
        status: 'ALL'
      },
      flash: null,
      form: {
        endTime: '22:00',
        notes: '',
        requiredRole: 'BAR',
        shiftDate: uiHelpers.getDateOffset(3),
        startTime: '14:00',
        status: 'OPEN'
      },
      loading: true,
      records: [],
      selectedShiftId: null,
      sessionUser: null,
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

  const resetForm = (state) => {
    state.form = {
      endTime: '22:00',
      notes: '',
      requiredRole: 'BAR',
      shiftDate: uiHelpers.getDateOffset(3),
      startTime: '14:00',
      status: 'OPEN'
    };
    state.selectedShiftId = null;
  };

  const fillFormFromRecord = (state, record) => {
    state.form = {
      endTime: record.endTime.slice(0, 5),
      notes: record.notes || '',
      requiredRole: record.requiredRole,
      shiftDate: record.shiftDate,
      startTime: record.startTime.slice(0, 5),
      status: record.status
    };
    state.selectedShiftId = record.id;
  };

  const renderToolbar = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Shift filters' }));
    toolbarRow.appendChild(toolbarTitle);

    const controls = uiHelpers.createElement('div', { className: 'toolbar-controls' });

    const weekLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    weekLabel.appendChild(uiHelpers.createElement('span', { text: 'Week start' }));
    const weekInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'date', value: state.weekStart }
    });
    weekLabel.appendChild(weekInput);
    controls.appendChild(weekLabel);

    const roleLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    roleLabel.appendChild(uiHelpers.createElement('span', { text: 'Role' }));
    const roleSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['ALL', 'FLOOR', 'BAR', 'KITCHEN'].forEach((role) => {
      const option = uiHelpers.createElement('option', { text: role });
      option.value = role;
      option.selected = state.filters.requiredRole === role;
      roleSelect.appendChild(option);
    });
    roleLabel.appendChild(roleSelect);
    controls.appendChild(roleLabel);

    const loadButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Load shifts',
      attributes: { type: 'button' }
    });
    loadButton.addEventListener('click', () => {
      state.weekStart = weekInput.value;
      state.filters.requiredRole = roleSelect.value;
      actions.loadShifts();
    });
    controls.appendChild(loadButton);

    const newButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'New shift',
      attributes: { type: 'button' }
    });
    newButton.addEventListener('click', () => {
      resetForm(state);
      actions.render();
    });
    controls.appendChild(newButton);

    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderTable = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10'
    });
    panel.appendChild(uiHelpers.createPanelHeading('Shift list', 'Managers create and update the live shift records for the selected week.'));

    if (state.loading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading shifts...' }));
      return panel;
    }

    if (state.records.length === 0) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'No shifts match the current week and filters.' }));
      return panel;
    }

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    ['Date', 'Time', 'Role', 'Status', 'Action'].forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    state.records.forEach((record) => {
      const row = uiHelpers.createElement('tr', {
        className: record.id === state.selectedShiftId ? 'table-row-selected' : ''
      });
      row.appendChild(uiHelpers.createElement('td', { text: record.shiftDate }));
      row.appendChild(uiHelpers.createElement('td', { text: `${record.startTime.slice(0, 5)} - ${record.endTime.slice(0, 5)}` }));
      row.appendChild(uiHelpers.createElement('td', { text: record.requiredRole }));
      const statusCell = uiHelpers.createElement('td');
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${
            record.status === 'OPEN' ? 'info' : record.status === 'DRAFT' ? 'muted' : 'warning'
          }`,
          text: record.status
        })
      );
      row.appendChild(statusCell);

      const actionCell = uiHelpers.createElement('td');
      const editButton = uiHelpers.createElement('button', {
        className: 'action-button button-ghost action-button--compact',
        text: 'Edit',
        attributes: { type: 'button' }
      });
      editButton.addEventListener('click', () => {
        fillFormFromRecord(state, record);
        setFlash(state, 'info', `Editing shift on ${record.shiftDate}.`);
        actions.render();
      });
      actionCell.appendChild(editButton);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const renderForm = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        state.selectedShiftId ? 'Edit shift' : 'Create shift',
        'Shift times, required role, and status are all stored in the backend now.'
      )
    );

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
      attributes: { type: 'date', value: state.form.shiftDate }
    });
    appendField('Shift date', dateInput);

    const startInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'time', value: state.form.startTime }
    });
    appendField('Start time', startInput, 'form-field--span-6');

    const endInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'time', value: state.form.endTime }
    });
    appendField('End time', endInput, 'form-field--span-6');

    const roleSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['FLOOR', 'BAR', 'KITCHEN'].forEach((role) => {
      const option = uiHelpers.createElement('option', { text: role });
      option.value = role;
      option.selected = state.form.requiredRole === role;
      roleSelect.appendChild(option);
    });
    appendField('Required role', roleSelect);

    const statusSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['OPEN', 'DRAFT', 'CANCELLED'].forEach((status) => {
      const option = uiHelpers.createElement('option', { text: status });
      option.value = status;
      option.selected = state.form.status === status;
      statusSelect.appendChild(option);
    });
    appendField('Status', statusSelect);

    const notesInput = uiHelpers.createElement('textarea', {
      className: 'input-control',
      text: state.form.notes,
      attributes: { rows: 4 }
    });
    appendField('Notes', notesInput);

    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: state.selectedShiftId ? 'Save shift' : 'Create shift',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);

    if (state.selectedShiftId) {
      const deleteButton = uiHelpers.createElement('button', {
        className: 'action-button button-secondary',
        text: 'Delete shift',
        attributes: { type: 'button' }
      });
      deleteButton.addEventListener('click', async () => {
        await actions.deleteShift();
      });
      actionsRow.appendChild(deleteButton);
    }

    const clearButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Clear',
      attributes: { type: 'button' }
    });
    clearButton.addEventListener('click', () => {
      resetForm(state);
      actions.render();
    });
    actionsRow.appendChild(clearButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      state.form = {
        endTime: endInput.value,
        notes: notesInput.value.trim(),
        requiredRole: roleSelect.value,
        shiftDate: dateInput.value,
        startTime: startInput.value,
        status: statusSelect.value
      };
      await actions.saveShift();
    });

    panel.appendChild(form);
    return panel;
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'shifts') {
      return;
    }

    const state = buildState();

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      workspaceElement.textContent = '';
      const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
      metrics.appendChild(uiHelpers.createMetric('Week start', state.weekStart, 'accent'));
      metrics.appendChild(uiHelpers.createMetric('Shifts', state.loading ? 'Loading...' : String(state.records.length)));
      metrics.appendChild(uiHelpers.createMetric('Filter', state.filters.requiredRole));
      workspaceElement.appendChild(metrics);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }
      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(renderTable(state, actions));
      grid.appendChild(renderForm(state, actions));
      workspaceElement.appendChild(grid);
    };

    const loadShifts = async (nextFlash = null) => {
      state.loading = true;
      state.flash = nextFlash || {
        details: [],
        text: 'Loading shifts...',
        tone: 'info'
      };
      render();

      try {
        const queryString = uiHelpers.buildQueryString({
          requiredRole: state.filters.requiredRole === 'ALL' ? '' : state.filters.requiredRole,
          weekStart: state.weekStart
        });
        const result = await apiClient.get(`/api/v1/shifts?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.records = result.shifts;
        state.loading = false;
        state.flash = nextFlash;
        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load shifts.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const saveShift = async () => {
      try {
        const payload = {
          endTime: state.form.endTime,
          notes: state.form.notes,
          requiredRole: state.form.requiredRole,
          shiftDate: state.form.shiftDate,
          startTime: state.form.startTime,
          status: state.form.status
        };

        if (state.selectedShiftId) {
          await apiClient.put(`/api/v1/shifts/${state.selectedShiftId}`, payload);
        } else {
          await apiClient.post('/api/v1/shifts', payload);
        }

        resetForm(state);
        await loadShifts({
          details: [],
          text: 'Shift saved successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not save shift.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const deleteShift = async () => {
      if (!state.selectedShiftId) {
        return;
      }

      try {
        await apiClient.delete(`/api/v1/shifts/${state.selectedShiftId}`);
        resetForm(state);
        await loadShifts({
          details: [],
          text: 'Shift deleted successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not delete shift.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const actions = {
      deleteShift,
      loadShifts,
      render,
      saveShift
    };

    try {
      const result = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = result.user;

      if (state.sessionUser.role !== 'MANAGER') {
        uiHelpers.renderUnauthorized(
          workspaceElement,
          'Manager access required',
          'Only manager accounts can use the live shift planning screen.'
        );
        return;
      }

      render();
      await loadShifts();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Session required',
        'Sign in with a manager account to use the live shift planning screen.'
      );
    }
  };

  return {
    mount
  };
})();
