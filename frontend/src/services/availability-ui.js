window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.availabilityUi = (function createAvailabilityUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const availabilityStatuses = ['AVAILABLE', 'UNAVAILABLE'];

  const buildState = () => {
    return {
      flash: null,
      form: {
        dayOfWeek: '1',
        endTime: '17:00',
        startTime: '09:00',
        status: 'AVAILABLE'
      },
      loading: true,
      records: [],
      selectedAvailabilityId: null,
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

  const getDayLabel = (dayOfWeek) => {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOfWeek - 1] || String(dayOfWeek);
  };

  const resetForm = (state) => {
    state.form = {
      dayOfWeek: '1',
      endTime: '17:00',
      startTime: '09:00',
      status: 'AVAILABLE'
    };
    state.selectedAvailabilityId = null;
  };

  const fillFormFromRecord = (state, record) => {
    state.form = {
      dayOfWeek: String(record.dayOfWeek),
      endTime: record.endTime.slice(0, 5),
      startTime: record.startTime.slice(0, 5),
      status: record.status
    };
    state.selectedAvailabilityId = record.id;
  };

  const renderTable = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Week entries',
        state.sessionUser.role === 'MANAGER'
          ? 'Managers review all entries for the selected week.'
          : 'Your saved availability windows for the selected week.'
      )
    );

    if (state.loading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading availability...' }));
      return panel;
    }

    if (state.records.length === 0) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'No availability entries found for this week.' }));
      return panel;
    }

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
    const columns = state.sessionUser.role === 'MANAGER'
      ? ['Staff', 'Day', 'Time window', 'Status']
      : ['Day', 'Time window', 'Status', 'Action'];
    columns.forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');

    state.records.forEach((record) => {
      const row = uiHelpers.createElement('tr', {
        className: record.id === state.selectedAvailabilityId ? 'table-row-selected' : ''
      });

      if (state.sessionUser.role === 'MANAGER') {
        row.appendChild(uiHelpers.createElement('td', { text: record.fullName || 'Unknown staff' }));
      }

      row.appendChild(uiHelpers.createElement('td', { text: getDayLabel(record.dayOfWeek) }));
      row.appendChild(
        uiHelpers.createElement('td', {
          text: `${record.startTime.slice(0, 5)} - ${record.endTime.slice(0, 5)}`
        })
      );

      const statusCell = uiHelpers.createElement('td');
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${record.status === 'AVAILABLE' ? 'success' : 'warning'}`,
          text: record.status === 'AVAILABLE' ? 'Available' : 'Unavailable'
        })
      );
      row.appendChild(statusCell);

      if (state.sessionUser.role === 'STAFF') {
        const actionCell = uiHelpers.createElement('td');
        const editButton = uiHelpers.createElement('button', {
          className: 'action-button button-ghost action-button--compact',
          text: 'Edit',
          attributes: { type: 'button' }
        });
        editButton.addEventListener('click', () => {
          fillFormFromRecord(state, record);
          setFlash(state, 'info', `Editing ${getDayLabel(record.dayOfWeek)} entry.`);
          actions.render();
        });
        actionCell.appendChild(editButton);
        row.appendChild(actionCell);
      }

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const renderToolbar = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Availability filters' }));
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

    const reloadButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Load week',
      attributes: { type: 'button' }
    });
    reloadButton.addEventListener('click', () => {
      state.weekStart = weekInput.value;
      actions.loadAvailability();
    });
    controls.appendChild(reloadButton);

    if (state.sessionUser.role === 'STAFF') {
      const resetButton = uiHelpers.createElement('button', {
        className: 'action-button button-ghost',
        text: 'New entry',
        attributes: { type: 'button' }
      });
      resetButton.addEventListener('click', () => {
        resetForm(state);
        setFlash(state, 'info', 'Add a new availability window for the selected week.');
        actions.render();
      });
      controls.appendChild(resetButton);
    }

    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderStaffForm = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        state.selectedAvailabilityId ? 'Edit availability entry' : 'New availability entry',
        'Only your own current or future week entries can be changed here.'
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

    const daySelect = uiHelpers.createElement('select', { className: 'input-control' });
    [
      ['1', 'Monday'],
      ['2', 'Tuesday'],
      ['3', 'Wednesday'],
      ['4', 'Thursday'],
      ['5', 'Friday'],
      ['6', 'Saturday'],
      ['7', 'Sunday']
    ].forEach(([value, label]) => {
      const option = uiHelpers.createElement('option', { text: label });
      option.value = value;
      option.selected = state.form.dayOfWeek === value;
      daySelect.appendChild(option);
    });
    appendField('Day', daySelect);

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

    const statusSelect = uiHelpers.createElement('select', { className: 'input-control' });
    availabilityStatuses.forEach((status) => {
      const option = uiHelpers.createElement('option', { text: status === 'AVAILABLE' ? 'Available' : 'Unavailable' });
      option.value = status;
      option.selected = state.form.status === status;
      statusSelect.appendChild(option);
    });
    appendField('Status', statusSelect);

    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: state.selectedAvailabilityId ? 'Save entry' : 'Add entry',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);

    if (state.selectedAvailabilityId) {
      const deleteButton = uiHelpers.createElement('button', {
        className: 'action-button button-secondary',
        text: 'Delete entry',
        attributes: { type: 'button' }
      });
      deleteButton.addEventListener('click', async () => {
        await actions.deleteAvailability();
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
        dayOfWeek: daySelect.value,
        endTime: endInput.value,
        startTime: startInput.value,
        status: statusSelect.value
      };
      await actions.saveAvailability();
    });

    panel.appendChild(form);
    return panel;
  };

  const renderManagerSummary = () => {
    return uiHelpers.createEmptyPanel(
      'Manager review only',
      'Managers can review the live availability data here. Staff accounts create and change their own entries from the same page in staff role view.',
      'content-panel--span-6'
    );
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'availability') {
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
      metrics.appendChild(uiHelpers.createMetric('Role', state.sessionUser ? state.sessionUser.role : 'Loading'));
      metrics.appendChild(
        uiHelpers.createMetric(
          'Entries',
          state.loading ? 'Loading...' : String(state.records.length)
        )
      );
      workspaceElement.appendChild(metrics);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(renderTable(state, actions));
      grid.appendChild(
        state.sessionUser.role === 'STAFF' ? renderStaffForm(state, actions) : renderManagerSummary()
      );
      workspaceElement.appendChild(grid);
    };

    const loadAvailability = async (nextFlash = null) => {
      state.loading = true;
      state.flash = nextFlash || {
        text: 'Loading availability entries...',
        tone: 'info',
        details: []
      };
      render();

      try {
        const queryString = uiHelpers.buildQueryString({
          weekStart: state.weekStart
        });
        const result = await apiClient.get(`/api/v1/availability?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.records = result.availability;
        state.loading = false;
        state.flash = nextFlash;
        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load availability.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const saveAvailability = async () => {
      try {
        if (state.selectedAvailabilityId) {
          await apiClient.put(`/api/v1/availability/${state.selectedAvailabilityId}`, {
            dayOfWeek: Number(state.form.dayOfWeek),
            endTime: state.form.endTime,
            startTime: state.form.startTime,
            status: state.form.status,
            weekStart: state.weekStart
          });
        } else {
          await apiClient.post('/api/v1/availability', {
            entries: [
              {
                dayOfWeek: Number(state.form.dayOfWeek),
                endTime: state.form.endTime,
                startTime: state.form.startTime,
                status: state.form.status
              }
            ],
            weekStart: state.weekStart
          });
        }

        resetForm(state);
        await loadAvailability({
          details: [],
          text: 'Availability saved successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not save availability.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const deleteAvailability = async () => {
      if (!state.selectedAvailabilityId) {
        return;
      }

      try {
        await apiClient.delete(`/api/v1/availability/${state.selectedAvailabilityId}`);
        resetForm(state);
        await loadAvailability({
          details: [],
          text: 'Availability entry deleted successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not delete availability.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const actions = {
      deleteAvailability,
      loadAvailability,
      render,
      saveAvailability
    };

    try {
      const result = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = result.user;
      render();
      await loadAvailability();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Session required',
        'Sign in with a staff or manager account to load live availability data.'
      );
    }
  };

  return {
    mount
  };
})();
