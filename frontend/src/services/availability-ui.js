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
      formStep: 1,
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
    state.formStep = 1;
    state.selectedAvailabilityId = null;
  };

  const fillFormFromRecord = (state, record) => {
    state.form = {
      dayOfWeek: String(record.dayOfWeek),
      endTime: record.endTime.slice(0, 5),
      startTime: record.startTime.slice(0, 5),
      status: record.status
    };
    state.formStep = 1;
    state.selectedAvailabilityId = record.id;
  };

  const renderTable = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10 availability-table-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        state.sessionUser.role === 'MANAGER' ? 'Team availability' : 'When can I work?',
        state.sessionUser.role === 'MANAGER'
          ? 'See who has added times for the selected week.'
          : 'These are the times you have saved for this week.'
      )
    );

    if (state.loading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading availability...' }));
      return panel;
    }

    if (state.records.length === 0) {
      return uiHelpers.createEmptyPanel(
        state.sessionUser.role === 'MANAGER'
          ? 'No availability added for this week'
          : 'You have not added availability yet',
        state.sessionUser.role === 'MANAGER'
          ? 'Staff availability will appear here after staff submit their times for the selected week.'
          : 'Add the first day and time you can work, or mark a day as unavailable.',
        'content-panel--span-10',
        state.sessionUser.role === 'STAFF'
          ? {
              label: 'Add availability',
              onClick: () => {
                resetForm(state);
                setFlash(state, 'info', 'Use the form to add your first availability entry.');
                actions.render();
              },
              tone: 'primary'
            }
          : null
      );
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
        row.appendChild(uiHelpers.createTableCell('Staff', record.fullName || 'Unknown staff'));
      }

      row.appendChild(uiHelpers.createTableCell('Day', getDayLabel(record.dayOfWeek)));
      row.appendChild(
        uiHelpers.createTableCell(
          'Time window',
          `${record.startTime.slice(0, 5)} - ${record.endTime.slice(0, 5)}`
        )
      );

      const statusCell = uiHelpers.createElement('td', {
        attributes: { 'data-label': 'Status' }
      });
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${record.status === 'AVAILABLE' ? 'success' : 'warning'}`,
          text: uiHelpers.formatStatus(record.status)
        })
      );
      row.appendChild(statusCell);

      if (state.sessionUser.role === 'STAFF') {
        const actionCell = uiHelpers.createElement('td', {
          attributes: { 'data-label': 'Action' }
        });
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
      className: 'content-panel content-panel--toolbar content-panel--span-16 availability-toolbar-panel'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Choose week' }));
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
      className: 'content-panel content-panel--span-6 availability-form-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        state.selectedAvailabilityId ? 'Edit when you can work' : 'Add when you can work',
        'Pick one day and time window. If you cannot work that day, choose unavailable.'
      )
    );

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });
    form.appendChild(uiHelpers.createWizardProgress(['Day', 'Time', 'Review'], state.formStep));

    const appendField = (label, inputElement, spanClass = 'form-field--span-12') => {
      const field = uiHelpers.createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      field.appendChild(inputElement);
      grid.appendChild(field);
    };

    let daySelect = null;
    let statusSelect = null;
    let startInput = null;
    let endInput = null;

    const syncVisibleFields = () => {
      if (daySelect) {
        state.form.dayOfWeek = daySelect.value;
      }

      if (statusSelect) {
        state.form.status = statusSelect.value;
      }

      if (startInput) {
        state.form.startTime = startInput.value;
      }

      if (endInput) {
        state.form.endTime = endInput.value;
      }
    };

    if (state.formStep === 1) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'First choose the day and whether you can work or not.'
        })
      );

      daySelect = uiHelpers.createElement('select', { className: 'input-control' });
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

      statusSelect = uiHelpers.createElement('select', { className: 'input-control' });
      availabilityStatuses.forEach((status) => {
        const option = uiHelpers.createElement('option', { text: uiHelpers.formatStatus(status) });
        option.value = status;
        option.selected = state.form.status === status;
        statusSelect.appendChild(option);
      });
      appendField('Status', statusSelect);
    }

    if (state.formStep === 2) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'Next add the time window for that day.'
        })
      );

      startInput = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: { type: 'time', value: state.form.startTime }
      });
      appendField('Start time', startInput, 'form-field--span-6');

      endInput = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: { type: 'time', value: state.form.endTime }
      });
      appendField('End time', endInput, 'form-field--span-6');
    }

    if (state.formStep === 3) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'Lastly check the entry before saving it.'
        })
      );
      grid.appendChild(
        uiHelpers.createElement('div', {
          className: 'form-field form-field--span-12'
        })
      ).appendChild(
        uiHelpers.createReviewList([
          { label: 'Week start', value: state.weekStart },
          { label: 'Day', value: getDayLabel(Number(state.form.dayOfWeek)) },
          { label: 'Status', value: uiHelpers.formatStatus(state.form.status) },
          { label: 'Time', value: `${state.form.startTime} - ${state.form.endTime}` }
        ])
      );
    }

    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });

    if (state.formStep > 1) {
      const backButton = uiHelpers.createElement('button', {
        className: 'action-button button-ghost',
        text: 'Back',
        attributes: { type: 'button' }
      });
      backButton.addEventListener('click', () => {
        syncVisibleFields();
        state.formStep -= 1;
        actions.render();
      });
      actionsRow.appendChild(backButton);
    }

    if (state.formStep < 3) {
      const nextButton = uiHelpers.createElement('button', {
        className: 'action-button button-primary',
        text: 'Next',
        attributes: { type: 'button' }
      });
      nextButton.addEventListener('click', () => {
        syncVisibleFields();
        state.formStep += 1;
        actions.render();
      });
      actionsRow.appendChild(nextButton);
    } else {
      const submitButton = uiHelpers.createElement('button', {
        className: 'action-button button-primary',
        text: state.selectedAvailabilityId ? 'Save entry' : 'Add entry',
        attributes: { type: 'submit' }
      });
      actionsRow.appendChild(submitButton);
    }

    if (state.selectedAvailabilityId) {
      const deleteButton = uiHelpers.createElement('button', {
        className: 'action-button button-secondary',
        text: 'Delete entry',
        attributes: { type: 'button' }
      });
      deleteButton.addEventListener('click', async () => {
        if (!uiHelpers.confirmAction('Delete this availability entry?')) {
          return;
        }

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
      syncVisibleFields();
      await actions.saveAvailability();
    });

    panel.appendChild(form);
    return panel;
  };

  const renderManagerSummary = () => {
    return uiHelpers.createEmptyPanel(
      'Manager view only',
      'Managers can check staff availability here. Staff add and change their own times from the staff role view.',
      'content-panel--span-6 availability-summary-panel',
      {
        label: 'Open staff role',
        onClick: () => {
          window.SmartSchedule.previewState.set({
            ...window.SmartSchedule.previewState.get(),
            page: 'availability',
            role: 'staff'
          });
          window.location.hash = 'availability';
          window.location.reload();
        },
        tone: 'secondary'
      }
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
      uiHelpers.renderIntroMetrics([
        { label: 'Week start', value: state.weekStart, tone: 'accent' },
        {
          label: 'Role',
          value: state.sessionUser ? uiHelpers.formatRole(state.sessionUser.role) : 'Loading',
          tone: 'neutral'
        },
        {
          label: 'Entries',
          value: state.loading ? 'Loading...' : String(state.records.length),
          tone: 'neutral'
        }
      ]);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--availability' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(
        uiHelpers.createStepsPanel(
          state.sessionUser.role === 'STAFF' ? 'How to add your week' : 'How to check coverage',
          state.sessionUser.role === 'STAFF'
            ? 'Use this page one day at a time.'
            : 'Use this page before building shifts.',
          state.sessionUser.role === 'STAFF'
            ? [
                'Choose the week you are updating.',
                'Add the day and time you can work, or mark it unavailable.',
                'Check the list to make sure the saved times look right.'
              ]
            : [
                'Choose the week you are planning.',
                'Check who has missing or unavailable time.',
                'Use this before creating shifts and assigning staff.'
              ],
          'availability-guide-panel'
        )
      );
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
          text: 'Availability saved.',
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
          text: 'Availability entry deleted.',
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
