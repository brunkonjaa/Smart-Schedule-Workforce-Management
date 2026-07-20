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
      formStep: 1,
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
      className: 'content-panel content-panel--toolbar content-panel--span-16 leave-toolbar-panel'
    });
    const toolbarRow = uiHelpers.createElement('div', { className: 'toolbar-row' });
    const toolbarTitle = uiHelpers.createElement('div', { className: 'toolbar-title' });
    toolbarTitle.appendChild(uiHelpers.createElement('h3', { text: 'Find time off' }));
    toolbarRow.appendChild(toolbarTitle);

    const controls = uiHelpers.createElement('div', { className: 'toolbar-controls' });
    const statusLabel = uiHelpers.createElement('label', { className: 'toolbar-control' });
    statusLabel.appendChild(uiHelpers.createElement('span', { text: 'Status' }));
    const statusSelect = uiHelpers.createElement('select', { className: 'input-control' });
    ['ALL', 'PENDING', 'APPROVED', 'REJECTED'].forEach((status) => {
      const option = uiHelpers.createElement('option', { text: uiHelpers.formatStatus(status) });
      option.value = status;
      option.selected = state.filters.status === status;
      statusSelect.appendChild(option);
    });
    statusLabel.appendChild(statusSelect);
    controls.appendChild(statusLabel);

    const reloadButton = uiHelpers.createElement('button', {
      className: 'action-button button-secondary',
      text: 'Load',
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
      className: 'content-panel content-panel--table content-panel--span-10 leave-table-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        state.sessionUser.role === 'MANAGER' ? 'Time off to review' : 'My time off',
        state.sessionUser.role === 'MANAGER'
          ? 'Approve or reject time off that is still waiting.'
          : 'Check what you asked for and whether the manager has decided.'
      )
    );

    if (state.loading) {
      panel.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading time off...' }));
      return panel;
    }

    if (state.records.length === 0) {
      const emptyPanel = uiHelpers.createEmptyPanel(
        state.sessionUser.role === 'MANAGER'
          ? 'No time off to show'
          : 'You have not asked for time off yet',
        state.sessionUser.role === 'MANAGER'
          ? 'Requests appear here when staff ask for time off. Change the status filter to check older decisions.'
          : 'Use the form to choose dates and send it to the manager.',
        'content-panel--span-10',
        state.sessionUser.role === 'STAFF'
          ? {
              label: 'Ask for time off',
              onClick: () => {
                state.formStep = 1;
                setFlash(state, 'info', 'Use the form to ask for time off.');
                actions.render();
              },
              tone: 'primary'
            }
          : null
      );
      emptyPanel.classList.add('leave-table-panel');
      return emptyPanel;
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
        row.appendChild(uiHelpers.createTableCell('Staff', record.fullName || 'Unknown staff'));
      }

      row.appendChild(
        uiHelpers.createTableCell('Dates', `${record.startDate} to ${record.endDate}`)
      );
      row.appendChild(uiHelpers.createTableCell('Reason', record.reason));

      const statusCell = uiHelpers.createElement('td', {
        attributes: { 'data-label': 'Status' }
      });
      statusCell.appendChild(
        uiHelpers.createElement('span', {
          className: `status-tag status-tag--${
            record.status === 'APPROVED' ? 'success' : record.status === 'REJECTED' ? 'muted' : 'warning'
          }`,
          text: uiHelpers.formatStatus(record.status)
        })
      );
      row.appendChild(statusCell);

      const actionCell = uiHelpers.createElement('td', {
        attributes: { 'data-label': 'Action' }
      });

      if (state.sessionUser.role === 'MANAGER' && record.status === 'PENDING') {
        const reviewButton = uiHelpers.createElement('button', {
          className: 'action-button button-ghost action-button--compact',
          text: 'Review',
          attributes: { type: 'button' }
        });
        reviewButton.addEventListener('click', () => {
          fillManagerComment(state, record);
          setFlash(state, 'info', `Reviewing ${record.fullName} time off.`);
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
          if (!uiHelpers.confirmAction('Withdraw this time off request?')) {
            return;
          }

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
      className: 'content-panel content-panel--span-6 leave-form-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Ask for time off',
        'Choose the dates and add a short reason for the manager.'
      )
    );

    const form = uiHelpers.createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const grid = uiHelpers.createElement('div', { className: 'form-grid' });
    form.appendChild(uiHelpers.createWizardProgress(['Dates', 'Reason', 'Review'], state.formStep));

    const appendField = (label, inputElement, spanClass = 'form-field--span-12') => {
      const field = uiHelpers.createElement('label', {
        className: `form-field ${spanClass}`
      });
      field.appendChild(uiHelpers.createElement('span', { text: label }));
      field.appendChild(inputElement);
      grid.appendChild(field);
    };

    let startInput = null;
    let endInput = null;
    let reasonInput = null;

    const syncVisibleFields = () => {
      if (startInput) {
        state.form.startDate = startInput.value;
      }

      if (endInput) {
        state.form.endDate = endInput.value;
      }

      if (reasonInput) {
        state.form.reason = reasonInput.value.trim();
      }
    };

    if (state.formStep === 1) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'First choose the first and last date you need off.'
        })
      );

      startInput = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: { type: 'date', value: state.form.startDate }
      });
      appendField('Start date', startInput, 'form-field--span-6');

      endInput = uiHelpers.createElement('input', {
        className: 'input-control',
        attributes: { type: 'date', value: state.form.endDate }
      });
      appendField('End date', endInput, 'form-field--span-6');
    }

    if (state.formStep === 2) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'Next add the reason the manager will see.'
        })
      );

      reasonInput = uiHelpers.createElement('textarea', {
        className: 'input-control',
        text: state.form.reason,
        attributes: { rows: 5 }
      });
      appendField('Reason', reasonInput);
    }

    if (state.formStep === 3) {
      form.appendChild(
        uiHelpers.createElement('p', {
          className: 'wizard-step-copy',
          text: 'Lastly check the dates before sending it.'
        })
      );
      grid.appendChild(
        uiHelpers.createElement('div', {
          className: 'form-field form-field--span-12'
        })
      ).appendChild(
        uiHelpers.createReviewList([
          { label: 'Start date', value: state.form.startDate },
          { label: 'End date', value: state.form.endDate },
          { label: 'Reason', value: state.form.reason }
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
        text: 'Send',
        attributes: { type: 'submit' }
      });
      actionsRow.appendChild(submitButton);
    }

    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      syncVisibleFields();
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
        'Select waiting time off',
        'Choose one waiting request, then approve or reject it.',
        'content-panel--span-6 leave-decision-panel',
        {
          label: 'Show waiting requests',
          onClick: () => {
            state.filters.status = 'PENDING';
            actions.loadLeaveRequests();
          },
          tone: 'secondary'
        }
      );
    }

    const panel = uiHelpers.createElement('section', {
      className: 'content-panel content-panel--span-6 leave-decision-panel'
    });
    panel.appendChild(
      uiHelpers.createPanelHeading(
        'Decide time off',
        `Review ${selectedRecord.fullName} from ${selectedRecord.startDate} to ${selectedRecord.endDate}.`
      )
    );

    const detailList = uiHelpers.createElement('ul', { className: 'detail-list' });
    detailList.appendChild(uiHelpers.createElement('li', { text: `Reason: ${selectedRecord.reason}` }));
    detailList.appendChild(uiHelpers.createElement('li', { text: `Current status: ${uiHelpers.formatStatus(selectedRecord.status)}` }));
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
      if (!uiHelpers.confirmAction(`Approve time off for ${selectedRecord.fullName}?`)) {
        return;
      }

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
      if (!uiHelpers.confirmAction(`Reject time off for ${selectedRecord.fullName}?`)) {
        return;
      }

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
      uiHelpers.renderIntroMetrics([
        {
          label: 'Role',
          value: state.sessionUser
            ? uiHelpers.formatRole(state.sessionUser.role === 'MANAGER' ? 'MANAGER' : state.sessionUser.primaryRole || state.sessionUser.role)
            : 'Loading',
          tone: 'accent'
        },
        {
          label: 'Requests',
          value: state.loading ? 'Loading...' : String(state.records.length),
          tone: 'neutral'
        },
        {
          label: 'Shown',
          value: uiHelpers.formatStatus(state.filters.status),
          tone: 'neutral'
        }
      ]);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--leave' });
      const flashPanel = uiHelpers.renderFlash(state.flash);
      if (flashPanel) {
        grid.appendChild(flashPanel);
      }
      grid.appendChild(renderToolbar(state, actions));
      grid.appendChild(
        uiHelpers.createStepsPanel(
          state.sessionUser.role === 'MANAGER' ? 'How to use Time Off' : 'How Time Off works',
          state.sessionUser.role === 'MANAGER'
            ? 'Keep the decision clear before shifts are final.'
            : 'The request stays visible while it waits for a manager.',
          state.sessionUser.role === 'MANAGER'
            ? [
                'Filter to waiting requests.',
                'Select one request and check the dates.',
                'Approve or reject it before building the rota.'
              ]
            : [
                'Choose the first and last date you need off.',
                'Add a short reason so the manager knows what it is for.',
                'Watch the status change from waiting to approved or rejected.'
              ],
          'leave-guide-panel'
        )
      );
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
        text: 'Loading time off...',
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
        const feedback = uiHelpers.getErrorFeedback(error, 'Time Off requests did not load. Refresh the page.');
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
        state.formStep = 1;
        await loadLeaveRequests({
          details: [],
          text: 'Time off request sent.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'Your Time Off request was not sent. Check the dates and try again.');
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
          text: `Time off ${action === 'approve' ? 'approved' : 'rejected'}.`,
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'The Time Off decision was not saved. Reload the request and try again.');
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
          text: 'Time off request withdrawn.',
          tone: 'success'
        });
      } catch (error) {
        const feedback = uiHelpers.getErrorFeedback(error, 'The Time Off request was not removed. Reload the list and try again.');
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
        'Sign in needed',
        'Sign in to ask for time off or review requests.'
      );
    }
  };

  return {
    mount
  };
})();
