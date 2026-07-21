window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.adminUi = (function createAdminUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;
  const previewState = window.SmartSchedule.previewState;

  const formatDateTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Not recorded'
      : date.toLocaleString('en-GB', {
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour12: false
        });
  };

  const formatEventType = (value) => {
    return String(value || '')
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const createButton = (label, tone = 'ghost') => {
    return helpers.createElement('button', {
      className: `action-button button-${tone} admin-action-button`,
      text: label,
      attributes: { type: 'button' }
    });
  };

  const showReauthentication = () => {
    return new Promise((resolve, reject) => {
      const previousFocus = document.activeElement;
      const overlay = helpers.createElement('div', {
        className: 'admin-reauth-overlay'
      });
      const dialog = helpers.createElement('section', {
        className: 'admin-reauth-dialog',
        attributes: {
          'aria-labelledby': 'admin-reauth-title',
          'aria-modal': 'true',
          role: 'dialog'
        }
      });
      const title = helpers.createElement('h2', {
        text: 'Confirm administrator action',
        attributes: { id: 'admin-reauth-title' }
      });
      const copy = helpers.createElement('p', {
        className: 'panel-copy',
        text: 'Enter your administrator password. This confirmation is kept only in the server session for a short time.'
      });
      const feedback = helpers.createElement('p', {
        className: 'panel-copy admin-reauth-feedback',
        attributes: { 'aria-live': 'polite' }
      });
      const form = helpers.createElement('form', {
        className: 'form-shell',
        attributes: { autocomplete: 'off', novalidate: true }
      });
      const field = helpers.createElement('label', {
        className: 'form-field form-field--span-12'
      });
      field.appendChild(helpers.createElement('span', { text: 'Administrator password' }));
      const passwordInput = helpers.createElement('input', {
        className: 'input-control',
        attributes: {
          autocomplete: 'current-password',
          required: true,
          type: 'password'
        }
      });
      field.appendChild(passwordInput);
      form.appendChild(field);
      const actions = helpers.createElement('div', { className: 'actions-row' });
      const confirmButton = createButton('Confirm', 'primary');
      confirmButton.type = 'submit';
      const cancelButton = createButton('Cancel', 'ghost');
      actions.append(confirmButton, cancelButton);
      form.appendChild(actions);
      dialog.append(title, copy, feedback, form);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const close = (result, error = null) => {
        passwordInput.value = '';
        overlay.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
        if (error) reject(error);
        else resolve(result);
      };

      cancelButton.addEventListener('click', () => close(false));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(false);
      });
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
        }
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!passwordInput.value) {
          feedback.textContent = 'Enter your password first.';
          passwordInput.focus();
          return;
        }
        confirmButton.disabled = true;
        confirmButton.textContent = 'Checking...';
        try {
          await apiClient.post('/api/v1/admin/reauthenticate', {
            password: passwordInput.value
          });
          close(true);
        } catch (error) {
          passwordInput.value = '';
          feedback.textContent = error.message;
          confirmButton.disabled = false;
          confirmButton.textContent = 'Confirm';
          passwordInput.focus();
        }
      });
      passwordInput.focus();
    });
  };

  const renderAccountTable = (state, actions) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 admin-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Administrator accounts',
      'Manage administrator access, status and passkey setup.'
    ));
    const wrap = helpers.createElement('div', { className: 'table-wrap admin-table-wrap' });
    const table = helpers.createElement('table', { className: 'admin-table' });
    const head = helpers.createElement('thead');
    const headRow = helpers.createElement('tr');
    ['Account', 'Type', 'Status', 'Passkeys', 'Actions'].forEach((label) => {
      headRow.appendChild(helpers.createElement('th', { text: label }));
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = helpers.createElement('tbody');

    state.accounts.forEach((account) => {
      const row = helpers.createElement('tr');
      const accountCell = helpers.createElement('td', { attributes: { 'data-label': 'Account' } });
      accountCell.appendChild(helpers.createElement('strong', { text: account.displayName || 'Administrator' }));
      accountCell.appendChild(helpers.createElement('span', { className: 'admin-account-email', text: account.email }));
      row.appendChild(accountCell);
      row.appendChild(helpers.createTableCell(
        'Type',
        account.isSubmissionReviewer ? 'Temporary submission reviewer' : 'Administrator'
      ));
      const statusCell = helpers.createElement('td', { attributes: { 'data-label': 'Status' } });
      statusCell.appendChild(helpers.createElement('span', {
        className: `status-tag status-tag--${account.isActive ? 'success' : 'muted'}`,
        text: account.isActive ? 'Active' : 'Inactive'
      }));
      row.appendChild(statusCell);
      row.appendChild(helpers.createTableCell('Passkeys', String(account.passkeyCount)));
      const actionsCell = helpers.createElement('td', { attributes: { 'data-label': 'Actions' } });
      const actionGroup = helpers.createElement('div', { className: 'admin-table-actions' });
      const statusButton = createButton(account.isActive ? 'Disable' : 'Enable');
      statusButton.addEventListener('click', () => actions.setAccountStatus(account));
      const sessionsButton = createButton('Revoke sessions');
      sessionsButton.addEventListener('click', () => actions.revokeSessions(account));
      const passkeysButton = createButton(
        state.openPasskeyAccountId === account.id ? 'Hide passkeys' : 'View passkeys'
      );
      passkeysButton.addEventListener('click', () => actions.togglePasskeys(account));
      actionGroup.append(statusButton, sessionsButton, passkeysButton);
      actionsCell.appendChild(actionGroup);
      row.appendChild(actionsCell);
      body.appendChild(row);

      if (state.openPasskeyAccountId === account.id) {
        const passkeyRow = helpers.createElement('tr', { className: 'admin-passkey-row' });
        const passkeyCell = helpers.createElement('td', {
          attributes: { colspan: '5', 'data-label': 'Registered passkeys' }
        });
        const passkeyList = helpers.createElement('ul', { className: 'admin-passkey-list' });
        const passkeys = state.passkeysByAccount[account.id] || [];
        if (passkeys.length === 0) {
          passkeyList.appendChild(helpers.createElement('li', { text: 'No active passkeys are registered.' }));
        } else {
          passkeys.forEach((passkey) => {
            const item = helpers.createElement('li');
            const label = helpers.createElement('span', {
              text: `${passkey.deviceName} - added ${formatDateTime(passkey.createdAt)}`
            });
            const revokeButton = createButton('Revoke passkey');
            revokeButton.addEventListener('click', () => actions.revokePasskey(account, passkey));
            item.append(label, revokeButton);
            passkeyList.appendChild(item);
          });
        }
        passkeyCell.appendChild(passkeyList);
        passkeyRow.appendChild(passkeyCell);
        body.appendChild(passkeyRow);
      }
    });
    table.appendChild(body);
    wrap.appendChild(table);
    panel.appendChild(wrap);
    return panel;
  };

  const renderInvitationForm = (state, actions) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 admin-panel admin-add-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Add administrator',
      'Send a one-time invitation, or add a submission reviewer when that option is enabled.'
    ));
    const form = helpers.createElement('form', {
      className: 'form-shell admin-add-form',
      attributes: { autocomplete: 'off', novalidate: true }
    });
    const formGrid = helpers.createElement('div', { className: 'form-grid' });
    const fields = {};
    [
      ['displayName', 'Display name', 'text', 'name'],
      ['email', 'Email address', 'email', 'email']
    ].forEach(([name, labelText, type, autocomplete]) => {
      const field = helpers.createElement('label', { className: 'form-field form-field--span-6' });
      field.appendChild(helpers.createElement('span', { text: labelText }));
      const input = helpers.createElement('input', {
        className: 'input-control',
        attributes: { autocomplete, required: true, type }
      });
      field.appendChild(input);
      formGrid.appendChild(field);
      fields[name] = input;
    });

    let reviewerCheckbox = null;
    let reviewerPasswordField = null;
    let reviewerPassword = null;
    if (state.submissionReviewAccountsEnabled) {
      const reviewerField = helpers.createElement('label', {
        className: 'form-field form-field--span-12 admin-reviewer-option'
      });
      reviewerCheckbox = helpers.createElement('input', { attributes: { type: 'checkbox' } });
      reviewerField.append(reviewerCheckbox, helpers.createElement('span', {
        text: 'Submission reviewer (password change and passkey optional)'
      }));
      formGrid.appendChild(reviewerField);
      reviewerPasswordField = helpers.createElement('label', {
        className: 'form-field form-field--span-12 admin-reviewer-password'
      });
      reviewerPasswordField.hidden = true;
      reviewerPasswordField.appendChild(helpers.createElement('span', {
        text: 'Supplied review password'
      }));
      reviewerPassword = helpers.createElement('input', {
        className: 'input-control',
        attributes: { autocomplete: 'new-password', type: 'password' }
      });
      reviewerPasswordField.appendChild(reviewerPassword);
      formGrid.appendChild(reviewerPasswordField);
      reviewerCheckbox.addEventListener('change', () => {
        reviewerPasswordField.hidden = !reviewerCheckbox.checked;
        reviewerPassword.required = reviewerCheckbox.checked;
        if (!reviewerCheckbox.checked) reviewerPassword.value = '';
      });
    }
    form.appendChild(formGrid);
    const feedback = helpers.createElement('p', {
      className: 'panel-copy admin-form-feedback',
      attributes: { 'aria-live': 'polite' }
    });
    form.appendChild(feedback);
    const submit = createButton('Add administrator', 'primary');
    submit.type = 'submit';
    const actionsRow = helpers.createElement('div', { className: 'actions-row' });
    actionsRow.appendChild(submit);
    form.appendChild(actionsRow);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!fields.displayName.value.trim() || !fields.email.value.trim()) {
        feedback.textContent = 'Enter the administrator name and email.';
        return;
      }
      if (reviewerCheckbox?.checked && !reviewerPassword.value) {
        feedback.textContent = 'Enter the supplied review password.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Saving...';
      try {
        const confirmed = await showReauthentication();
        if (!confirmed) {
          submit.disabled = false;
          submit.textContent = 'Add administrator';
          return;
        }
        const payload = {
          displayName: fields.displayName.value.trim(),
          email: fields.email.value.trim()
        };
        if (reviewerCheckbox?.checked) payload.password = reviewerPassword.value;
        const path = reviewerCheckbox?.checked
          ? '/api/v1/admin/submission-reviewers'
          : '/api/v1/admin/invitations';
        const result = await apiClient.post(path, payload);
        if (reviewerPassword) reviewerPassword.value = '';
        await actions.reload({ text: result.message, tone: 'success' });
      } catch (error) {
        if (reviewerPassword) reviewerPassword.value = '';
        feedback.textContent = helpers.getErrorFeedback(
          error,
          'The administrator account was not added.'
        ).text;
        submit.disabled = false;
        submit.textContent = 'Add administrator';
      }
    });
    panel.appendChild(form);
    return panel;
  };

  const renderInvitations = (state, actions) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 admin-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Administrator invitations',
      'Pending, expired, cancelled and consumed invitations stay visible without exposing their one-time links.'
    ));
    const wrap = helpers.createElement('div', { className: 'table-wrap admin-table-wrap' });
    const table = helpers.createElement('table', { className: 'admin-table admin-invitation-table' });
    const head = helpers.createElement('thead');
    const headRow = helpers.createElement('tr');
    ['Invitee', 'Created', 'Expires', 'Status', 'Action'].forEach((label) => {
      headRow.appendChild(helpers.createElement('th', { text: label }));
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = helpers.createElement('tbody');
    state.invitations.forEach((invitation) => {
      const row = helpers.createElement('tr');
      const personCell = helpers.createElement('td', { attributes: { 'data-label': 'Invitee' } });
      personCell.append(
        helpers.createElement('strong', { text: invitation.displayName }),
        helpers.createElement('span', { className: 'admin-account-email', text: invitation.email })
      );
      row.appendChild(personCell);
      row.appendChild(helpers.createTableCell('Created', formatDateTime(invitation.createdAt)));
      row.appendChild(helpers.createTableCell('Expires', formatDateTime(invitation.expiresAt)));
      row.appendChild(helpers.createTableCell('Status', formatEventType(invitation.status)));
      const actionCell = helpers.createElement('td', { attributes: { 'data-label': 'Action' } });
      if (invitation.status === 'PENDING') {
        const cancel = createButton('Cancel invitation');
        cancel.addEventListener('click', () => actions.cancelInvitation(invitation));
        actionCell.appendChild(cancel);
      } else {
        actionCell.textContent = '-';
      }
      row.appendChild(actionCell);
      body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    panel.appendChild(wrap);
    return panel;
  };

  const renderEvents = (state) => {
    const panel = helpers.createElement('section', {
      className: 'content-panel content-panel--span-16 admin-panel'
    });
    panel.appendChild(helpers.createPanelHeading(
      'Recent security events',
      'Authentication and account-security events are separate from the Manager Audit Log.'
    ));
    const wrap = helpers.createElement('div', { className: 'table-wrap admin-table-wrap' });
    const table = helpers.createElement('table', { className: 'admin-table admin-event-table' });
    const head = helpers.createElement('thead');
    const headRow = helpers.createElement('tr');
    ['When', 'Action', 'Actor', 'Target', 'Result'].forEach((label) => {
      headRow.appendChild(helpers.createElement('th', { text: label }));
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = helpers.createElement('tbody');
    state.events.forEach((entry) => {
      const row = helpers.createElement('tr');
      row.appendChild(helpers.createTableCell('When', formatDateTime(entry.createdAt)));
      row.appendChild(helpers.createTableCell('Action', formatEventType(entry.eventType)));
      row.appendChild(helpers.createTableCell('Actor', entry.actorName || 'System'));
      row.appendChild(helpers.createTableCell('Target', entry.targetName || '-'));
      row.appendChild(helpers.createTableCell('Result', formatEventType(entry.outcome)));
      body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    panel.appendChild(wrap);
    return panel;
  };

  const mount = async ({ page, workspaceElement }) => {
    if (page.id !== 'admin') return;

    const state = {
      accounts: [],
      events: [],
      flash: null,
      invitations: [],
      openPasskeyAccountId: null,
      passkeysByAccount: {},
      submissionReviewAccountsEnabled: false
    };

    const render = () => {
      workspaceElement.textContent = '';
      helpers.renderIntroMetrics([
        { label: 'Administrators', value: String(state.accounts.length), tone: 'accent' },
        {
          label: 'Active',
          value: String(state.accounts.filter((account) => account.isActive).length),
          tone: 'neutral'
        },
        {
          label: 'Pending invitations',
          value: String(state.invitations.filter((invite) => invite.status === 'PENDING').length),
          tone: 'neutral'
        }
      ]);
      const grid = helpers.createElement('div', {
        className: 'workspace-grid workspace-grid--admin admin-workspace'
      });
      if (state.flash) {
        grid.appendChild(helpers.createElement('section', {
          className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${state.flash.tone}`
        }));
        grid.lastChild.appendChild(helpers.createElement('p', {
          className: 'panel-copy panel-copy--strong',
          text: state.flash.text,
          attributes: { role: 'status' }
        }));
      }
      grid.append(
        renderInvitationForm(state, actions),
        renderAccountTable(state, actions),
        renderInvitations(state, actions),
        renderEvents(state)
      );
      workspaceElement.appendChild(grid);
    };

    const load = async (flash = null) => {
      const [accountResult, eventResult] = await Promise.all([
        apiClient.get('/api/v1/admin/accounts'),
        apiClient.get('/api/v1/admin/security-events?page=1')
      ]);
      state.accounts = accountResult.accounts;
      state.invitations = accountResult.invitations;
      state.submissionReviewAccountsEnabled = accountResult.submissionReviewAccountsEnabled;
      state.events = eventResult.events;
      state.flash = flash;
      render();
    };

    const withRecentAuthentication = async (operation) => {
      const confirmed = await showReauthentication();
      if (!confirmed) return;
      await operation();
    };

    const handleActionFailure = async (error) => {
      if (error.status === 401) {
        previewState.set({
          ...previewState.get(),
          loginFlash: { text: 'Your administrator session has expired.', tone: 'error' },
          page: 'login',
          role: 'guest'
        });
        window.location.hash = 'login';
        return;
      }

      await load({ text: error.message, tone: 'error' });
    };

    const actions = {
      reload: (flash) => load(flash),
      setAccountStatus: (account) => withRecentAuthentication(async () => {
        const action = account.isActive ? 'disable' : 'enable';
        const result = await apiClient.post(`/api/v1/admin/accounts/${account.id}/${action}`, {});
        await load({ text: result.message, tone: 'success' });
      }).catch(handleActionFailure),
      revokeSessions: (account) => withRecentAuthentication(async () => {
        const result = await apiClient.post(`/api/v1/admin/accounts/${account.id}/revoke-sessions`, {});
        await load({ text: result.message, tone: 'success' });
      }).catch(handleActionFailure),
      cancelInvitation: (invitation) => withRecentAuthentication(async () => {
        const result = await apiClient.post(`/api/v1/admin/invitations/${invitation.id}/cancel`, {});
        await load({ text: result.message, tone: 'success' });
      }).catch(handleActionFailure),
      togglePasskeys: async (account) => {
        if (state.openPasskeyAccountId === account.id) {
          state.openPasskeyAccountId = null;
          render();
          return;
        }
        const result = await apiClient.get(`/api/v1/admin/accounts/${account.id}/passkeys`);
        state.passkeysByAccount[account.id] = result.passkeys;
        state.openPasskeyAccountId = account.id;
        render();
      },
      revokePasskey: (account, passkey) => withRecentAuthentication(async () => {
        const result = await apiClient.post(
          `/api/v1/admin/accounts/${account.id}/passkeys/${passkey.id}/revoke`,
          {}
        );
        state.openPasskeyAccountId = null;
        await load({ text: result.message, tone: 'success' });
      }).catch(handleActionFailure)
    };

    try {
      await load();
    } catch (error) {
      if (error.status === 401) {
        await handleActionFailure(error);
        return;
      }
      workspaceElement.textContent = '';
      const grid = helpers.createElement('div', {
        className: 'workspace-grid workspace-grid--admin admin-workspace'
      });
      const requiredPasskey = error.payload?.code === 'ADMIN_PASSKEY_REQUIRED';
      const panel = helpers.createEmptyPanel(
        requiredPasskey ? 'Passkey setup required' : 'Admin workspace could not load',
        requiredPasskey
          ? error.message
          : helpers.getErrorFeedback(error, 'Sign in again and retry.').text,
        'content-panel--span-16'
      );
      if (requiredPasskey) {
        const button = createButton('Open Password', 'primary');
        button.dataset.targetPage = 'login';
        panel.querySelector('.empty-state')?.appendChild(button);
      }
      grid.appendChild(panel);
      workspaceElement.appendChild(grid);
    }
  };

  return { mount };
})();
