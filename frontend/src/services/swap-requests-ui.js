window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.swapRequestsUi = (function createSwapRequestsUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const isActiveRender = (workspaceElement, renderToken) => {
    return workspaceElement.dataset.renderToken === renderToken;
  };

  const statusLabel = (status) => ({
    ACCEPTED: 'Accepted by staff',
    PENDING: 'Waiting for staff'
  }[status] || uiHelpers.formatStatus(status));

  const formatShift = (request) => {
    const date = new Date(`${request.shiftDate}T00:00:00Z`);
    const day = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    return `${day} ${request.shiftDate} · ${request.shiftStartTime.slice(0, 5)}-${request.shiftEndTime.slice(0, 5)}`;
  };

  const createAction = (label, tone, onClick) => {
    const button = uiHelpers.createElement('button', {
      className: `action-button button-${tone}`,
      text: label,
      attributes: { type: 'button' }
    });
    button.addEventListener('click', onClick);
    return button;
  };

  const clearEligibilityWarning = () => {
    document.getElementById('swap-eligibility-warning')?.remove();
  };

  const showEligibilityWarning = (request, onConfirm) => {
    clearEligibilityWarning();
    const backdrop = uiHelpers.createElement('div', {
      className: 'swap-eligibility-backdrop',
      attributes: { id: 'swap-eligibility-warning' }
    });
    const dialog = uiHelpers.createElement('section', {
      className: 'swap-eligibility-dialog',
      attributes: {
        'aria-describedby': 'swap-eligibility-warning-copy',
        'aria-labelledby': 'swap-eligibility-warning-title',
        'aria-modal': 'true',
        role: 'dialog'
      }
    });
    dialog.appendChild(uiHelpers.createElement('h2', {
      text: 'This swap needs manager review',
      attributes: { id: 'swap-eligibility-warning-title' }
    }));
    dialog.appendChild(uiHelpers.createElement('p', {
      className: 'panel-copy',
      text: 'You are not currently eligible for this shift under the rota checks. You may still accept the swap request, but please inform the current manager on duty so they can confirm that the change is safe and acceptable.'
    }));
    dialog.appendChild(uiHelpers.createElement('p', {
      className: 'swap-eligibility-warning-detail',
      text: `${formatShift(request)} · ${request.targetName || 'Open to eligible colleagues'}`,
      attributes: { id: 'swap-eligibility-warning-copy' }
    }));
    const actions = uiHelpers.createElement('div', { className: 'actions-row' });
    const cancelButton = uiHelpers.createElement('button', {
      className: 'action-button button-ghost',
      text: 'Cancel',
      attributes: { type: 'button' }
    });
    cancelButton.addEventListener('click', clearEligibilityWarning);
    const confirmButton = uiHelpers.createElement('button', {
      className: 'action-button button-primary',
      text: 'Continue to manager review',
      attributes: { type: 'button' }
    });
    confirmButton.addEventListener('click', () => {
      clearEligibilityWarning();
      onConfirm();
    });
    actions.append(cancelButton, confirmButton);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  };

  const renderRequestCard = (request, sessionUser, actions) => {
    const card = uiHelpers.createElement('article', { className: 'swap-request-card' });
    const heading = uiHelpers.createElement('div', { className: 'swap-request-card-heading' });
    heading.appendChild(uiHelpers.createElement('div', {
      className: 'swap-request-card-title',
      text: formatShift(request)
    }));
    heading.appendChild(uiHelpers.createElement('span', {
      className: `status-tag status-tag--${request.status === 'ACCEPTED' ? 'success' : 'warning'}`,
      text: statusLabel(request.status)
    }));
    card.appendChild(heading);

    const details = uiHelpers.createElement('dl', { className: 'swap-request-details' });
    [['Requested by', request.requesterName], ['For', request.targetName || 'Anyone eligible'], ['Reason', request.reason || 'No reason added']]
      .forEach(([label, value]) => {
        details.appendChild(uiHelpers.createElement('dt', { text: label }));
        details.appendChild(uiHelpers.createElement('dd', { text: value }));
      });
    card.appendChild(details);

    const actionsRow = uiHelpers.createElement('div', { className: 'actions-row' });
    if (sessionUser.role === 'MANAGER') {
      if (request.status === 'ACCEPTED') {
        actionsRow.appendChild(createAction('Approve swap', 'primary', () => actions.decide(request, 'approve')));
      }
      actionsRow.appendChild(createAction('Reject', 'secondary', () => actions.decide(request, 'reject')));
    } else {
      const canAccept = request.status === 'PENDING' &&
        request.requesterStaffProfileId !== sessionUser.staffProfileId &&
        (!request.targetStaffProfileId || request.targetStaffProfileId === sessionUser.staffProfileId);
      if (canAccept) {
        actionsRow.appendChild(createAction('Accept swap', 'primary', () => actions.accept(request)));
      } else if (request.requesterStaffProfileId === sessionUser.staffProfileId) {
        actionsRow.appendChild(uiHelpers.createElement('span', {
          className: 'swap-request-note',
          text: 'This is your request.'
        }));
      }
    }
    if (actionsRow.childElementCount > 0) card.appendChild(actionsRow);
    return card;
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id !== 'swap-requests') return;

    let sessionUser;
    let requests = [];
    let flash = null;
    let loading = true;

    const render = () => {
      if (!isActiveRender(workspaceElement, renderToken)) return;
      workspaceElement.textContent = '';
      uiHelpers.renderIntroMetrics([
        { label: 'Visibility', value: 'Team wide', tone: 'accent' },
        { label: 'Requests', value: loading ? 'Loading...' : String(requests.length), tone: 'neutral' },
        { label: 'Role', value: sessionUser ? uiHelpers.formatRole(sessionUser.primaryRole || sessionUser.role) : 'Loading', tone: 'neutral' }
      ]);

      const grid = uiHelpers.createElement('div', { className: 'workspace-grid workspace-grid--swap-requests' });
      const flashPanel = uiHelpers.renderFlash(flash);
      if (flashPanel) grid.appendChild(flashPanel);
      grid.appendChild(uiHelpers.createStepsPanel(
        sessionUser?.role === 'MANAGER' ? 'How manager decisions work' : 'How swaps work',
        sessionUser?.role === 'MANAGER'
          ? 'A staff member must accept before the manager can approve the change.'
          : 'Everyone can see active requests, but only an eligible colleague can accept one.',
        sessionUser?.role === 'MANAGER'
          ? ['Check the shift and staff member.', 'Reject it if it cannot go ahead.', 'Approve it after a colleague accepts.']
          : ['Read the shift details.', 'Accept a request if you can work it.', 'The manager makes the final decision.'],
        'content-panel--span-5'
      ));

      const panel = uiHelpers.createElement('section', { className: 'content-panel content-panel--span-11 swap-requests-panel' });
      panel.appendChild(uiHelpers.createPanelHeading(
        'Active swap requests',
        sessionUser?.role === 'MANAGER' ? 'All future requests waiting for staff or manager action.' : 'All future requests from the team.'
      ));
      const list = uiHelpers.createElement('div', { className: 'swap-request-grid' });
      if (loading) {
        list.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'Loading swap requests...' }));
      } else if (requests.length === 0) {
        list.appendChild(uiHelpers.createElement('p', { className: 'panel-copy', text: 'No active swap requests.' }));
      } else {
        const actions = {
          accept: async (request, allowIneligible = false) => {
            try {
              await apiClient.post(`/api/v1/shift-swaps/${request.id}/accept`, { allowIneligible });
              await load('Swap accepted and sent to the manager.', 'success');
            } catch (error) {
              if (!allowIneligible && error.payload?.code === 'TARGET_INELIGIBLE') {
                showEligibilityWarning(request, () => actions.accept(request, true));
                return;
              }
              flash = { text: error.message || 'Could not accept this swap.', tone: 'error', details: [] };
              render();
            }
          },
          decide: async (request, decision) => {
            try {
              await apiClient.put(`/api/v1/shift-swaps/${request.id}/${decision}`, {});
              await load(`Swap ${decision === 'approve' ? 'approved' : 'rejected'}.`, 'success');
            } catch (error) {
              flash = { text: error.message || 'Could not update this swap.', tone: 'error', details: [] };
              render();
            }
          }
        };
        requests.forEach((request) => list.appendChild(renderRequestCard(request, sessionUser, actions)));
      }
      panel.appendChild(list);
      grid.appendChild(panel);
      workspaceElement.appendChild(grid);
    };

    const load = async (message = null, tone = 'info') => {
      loading = true;
      flash = message ? { text: message, tone, details: [] } : null;
      render();
      try {
        const result = await apiClient.get('/api/v1/shift-swaps');
        if (!isActiveRender(workspaceElement, renderToken)) return;
        requests = result.requests;
        loading = false;
        render();
      } catch (error) {
        loading = false;
        const feedback = uiHelpers.getErrorFeedback(error, 'Could not load swap requests.');
        flash = { text: feedback.text, tone: 'error', details: feedback.details };
        render();
      }
    };

    try {
      const sessionResult = await apiClient.get('/api/v1/auth/me');
      if (!isActiveRender(workspaceElement, renderToken)) return;
      sessionUser = sessionResult.user;
      await load();
    } catch (error) {
      uiHelpers.renderUnauthorized(workspaceElement, 'Sign in needed', 'Sign in to see the team swap requests.');
    }
  };

  return { mount };
})();
