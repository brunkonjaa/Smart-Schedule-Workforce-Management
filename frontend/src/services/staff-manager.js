window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.staffManager = (function createStaffManager() {
  const apiClient = window.SmartSchedule.apiClient;
  const staffRoles = ['FLOOR', 'BAR', 'KITCHEN'];
  const statusOptions = [
    { label: 'Active only', value: 'ACTIVE' },
    { label: 'All staff', value: 'ALL' },
    { label: 'Inactive only', value: 'INACTIVE' }
  ];

  const createElement = (tagName, { className, text, attributes } = {}) => {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (typeof text === 'string') {
      element.textContent = text;
    }

    if (attributes) {
      Object.entries(attributes).forEach(([name, value]) => {
        if (value === false || value === null || typeof value === 'undefined') {
          return;
        }

        if (value === true) {
          element.setAttribute(name, '');
          return;
        }

        element.setAttribute(name, String(value));
      });
    }

    return element;
  };

  const createMetric = (label, value, tone = 'neutral') => {
    const metric = createElement('article', {
      className: `metric-pill metric-pill--${tone}`
    });
    metric.appendChild(createElement('span', { text: label }));
    metric.appendChild(createElement('strong', { text: value }));
    return metric;
  };

  const normalizeRoleFilter = (value) => {
    const normalizedValue = String(value || 'ALL').trim().toUpperCase();
    return normalizedValue === 'ALL' ? 'ALL' : normalizedValue;
  };

  const createDefaultFormState = () => {
    return {
      contractHours: '',
      email: '',
      fullName: '',
      isActive: 'ACTIVE',
      password: '',
      phoneNumber: '',
      primaryRole: 'FLOOR'
    };
  };

  const buildState = () => {
    return {
      filters: {
        primaryRole: 'ALL',
        search: '',
        status: 'ACTIVE'
      },
      flash: null,
      form: createDefaultFormState(),
      isSubmitting: false,
      loading: true,
      records: [],
      selectedStaffId: null,
      sessionUser: null
    };
  };

  const setFlash = (state, tone, text, details = []) => {
    state.flash = {
      details,
      text,
      tone
    };
  };

  const isActiveRender = (workspaceElement, renderToken) => {
    return workspaceElement.dataset.renderToken === renderToken;
  };

  const resetFormForCreate = (state) => {
    state.form = createDefaultFormState();
    state.selectedStaffId = null;
  };

  const fillFormFromRecord = (state, record) => {
    state.form = {
      contractHours: String(record.contractHours),
      email: record.email,
      fullName: record.fullName,
      isActive: record.isActive ? 'ACTIVE' : 'INACTIVE',
      password: '',
      phoneNumber: record.phoneNumber || '',
      primaryRole: record.primaryRole
    };
    state.selectedStaffId = record.id;
  };

  const buildQueryString = (filters) => {
    const params = new window.URLSearchParams();

    if (filters.search) {
      params.set('search', filters.search);
    }

    if (filters.primaryRole !== 'ALL') {
      params.set('primaryRole', filters.primaryRole);
    }

    params.set('status', filters.status);

    return params.toString();
  };

  const renderFlash = (state) => {
    if (!state.flash) {
      return null;
    }

    const panel = createElement('section', {
      className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${state.flash.tone}`
    });
    panel.appendChild(createElement('p', { className: 'panel-copy panel-copy--strong', text: state.flash.text }));

    if (state.flash.details.length > 0) {
      const detailList = createElement('ul', { className: 'detail-list detail-list--dense' });
      state.flash.details.forEach((detail) => {
        detailList.appendChild(createElement('li', { text: detail }));
      });
      panel.appendChild(detailList);
    }

    return panel;
  };

  const renderToolbar = (state, actions) => {
    const panel = createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16'
    });
    const toolbarRow = createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(createElement('h3', { text: 'Staff filters' }));
    toolbarRow.appendChild(toolbarTitle);

    const controls = createElement('div', { className: 'toolbar-controls' });

    const searchLabel = createElement('label', { className: 'toolbar-control' });
    searchLabel.appendChild(createElement('span', { text: 'Search staff' }));
    const searchInput = createElement('input', {
      className: 'input-control',
      attributes: {
        placeholder: 'Search by name or email',
        type: 'search',
        value: state.filters.search
      }
    });
    searchLabel.appendChild(searchInput);
    controls.appendChild(searchLabel);

    const roleLabel = createElement('label', { className: 'toolbar-control' });
    roleLabel.appendChild(createElement('span', { text: 'Role' }));
    const roleSelect = createElement('select', { className: 'input-control' });
    ['ALL', ...staffRoles].forEach((role) => {
      const option = createElement('option', {
        text: role === 'ALL' ? 'All roles' : role
      });
      option.value = role;
      option.selected = state.filters.primaryRole === role;
      roleSelect.appendChild(option);
    });
    roleLabel.appendChild(roleSelect);
    controls.appendChild(roleLabel);

    const statusLabel = createElement('label', { className: 'toolbar-control' });
    statusLabel.appendChild(createElement('span', { text: 'Status' }));
    const statusSelect = createElement('select', { className: 'input-control' });
    statusOptions.forEach((optionConfig) => {
      const option = createElement('option', { text: optionConfig.label });
      option.value = optionConfig.value;
      option.selected = state.filters.status === optionConfig.value;
      statusSelect.appendChild(option);
    });
    statusLabel.appendChild(statusSelect);
    controls.appendChild(statusLabel);

    const applyWrapper = createElement('div', {
      className: 'toolbar-control toolbar-control--button'
    });
    const applyButton = createElement('button', {
      className: 'action-button button-secondary',
      text: 'Apply filters',
      attributes: { type: 'button' }
    });
    applyWrapper.appendChild(applyButton);
    controls.appendChild(applyWrapper);

    const resetWrapper = createElement('div', {
      className: 'toolbar-control toolbar-control--button'
    });
    const resetButton = createElement('button', {
      className: 'action-button button-ghost',
      text: 'Reset filters',
      attributes: { type: 'button' }
    });
    resetWrapper.appendChild(resetButton);
    controls.appendChild(resetWrapper);

    const addWrapper = createElement('div', {
      className: 'toolbar-control toolbar-control--button'
    });
    const addButton = createElement('button', {
      className: 'action-button button-primary',
      text: 'Add staff',
      attributes: { type: 'button' }
    });
    addWrapper.appendChild(addButton);
    controls.appendChild(addWrapper);

    applyButton.addEventListener('click', () => {
      state.filters.search = searchInput.value.trim();
      state.filters.primaryRole = normalizeRoleFilter(roleSelect.value);
      state.filters.status = statusSelect.value;
      actions.loadStaff();
    });

    resetButton.addEventListener('click', () => {
      state.filters = {
        primaryRole: 'ALL',
        search: '',
        status: 'ACTIVE'
      };
      actions.render();
      actions.loadStaff();
    });

    addButton.addEventListener('click', () => {
      resetFormForCreate(state);
      setFlash(state, 'info', 'Create a new staff account and linked profile.');
      actions.render();
    });

    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderTable = (state, actions) => {
    const panel = createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Team list' }));
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: 'Current staff accounts available for rota planning.'
      })
    );
    panel.appendChild(heading);

    if (state.loading) {
      panel.appendChild(
        createElement('p', {
          className: 'panel-copy',
          text: 'Loading staff records...'
        })
      );
      return panel;
    }

    if (state.records.length === 0) {
      panel.appendChild(
        createElement('p', {
          className: 'panel-copy',
          text: 'No staff records match the current filters.'
        })
      );
      return panel;
    }

    const tableWrap = createElement('div', { className: 'table-wrap' });
    const table = createElement('table');
    const thead = createElement('thead');
    const headRow = createElement('tr');
    ['Name', 'Email', 'Role', 'Contract hours', 'Status'].forEach((title) => {
      headRow.appendChild(createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = createElement('tbody');
    state.records.forEach((record) => {
      const row = createElement('tr', {
        className: record.id === state.selectedStaffId ? 'table-row-selected' : ''
      });

      if (record.id === state.selectedStaffId) {
        row.setAttribute('aria-current', 'true');
      }

      row.appendChild(createElement('td', { text: record.fullName }));
      row.appendChild(createElement('td', { text: record.email }));
      row.appendChild(createElement('td', { text: record.primaryRole }));
      row.appendChild(createElement('td', { text: `${record.contractHours} hrs` }));

      const statusCell = createElement('td');
      const statusTag = createElement('span', {
        className: `status-tag status-tag--${record.isActive ? 'success' : 'muted'}`,
        text: record.isActive ? 'Active' : 'Inactive'
      });
      statusCell.appendChild(statusTag);
      row.appendChild(statusCell);

      row.addEventListener('click', () => {
        fillFormFromRecord(state, record);
        setFlash(state, 'info', `Editing ${record.fullName}.`);
        actions.render();
      });

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const renderForm = (state, actions) => {
    const isEditing = Boolean(state.selectedStaffId);
    const panel = createElement('section', {
      className: 'content-panel content-panel--span-6'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(
      createElement('h3', {
        text: isEditing ? 'Edit staff record' : 'Create staff record'
      })
    );
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: isEditing
          ? 'Update staff details and account status securely.'
          : 'Create a new staff login and linked profile.'
      })
    );
    panel.appendChild(heading);

    const form = createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = createElement('div', { className: 'form-grid' });

    const appendField = ({ label, inputElement, spanClass = 'form-field--span-12', helpText }) => {
      const field = createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(createElement('span', { text: label }));
      field.appendChild(inputElement);

      if (helpText) {
        field.appendChild(
          createElement('small', { className: 'form-help', text: helpText })
        );
      }

      grid.appendChild(field);
    };

    const emailInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'email',
        type: 'email',
        value: state.form.email
      }
    });
    appendField({ label: 'Email address', inputElement: emailInput });

    if (!isEditing) {
      const passwordInput = createElement('input', {
        className: 'input-control',
        attributes: {
          autocomplete: 'new-password',
          minlength: '12',
          type: 'password',
          value: state.form.password
        }
      });
      appendField({
        label: 'Temporary password',
        inputElement: passwordInput,
        helpText: 'Use at least 12 characters for the initial password.'
      });
      form._passwordInput = passwordInput;
    }

    const fullNameInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'name',
        type: 'text',
        value: state.form.fullName
      }
    });
    appendField({ label: 'Full name', inputElement: fullNameInput });

    const roleSelect = createElement('select', { className: 'input-control' });
    staffRoles.forEach((role) => {
      const option = createElement('option', { text: role });
      option.value = role;
      option.selected = state.form.primaryRole === role;
      roleSelect.appendChild(option);
    });
    appendField({
      label: 'Primary role',
      inputElement: roleSelect,
      spanClass: 'form-field--span-6'
    });

    const contractHoursInput = createElement('input', {
      className: 'input-control',
      attributes: {
        max: '60',
        min: '0',
        step: '0.25',
        type: 'number',
        value: state.form.contractHours
      }
    });
    appendField({
      label: 'Contract hours',
      inputElement: contractHoursInput,
      spanClass: 'form-field--span-6'
    });

    const phoneInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'tel',
        type: 'tel',
        value: state.form.phoneNumber
      }
    });
    appendField({ label: 'Phone number', inputElement: phoneInput });

    const statusSelect = createElement('select', { className: 'input-control' });
    [
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Inactive', value: 'INACTIVE' }
    ].forEach((optionConfig) => {
      const option = createElement('option', { text: optionConfig.label });
      option.value = optionConfig.value;
      option.selected = state.form.isActive === optionConfig.value;
      statusSelect.appendChild(option);
    });
    appendField({ label: 'Status', inputElement: statusSelect });

    form.appendChild(grid);

    const actionsRow = createElement('div', { className: 'actions-row' });
    const submitButton = createElement('button', {
      className: 'action-button button-primary',
      text: state.isSubmitting
        ? 'Saving...'
        : isEditing
          ? 'Save changes'
          : 'Create staff',
      attributes: {
        disabled: state.isSubmitting,
        type: 'submit'
      }
    });
    actionsRow.appendChild(submitButton);

    if (isEditing) {
      const cancelButton = createElement('button', {
        className: 'action-button button-ghost',
        text: 'Create another',
        attributes: { type: 'button' }
      });
      cancelButton.addEventListener('click', () => {
        resetFormForCreate(state);
        setFlash(state, 'info', 'Create a new staff account and linked profile.');
        actions.render();
      });
      actionsRow.appendChild(cancelButton);
    }

    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      state.form = {
        contractHours: contractHoursInput.value.trim(),
        email: emailInput.value.trim(),
        fullName: fullNameInput.value.trim(),
        isActive: statusSelect.value,
        password: form._passwordInput ? form._passwordInput.value : '',
        phoneNumber: phoneInput.value.trim(),
        primaryRole: roleSelect.value
      };

      await actions.submitStaff();
    });

    panel.appendChild(form);
    return panel;
  };

  const renderUnauthorized = (workspaceElement, message) => {
    workspaceElement.textContent = '';
    const metrics = createElement('div', { className: 'metric-row' });
    metrics.appendChild(createMetric('Access', 'Restricted', 'accent'));
    metrics.appendChild(createMetric('Role', 'Manager only'));
    metrics.appendChild(createMetric('API', 'Session required'));
    workspaceElement.appendChild(metrics);

    const grid = createElement('div', { className: 'workspace-grid' });
    const panel = createElement('section', {
      className: 'content-panel content-panel--empty content-panel--span-16'
    });
    const emptyState = createElement('div', { className: 'empty-state' });
    emptyState.appendChild(createElement('h3', { text: 'Manager access required' }));
    emptyState.appendChild(
      createElement('p', {
        text: message
      })
    );
    panel.appendChild(emptyState);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, role, workspaceElement, renderToken }) => {
    if (page.id !== 'staff' || role !== 'manager') {
      return;
    }

    const state = buildState();

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      workspaceElement.textContent = '';

      const metrics = createElement('div', { className: 'metric-row' });
      const activeStaffCount = state.records.filter((record) => record.isActive).length;
      const inactiveStaffCount = state.records.filter((record) => !record.isActive).length;
      metrics.appendChild(createMetric('Owner', 'Manager', 'accent'));
      metrics.appendChild(
        createMetric(
          'Active staff',
          state.loading ? 'Loading...' : String(activeStaffCount)
        )
      );
      metrics.appendChild(
        createMetric(
          'Inactive staff',
          state.loading ? 'Loading...' : String(inactiveStaffCount)
        )
      );
      workspaceElement.appendChild(metrics);

      const grid = createElement('div', { className: 'workspace-grid' });

      const flashPanel = renderFlash(state);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }

      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(renderTable(state, actions));
      grid.appendChild(renderForm(state, actions));
      workspaceElement.appendChild(grid);
    };

    const loadStaff = async (nextFlash = null) => {
      state.loading = true;
      state.flash =
        nextFlash ||
        {
          text: 'Loading staff records...',
          tone: 'info',
          details: []
        };
      render();

      try {
        const queryString = buildQueryString(state.filters);
        const result = await apiClient.get(`/api/v1/staff?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.records = result.staff;
        state.loading = false;

        if (state.selectedStaffId) {
          const selectedRecord = state.records.find(
            (record) => record.id === state.selectedStaffId
          );

          if (selectedRecord) {
            fillFormFromRecord(state, selectedRecord);
          } else {
            resetFormForCreate(state);
          }
        }

        state.flash = nextFlash;
        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;

        if (error.status === 401) {
          renderUnauthorized(
            workspaceElement,
            'Sign in with a manager account to load live staff records.'
          );
          return;
        }

        if (error.status === 403) {
          renderUnauthorized(
            workspaceElement,
            'Your current account does not have manager access to staff records.'
          );
          return;
        }

        setFlash(
          state,
          'error',
          error.message || 'Could not load staff records right now.'
        );
        render();
      }
    };

    const submitStaff = async () => {
      state.isSubmitting = true;
      setFlash(
        state,
        'info',
        state.selectedStaffId ? 'Saving staff record...' : 'Creating staff record...'
      );
      render();

      const payload = {
        contractHours: state.form.contractHours,
        email: state.form.email,
        fullName: state.form.fullName,
        isActive: state.form.isActive === 'ACTIVE',
        phoneNumber: state.form.phoneNumber,
        primaryRole: state.form.primaryRole
      };

      if (!state.selectedStaffId) {
        payload.password = state.form.password;
      }

      try {
        const wasEditing = Boolean(state.selectedStaffId);
        const result = state.selectedStaffId
          ? await apiClient.put(`/api/v1/staff/${state.selectedStaffId}`, payload)
          : await apiClient.post('/api/v1/staff', payload);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.isSubmitting = false;
        fillFormFromRecord(state, result.staff);
        setFlash(
          state,
          'success',
          state.selectedStaffId === result.staff.id
            ? `Saved ${result.staff.fullName}.`
            : `Created ${result.staff.fullName}.`
        );
        const successMessage = wasEditing
          ? `Saved ${result.staff.fullName}.`
          : `Created ${result.staff.fullName}.`;

        await loadStaff({
          details: [],
          text: successMessage,
          tone: 'success'
        });
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.isSubmitting = false;
        setFlash(
          state,
          'error',
          error.message || 'Could not save the staff record.',
          error.payload?.details || []
        );
        render();
      }
    };

    const actions = {
      loadStaff,
      render,
      submitStaff
    };

    try {
      const meResult = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = meResult.user;

      if (state.sessionUser.role !== 'MANAGER') {
        renderUnauthorized(
          workspaceElement,
          'Only manager accounts can use the live staff management screen.'
        );
        return;
      }

      render();
      await loadStaff();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      renderUnauthorized(
        workspaceElement,
        error.status === 401
          ? 'Sign in with the seeded manager account to create, edit, and review staff records.'
          : 'The live staff screen could not verify the current session.'
      );
    }
  };

  return {
    mount
  };
})();
