window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.leaveUi = (function createLeaveUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const buildState = () => {
    return {
      filters: {
        status: 'ALL'
      },
      flash: null,
      form: {
        endDate: uiHelpers.getDateOffset(2),
        managerComment: '',
        reason: '',
        startDate: uiHelpers.getDateOffset(1)
      },
      loading: true,
      records: [],
      selectedLeaveRequestId: null,
      sessionUser: null
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

  const fillManagerComment = (state, record) => {
    state.selectedLeaveRequestId = record.id;
    state.form.managerComment = record.managerComment || '';
  };

  const renderToolbar = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--toolbar content-panel--span-16'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Leave filters' }));
    toolbarRow.appendChild(toolbarTitle);

    const controls = uiHelpers.createElement('div', { className: 'toolbar-controls' });
    const statusLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    statusLabel.appendChild(uiHelpers.createElement('span', { text: 'Status' }));
    const statusSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['ALL', 'PENDING', 'APPROVED', 'REJECTED'].forEach((status) => {
      const option = uiHelpers.createElement('option', { text: status });
      option.value = status;
      option.selected = state.filters.status === status;
      statusSelect.appendChild(option);
    });
    statusLabel.appendChild(statusSelect);
    controls.appendChild(statusLabel);

    const reloadButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Load requests',
      attributes: { type: 'button' }
    });
    reloadButton.addEventListener('click', () => {
      state.filters.status = statusSelect.value;
      actions.loadLeaveRequests();
    });
    controls.appendChild(reloadButton);
    toolbarRow.appendChild(controls);
    panel.appendChild(toolbarRow);
    return panel;
  };

  const renderTable = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--table content-panel--span-10'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Leave requests',
        state.sessionUser.role === 'MANAGER'
          ? 'Managers can review and decide live leave requests here.'
          : 'Track the status of your own leave requests.'
      )
    );

    if (state.loading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading leave requests...' }));
      return panel;
    }

    if (state.records.length === 0) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'No leave requests match the current filters.' }));
      return panel;
    }

    const tableWrap = uiHelpers.createElement('div', { className: 'table-wrap' });
    const table = uiHelpers.createElement('table');
    const thead = uiHelpers.createElement('thead');
    const headRow = uiHelpers.createElement('tr');
      const columns = state.sessionUser.role === 'MANAGER'
      ? ['Staff', 'Dates', 'Reason', 'Status', 'Action']
      : ['Dates', 'Reason', 'Status', 'Action'];
    columns.forEach((title) => {
      headRow.appendChild(uiHelpers.createElement('th', { text: title }));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = uiHelpers.createElement('tbody');
    state.records.forEach((record) => {
      const row = uiHelpers.createElement('tr', {
        className: record.id === state.selectedLeaveRequestId ? 'table-row-selected' : ''
      });

      if (state.sessionUser.role === 'MANAGER') {
        row.appendChild(uiHelpers.createElement('td', { text: record.fullName || 'Unknown staff' }));
      }

      row.appendChild(
        uiHelpers.createElement('td', {
          text: `${record.startDate} to ${record.endDate}`
        })
      );
      row.appendChild(uiHelpers.createElement('td', { text: record.reason }));

      const statusCell = uiHelpers.createElement('td');
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${
            record.status === 'APPROVED' ? 'success' : record.status === 'REJECTED' ? 'muted' : 'warning'
          }`,
          text: record.status
        })
      );
      row.appendChild(statusCell);

      const actionCell = uiHelpers.createElement('td');

      if (state.sessionUser.role === 'MANAGER' && record.status === 'PENDING') {
        const reviewButton = uiHelpers.createElement('button', {
          className: 'action-button button-ghost action-button--compact',
          text: 'Review',
          attributes: { type: 'button' }
        });
        reviewButton.addEventListener('click', () => {
          fillManagerComment(state, record);
          setFlash(state, 'info', `Reviewing ${record.fullName} leave request.`);
          actions.render();
        });
        actionCell.appendChild(reviewButton);
      } else if (state.sessionUser.role === 'STAFF' && record.status === 'PENDING') {
        const withdrawButton = uiHelpers.createElement('button', {
          className: 'action-button button-secondary action-button--compact',
          text: 'Withdraw',
          attributes: { type: 'button' }
        });
        withdrawButton.addEventListener('click', async () => {
          state.selectedLeaveRequestId = record.id;
          await actions.withdrawLeaveRequest();
        });
        actionCell.appendChild(withdrawButton);
      } else {
        actionCell.textContent = record.managerComment || 'No comment';
      }

      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
    return panel;
  };

  const renderStaffForm = (state, actions) => {
    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'New leave request',
        'Leave requests are stored on the backend and start as PENDING.'
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

    const startInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'date', value: state.form.startDate }
    });
    appendField('Start date', startInput, 'form-field--span-6');

    const endInput = uiHelpers.createElement('input', {
      className: 'input-control',
      attributes: { type: 'date', value: state.form.endDate }
    });
    appendField('End date', endInput, 'form-field--span-6');

    const reasonInput = uiHelpers.createElement('textarea', {
      className: 'input-control',
      text: state.form.reason,
      attributes: { rows: 5 }
    });
    appendField('Reason', reasonInput);

    form.appendChild(grid);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const submitButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Submit request',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      state.form.startDate = startInput.value;
      state.form.endDate = endInput.value;
      state.form.reason = reasonInput.value.trim();
      await actions.submitLeaveRequest();
    });

    panel.appendChild(form);
    return panel;
  };

  const renderManagerPanel = (state, actions) => {
    const selectedRecord = state.records.find((record) => {
      return record.id === state.selectedLeaveRequestId;
    });

    if (!selectedRecord) {
      return uiHelpers.createEmptyPanel(
        'Select a pending request',
        'Choose a pending leave request from the table to approve or reject it.',
        'content-panel--span-6'
      );
    }

    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Leave decision',
        `Review ${selectedRecord.fullName} from ${selectedRecord.startDate} to ${selectedRecord.endDate}.`
      )
    );

    const detailList = uiHelpers.createElement('ul', { className: 'detail-list' });
    detailList.appendChild(uiHelpers.createElement('li', { text: `Reason: ${selectedRecord.reason}` }));
    detailList.appendChild(uiHelpers.createElement('li', { text: `Current status: ${selectedRecord.status}` }));
    panel.appendChild(detailList);

    const commentField = uiHelpers.createElement('label', { className: 'form-field' });
    commentField.appendChild(uiHelpers.createElement('span', { text: 'Manager comment' }));
    const commentInput = uiHelpers.createElement('textarea', {
      className: 'input-control',
      text: state.form.managerComment,
      attributes: { rows: 4 }
    });
    commentField.appendChild(commentInput);
    panel.appendChild(commentField);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    const approveButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Approve',
      attributes: { type: 'button', disabled: selectedRecord.status !== 'PENDING' }
    });
    approveButton.addEventListener('click', async () => {
      state.form.managerComment = commentInput.value.trim();
      await actions.decideLeaveRequest('approve');
    });
    actionsRow.appendChild(approveButton);

    const rejectButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Reject',
      attributes: { type: 'button', disabled: selectedRecord.status !== 'PENDING' }
    });
    rejectButton.addEventListener('click', async () => {
      state.form.managerComment = commentInput.value.trim();
      await actions.decideLeaveRequest('reject');
    });
    actionsRow.appendChild(rejectButton);
    panel.appendChild(actionsRow);

    return panel;
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'leave') {
      return;
    }

    const state = buildState();

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      workspaceElement.textContent = '';
      const metrics = uiHelpers.createElement('div', { className: 'metric-row' });
      metrics.appendChild(uiHelpers.createMetric('Role', state.sessionUser ? state.sessionUser.role : 'Loading', 'accent'));
      metrics.appendChild(uiHelpers.createMetric('Requests', state.loading ? 'Loading...' : String(state.records.length)));
      metrics.appendChild(uiHelpers.createMetric('Filter', state.filters.status));
      workspaceElement.appendChild(metrics);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }
      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(renderTable(state, actions));
      grid.appendChild(
        state.sessionUser.role === 'MANAGER' ? renderManagerPanel(state, actions) : renderStaffForm(state, actions)
      );
      workspaceElement.appendChild(grid);
    };

    const loadLeaveRequests = async (nextFlash = null) => {
      state.loading = true;
      state.flash = nextFlash || {
        details: [],
        text: 'Loading leave requests...',
        tone: 'info'
      };
      render();

      try {
        const queryString = uiHelpers.buildQueryString({
          status: state.filters.status
        });
        const result = await apiClient.get(`/api/v1/leave-requests?${queryString}`);

        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.records = result.leaveRequests;
        state.loading = false;
        state.flash = nextFlash;
        render();
      } catch (error) {
        if (!isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        state.loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load leave requests.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const submitLeaveRequest = async () => {
      try {
        await apiClient.post('/api/v1/leave-requests', {
          endDate: state.form.endDate,
          reason: state.form.reason,
          startDate: state.form.startDate
        });
        state.form.reason = '';
        await loadLeaveRequests({
          details: [],
          text: 'Leave request submitted successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not submit leave request.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const decideLeaveRequest = async (action) => {
      if (!state.selectedLeaveRequestId) {
        return;
      }

      try {
        await apiClient.put(
          `/api/v1/leave-requests/${state.selectedLeaveRequestId}/${action}`,
          state.form.managerComment ? { managerComment: state.form.managerComment } : {}
        );
        state.form.managerComment = '';
        await loadLeaveRequests({
          details: [],
          text: `Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not decide the leave request.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const withdrawLeaveRequest = async () => {
      if (!state.selectedLeaveRequestId) {
        return;
      }

      try {
        await apiClient.delete(`/api/v1/leave-requests/${state.selectedLeaveRequestId}`);
        state.selectedLeaveRequestId = null;
        await loadLeaveRequests({
          details: [],
          text: 'Leave request removed successfully.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not remove the leave request.');
        setFlash(state, 'error', feedback.text, feedback.details);
        render();
      }
    };

    const actions = {
      decideLeaveRequest,
      loadLeaveRequests,
      render,
      submitLeaveRequest,
      withdrawLeaveRequest
    };

    try {
      const result = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      state.sessionUser = result.user;
      render();
      await loadLeaveRequests();
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      uiHelpers.renderUnauthorized(
        workspaceElement,
        'Session required',
        'Sign in with a staff or manager account to use the live leave workflow.'
      );
    }
  };

  return {
    mount
  };
})();
