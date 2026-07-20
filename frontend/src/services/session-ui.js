window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.sessionUi = (function createSessionUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const previewState = window.SmartSchedule.previewState;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

  const base64UrlToBytes = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = window.atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  };

  const bytesToBase64Url = (value) => {
    const bytes = new Uint8Array(value);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const prepareRegistrationOptions = (options) => ({
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    user: { ...options.user, id: base64UrlToBytes(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id)
    }))
  });

  const prepareAuthenticationOptions = (options) => ({
    ...options,
    challenge: base64UrlToBytes(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToBytes(credential.id)
    }))
  });

  const serializeRegistrationCredential = (credential) => ({
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      attestationObject: bytesToBase64Url(credential.response.attestationObject),
      clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON),
      transports: credential.response.getTransports ? credential.response.getTransports() : []
    },
    type: credential.type
  });

  const serializeAuthenticationCredential = (credential) => ({
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      authenticatorData: bytesToBase64Url(credential.response.authenticatorData),
      clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON),
      signature: bytesToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bytesToBase64Url(credential.response.userHandle)
        : null
    },
    type: credential.type
  });

  const getPasskeyLoginErrorMessage = (error) => {
    const errorName = error && error.name;

    if (errorName === 'NotAllowedError') {
      return 'Passkey sign-in was cancelled or took too long. Try again when you are ready.';
    }

    if (errorName === 'AbortError') {
      return 'Passkey sign-in was interrupted. Try again when you are ready.';
    }

    if (errorName === 'SecurityError') {
      return 'Smart Schedule could not start passkey sign-in securely. Reload the page and try again.';
    }

    if (errorName === 'NotSupportedError' || (error && error.message === 'This browser does not support passkeys.')) {
      return 'This browser cannot use passkeys. Open Smart Schedule in a current browser or use another registered device.';
    }

    if (['ConstraintError', 'InvalidStateError', 'UnknownError'].includes(errorName)) {
      return 'This device could not complete passkey sign-in. Try again or use another registered device.';
    }

    if (errorName && errorName !== 'Error') {
      return 'Smart Schedule could not complete passkey sign-in. Try again or use another registered device.';
    }

    return error && error.status
      ? error.message
      : 'Smart Schedule could not verify this passkey. Try again or use another registered device.';
  };

  const getPasskeyRegistrationErrorMessage = (error) => {
    const errorName = error && error.name;

    if (errorName === 'NotAllowedError') {
      return 'Passkey setup was cancelled or took too long. Select Add passkey when you are ready.';
    }

    if (errorName === 'AbortError') {
      return 'Passkey setup was interrupted. Select Add passkey to try again.';
    }

    if (errorName === 'SecurityError') {
      return 'Smart Schedule could not start passkey setup securely. Reload the page and try again.';
    }

    if (errorName === 'NotSupportedError' || (error && error.message === 'This browser does not support passkeys.')) {
      return 'This browser cannot create passkeys. Open Smart Schedule in a current browser or use another device.';
    }

    if (errorName && errorName !== 'Error') {
      return 'This device could not create the passkey. Try again or choose another device.';
    }

    return error && error.status
      ? error.message
      : 'Smart Schedule could not create the passkey. Try again or choose another device.';
  };

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

  const isActiveRender = (workspaceElement, renderToken) => {
    return workspaceElement.dataset.renderToken === renderToken;
  };

  const clearLoginInputs = (emailInput, passwordInput, rememberInput) => {
    const clearValues = () => {
      emailInput.value = '';
      passwordInput.value = '';
      rememberInput.checked = false;
    };

    clearValues();
    window.requestAnimationFrame(clearValues);
    window.setTimeout(clearValues, 120);
  };

  const resetGuestState = () => {
    previewState.set({
      ...previewState.get(),
      page: 'login',
      role: 'guest'
    });
  };

  const getResetToken = () => {
    const hashQuery = window.location.hash.split('?')[1] || '';
    return new URLSearchParams(hashQuery).get('token') || '';
  };

  const renderPasswordResetRequest = (workspaceElement, flashMessage = null) => {
    workspaceElement.textContent = '';
    const grid = createElement('div', { className: 'workspace-grid workspace-grid--login' });
    if (flashMessage) {
      const flashPanel = createElement('section', {
        className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${flashMessage.tone}`
      });
      flashPanel.appendChild(createElement('p', { className: 'panel-copy panel-copy--strong', text: flashMessage.text }));
      grid.appendChild(flashPanel);
    }
    const panel = createElement('section', { className: 'content-panel content-panel--form content-panel--span-8' });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Forgot password' }));
    heading.appendChild(createElement('p', { className: 'panel-copy', text: 'Enter your registered work email. If it belongs to an active account, Smart Schedule will send a reset link.' }));
    panel.appendChild(heading);
    const form = createElement('form', { className: 'form-shell', attributes: { autocomplete: 'off', novalidate: true } });
    const field = createElement('label', { className: 'form-field form-field--span-12' });
    field.appendChild(createElement('span', { text: 'Email address' }));
    const input = createElement('input', { className: 'input-control', attributes: { autocomplete: 'email', inputmode: 'email', type: 'email', required: true } });
    field.appendChild(input);
    form.appendChild(field);
    const actions = createElement('div', { className: 'actions-row' });
    const submit = createElement('button', { className: 'action-button button-primary', text: 'Email reset link', attributes: { type: 'submit' } });
    const back = createElement('button', { className: 'action-button button-ghost', text: 'Back to login', attributes: { type: 'button' } });
    back.addEventListener('click', () => { window.location.hash = 'login'; });
    actions.append(submit, back);
    form.appendChild(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Sending...';
      try {
        const result = await apiClient.post('/api/v1/auth/password-reset/request', { email: input.value.trim() });
        renderPasswordResetRequest(workspaceElement, { text: result.message, tone: 'success' });
      } catch (error) {
        renderPasswordResetRequest(workspaceElement, {
          text: error.status
            ? error.message
            : 'The reset email request did not reach Smart Schedule. Check the connection and try again.',
          tone: 'error'
        });
      }
    });
    panel.appendChild(form);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const renderPasswordResetConfirm = (workspaceElement, token, flashMessage = null) => {
    workspaceElement.textContent = '';
    const grid = createElement('div', { className: 'workspace-grid workspace-grid--login' });
    if (flashMessage) {
      const flashPanel = createElement('section', { className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${flashMessage.tone}` });
      flashPanel.appendChild(createElement('p', { className: 'panel-copy panel-copy--strong', text: flashMessage.text }));
      grid.appendChild(flashPanel);
    }
    const panel = createElement('section', { className: 'content-panel content-panel--form content-panel--span-8' });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Create a new password' }));
    heading.appendChild(createElement('p', { className: 'panel-copy', text: 'Choose a new password for your work account.' }));
    panel.appendChild(heading);
    const form = createElement('form', { className: 'form-shell', attributes: { autocomplete: 'off', novalidate: true } });
    const formGrid = createElement('div', { className: 'form-grid' });
    const passwordInput = createElement('input', { className: 'input-control', attributes: { autocomplete: 'new-password', type: 'password', required: true } });
    const confirmInput = createElement('input', { className: 'input-control', attributes: { autocomplete: 'new-password', type: 'password', required: true } });
    [['New password', passwordInput], ['Confirm new password', confirmInput]].forEach(([label, input]) => {
      const field = createElement('label', { className: 'form-field form-field--span-12' });
      field.append(createElement('span', { text: label }), input);
      formGrid.appendChild(field);
    });
    form.appendChild(formGrid);
    const submit = createElement('button', { className: 'action-button button-primary', text: 'Set new password', attributes: { type: 'submit' } });
    form.appendChild(createElement('div', { className: 'actions-row' }));
    form.lastChild.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (passwordInput.value !== confirmInput.value) {
        renderPasswordResetConfirm(workspaceElement, token, { text: 'The passwords do not match.', tone: 'error' });
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Saving...';
      try {
        const result = await apiClient.post('/api/v1/auth/password-reset/confirm', { newPassword: passwordInput.value, token });
        window.location.hash = 'login';
        window.setTimeout(() => renderSignedOutState(workspaceElement, { text: result.message, tone: 'success' }), 0);
      } catch (error) {
        renderPasswordResetConfirm(workspaceElement, token, {
          text: error.status
            ? error.message
            : 'The new password was not saved. Check the connection and try again.',
          tone: 'error'
        });
      }
    });
    panel.appendChild(form);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const navigateToUserHome = (user) => {
    const nextRole = user.role === 'MANAGER' ? 'manager' : 'staff';
    const nextPage = 'rota';

    previewState.set({
      ...previewState.get(),
      page: nextPage,
      role: nextRole
    });

    window.location.hash = nextPage;
  };

  const renderPasskeyLogin = (workspaceElement, renderToken, flashMessage = null) => {
    workspaceElement.textContent = '';
    const grid = createElement('div', { className: 'workspace-grid workspace-grid--login' });
    const panel = createElement('section', { className: 'content-panel content-panel--form content-panel--span-8' });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Confirm manager sign-in' }));
    heading.appendChild(createElement('p', { className: 'panel-copy', text: 'Use Windows Hello, your phone, fingerprint, or security key to confirm it is you.' }));
    panel.appendChild(heading);
    if (flashMessage) {
      panel.appendChild(createElement('p', {
        className: `panel-copy panel-copy--${flashMessage.tone}`,
        text: flashMessage.text,
        attributes: { role: 'alert' }
      }));
    }
    const actions = createElement('div', { className: 'actions-row' });
    const verifyButton = createElement('button', {
      className: 'action-button button-primary',
      text: flashMessage ? 'Try passkey again' : 'Use passkey',
      attributes: { type: 'button' }
    });
    actions.appendChild(verifyButton);
    panel.appendChild(actions);
    verifyButton.addEventListener('click', async () => {
      try {
        if (!window.PublicKeyCredential || !navigator.credentials) {
          throw new Error('This browser does not support passkeys.');
        }
        verifyButton.disabled = true;
        verifyButton.textContent = 'Waiting for passkey...';
        const optionResult = await apiClient.post('/api/v1/auth/passkeys/login/options', {});
        const credential = await navigator.credentials.get({
          publicKey: prepareAuthenticationOptions(optionResult.options)
        });
        const result = await apiClient.post('/api/v1/auth/passkeys/login/verify', serializeAuthenticationCredential(credential));
        navigateToUserHome(result.user);
      } catch (error) {
        renderPasskeyLogin(workspaceElement, renderToken, { text: getPasskeyLoginErrorMessage(error), tone: 'error' });
      }
    });
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const renderSignedOutState = (workspaceElement, flashMessage) => {
    workspaceElement.textContent = '';

    const grid = createElement('div', { className: 'workspace-grid workspace-grid--login' });

    if (flashMessage) {
      const flashPanel = createElement('section', {
        className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${flashMessage.tone}`
      });
      flashPanel.appendChild(
        createElement('p', {
          className: 'panel-copy panel-copy--strong',
          text: flashMessage.text
        })
      );
      grid.appendChild(flashPanel);
    }

    const formPanel = createElement('section', {
      className: 'content-panel content-panel--form content-panel--span-5 content-panel--login'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h2', { text: 'Account access' }));
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: 'Use the email and password given by the manager.'
      })
    );
    formPanel.appendChild(heading);

    const form = createElement('form', {
      className: 'form-shell',
      attributes: {
        autocomplete: 'off',
        novalidate: true
      }
    });
    const formGrid = createElement('div', { className: 'form-grid' });

    const emailField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    emailField.appendChild(createElement('span', { text: 'Email address' }));
    const emailInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocapitalize: 'none',
        autocorrect: 'off',
        autocomplete: 'username',
        inputmode: 'email',
        name: 'work-account',
        spellcheck: false,
        type: 'email'
      }
    });
    emailField.appendChild(emailInput);
    formGrid.appendChild(emailField);

    const passwordField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    passwordField.appendChild(createElement('span', { text: 'Password' }));
    const passwordInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'current-password',
        name: 'work-passcode',
        type: 'password'
      }
    });
    passwordField.appendChild(passwordInput);
    formGrid.appendChild(passwordField);

    const rememberField = createElement('label', {
      className: 'form-field form-field--span-12 session-checkbox'
    });
    const rememberInput = createElement('input', {
      attributes: {
        type: 'checkbox'
      }
    });
    rememberField.appendChild(rememberInput);
    rememberField.appendChild(createElement('span', { text: 'Remember me' }));
    formGrid.appendChild(rememberField);

    clearLoginInputs(emailInput, passwordInput, rememberInput);

    form.appendChild(formGrid);

    const actionsRow = createElement('div', { className: 'actions-row' });
    const submitButton = createElement('button', {
      className: 'action-button button-primary',
      text: 'Sign in',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    const forgotButton = createElement('button', {
        className: 'action-button button-ghost',
        text: 'Forgot password',
        attributes: {
          type: 'button'
        }
      });
    forgotButton.addEventListener('click', () => { window.location.hash = 'reset-password'; });
    actionsRow.appendChild(forgotButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';

        const result = await apiClient.post('/api/v1/auth/login', {
          email: emailInput.value.trim(),
          password: passwordInput.value,
          rememberMe: rememberInput.checked
        });

        if (result.mfaRequired) {
          renderPasskeyLogin(workspaceElement, null);
          return;
        }

        navigateToUserHome(result.user);
      } catch (error) {
        renderSignedOutState(workspaceElement, {
          text: error.status
            ? error.message
            : 'Sign-in did not reach Smart Schedule. Check the connection and try again.',
          tone: 'error'
        });
      }
    });

    formPanel.appendChild(form);
    grid.appendChild(formPanel);

    workspaceElement.appendChild(grid);
  };

  const renderSignedInState = (
    workspaceElement,
    sessionUser,
    flashMessage = null,
    renderToken = null
  ) => {
    workspaceElement.textContent = '';
    uiHelpers.renderIntroMetrics([
      {
        label: 'Signed in as',
        value: uiHelpers.formatRole(
          sessionUser.role === 'MANAGER'
            ? sessionUser.role
            : sessionUser.primaryRole || sessionUser.role
        ),
        tone: 'accent'
      },
      {
        label: 'Email',
        value: sessionUser.email,
        tone: 'neutral'
      },
      {
        label: 'Session',
        value: 'Active',
        tone: 'neutral'
      }
    ]);

    const grid = createElement('div', { className: 'workspace-grid workspace-grid--password' });

    if (flashMessage) {
      const flashPanel = createElement('section', {
        className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${flashMessage.tone}`
      });
      flashPanel.appendChild(
        createElement('p', {
          className: 'panel-copy panel-copy--strong',
          text: flashMessage.text
        })
      );
      grid.appendChild(flashPanel);
    }

    const panel = createElement('section', {
      className: 'content-panel content-panel--note content-panel--span-8'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Signed in' }));
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: 'Open the rota or sign out.'
      })
    );
    panel.appendChild(heading);

    const actionsRow = createElement('div', { className: 'actions-row' });
    const homeButton = createElement('button', {
      className: 'action-button button-primary',
      text: 'Open rota',
      attributes: { type: 'button' }
    });
    homeButton.addEventListener('click', () => {
      navigateToUserHome(sessionUser);
    });
    actionsRow.appendChild(homeButton);

    const logoutButton = createElement('button', {
      className: 'action-button button-ghost',
      text: 'Sign out',
      attributes: { type: 'button' }
    });
    logoutButton.addEventListener('click', async () => {
      try {
        logoutButton.disabled = true;
        logoutButton.textContent = 'Signing out...';
        await apiClient.post('/api/v1/auth/logout', {});
        resetGuestState();
        renderSignedOutState(workspaceElement, {
          text: 'Signed out.',
          tone: 'success'
        });
      } catch (error) {
        renderSignedInState(workspaceElement, sessionUser);
      }
    });
    actionsRow.appendChild(logoutButton);

    panel.appendChild(actionsRow);
    grid.appendChild(panel);

    const passwordPanel = createElement('section', {
      className: 'content-panel content-panel--form content-panel--span-8'
    });
    const passwordHeading = createElement('div', { className: 'panel-heading' });
    passwordHeading.appendChild(createElement('h3', { text: 'Password' }));
    passwordHeading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: sessionUser.mustChangePassword
          ? 'You are signed in with a temporary password. Change it before leaving this session.'
          : 'Change your password here when needed.'
      })
    );
    passwordPanel.appendChild(passwordHeading);

    const passwordForm = createElement('form', {
      className: 'form-shell',
      attributes: {
        autocomplete: 'off',
        novalidate: true
      }
    });
    const passwordGrid = createElement('div', { className: 'form-grid' });

    const currentPasswordField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    currentPasswordField.appendChild(
      createElement('span', { text: 'Current password' })
    );
    const currentPasswordInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'current-password',
        type: 'password'
      }
    });
    currentPasswordField.appendChild(currentPasswordInput);
    passwordGrid.appendChild(currentPasswordField);

    const newPasswordField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    newPasswordField.appendChild(createElement('span', { text: 'New password' }));
    const newPasswordInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'new-password',
        type: 'password'
      }
    });
    newPasswordField.appendChild(newPasswordInput);
    passwordGrid.appendChild(newPasswordField);

    passwordForm.appendChild(passwordGrid);

    const passwordActions = createElement('div', { className: 'actions-row' });
    const changePasswordButton = createElement('button', {
      className: 'action-button button-secondary',
      text: 'Change password',
      attributes: { type: 'submit' }
    });
    passwordActions.appendChild(changePasswordButton);
    passwordForm.appendChild(passwordActions);

    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        changePasswordButton.disabled = true;
        changePasswordButton.textContent = 'Saving...';

        const result = await apiClient.post('/api/v1/auth/change-password', {
          currentPassword: currentPasswordInput.value,
          newPassword: newPasswordInput.value
        });

        if (renderToken && !isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        renderSignedInState(
          workspaceElement,
          result.user,
          {
            text: result.message || 'Password changed successfully.',
            tone: 'success'
          },
          renderToken
        );
      } catch (error) {
        if (renderToken && !isActiveRender(workspaceElement, renderToken)) {
          return;
        }

        renderSignedInState(
          workspaceElement,
          sessionUser,
          {
            text: error.status
              ? error.message
              : 'The password was not changed. Check the connection and try again.',
            tone: 'error'
          },
          renderToken
        );
      }
    });

    passwordPanel.appendChild(passwordForm);
    grid.appendChild(passwordPanel);

    const resetPanel = createElement('section', {
      className: 'content-panel content-panel--note content-panel--span-8'
    });
    const resetHeading = createElement('div', { className: 'panel-heading' });
    resetHeading.appendChild(createElement('h3', { text: 'Reset Password' }));
    resetHeading.appendChild(createElement('p', {
      className: 'panel-copy',
      text: 'If you do not remember your current password, send a reset link to your work email.'
    }));
    resetPanel.appendChild(resetHeading);
    const resetButton = createElement('button', {
      className: 'action-button button-secondary',
      text: 'Email reset link',
      attributes: { type: 'button' }
    });
    resetButton.addEventListener('click', async () => {
      try {
        resetButton.disabled = true;
        resetButton.textContent = 'Sending...';
        const result = await apiClient.post('/api/v1/auth/password-reset/request', {
          email: sessionUser.email
        });
        renderSignedInState(workspaceElement, sessionUser, {
          text: result.message || 'If the account is active, a reset link has been sent.',
          tone: 'success'
        }, renderToken);
      } catch (error) {
        renderSignedInState(workspaceElement, sessionUser, {
          text: error.status
            ? error.message
            : 'The reset email request did not reach Smart Schedule. Check the connection and try again.',
          tone: 'error'
        }, renderToken);
      }
    });
    resetPanel.appendChild(resetButton);
    grid.appendChild(resetPanel);

    if (sessionUser.role === 'MANAGER') {
      const passkeyPanel = createElement('section', {
        className: 'content-panel content-panel--note content-panel--span-8'
      });
      const passkeyHeading = createElement('div', { className: 'panel-heading' });
      passkeyHeading.appendChild(createElement('h3', { text: 'Passkey protection' }));
      passkeyHeading.appendChild(createElement('p', { className: 'panel-copy', text: 'Add a passkey to protect future manager logins with your device PIN, biometrics, phone, or security key.' }));
      passkeyPanel.appendChild(passkeyHeading);
      const registerButton = createElement('button', { className: 'action-button button-secondary', text: 'Add passkey', attributes: { type: 'button' } });
      passkeyPanel.appendChild(registerButton);
      registerButton.addEventListener('click', async () => {
        try {
          if (!window.PublicKeyCredential || !navigator.credentials) {
            throw new Error('This browser does not support passkeys.');
          }
          registerButton.disabled = true;
          registerButton.textContent = 'Waiting for passkey...';
          const optionResult = await apiClient.post('/api/v1/auth/passkeys/registration/options', {});
          const credential = await navigator.credentials.create({
            publicKey: prepareRegistrationOptions(optionResult.options)
          });
          const result = await apiClient.post('/api/v1/auth/passkeys/registration/verify', serializeRegistrationCredential(credential));
          renderSignedInState(workspaceElement, sessionUser, { text: result.message, tone: 'success' }, renderToken);
        } catch (error) {
          renderSignedInState(workspaceElement, sessionUser, {
            text: getPasskeyRegistrationErrorMessage(error),
            tone: 'error'
          }, renderToken);
        }
      });
      grid.appendChild(passkeyPanel);
    }
    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
    if (page.id === 'reset-password') {
      const token = getResetToken();
      if (token) {
        renderPasswordResetConfirm(workspaceElement, token);
      } else {
        renderPasswordResetRequest(workspaceElement);
      }
      return;
    }

    if (page.id !== 'login') {
      return;
    }

    try {
      const result = await apiClient.get('/api/v1/auth/me');

      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      renderSignedInState(workspaceElement, result.user, null, renderToken);
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      resetGuestState();
      renderSignedOutState(workspaceElement, null);
    }
  };

  return {
    mount
  };
})();
