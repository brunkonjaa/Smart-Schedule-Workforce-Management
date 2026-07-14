window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.sessionUi = (function createSessionUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const previewState = window.SmartSchedule.previewState;
  const uiHelpers = window.SmartSchedule.liveUiHelpers;

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
    heading.appendChild(createElement('h3', { text: 'Account access' }));
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

    const decoyUsernameInput = createElement('input', {
      className: 'login-decoy-input',
      attributes: {
        autocomplete: 'username',
        tabindex: -1,
        type: 'text'
      }
    });
    const decoyPasswordInput = createElement('input', {
      className: 'login-decoy-input',
      attributes: {
        autocomplete: 'current-password',
        tabindex: -1,
        type: 'password'
      }
    });
    form.append(decoyUsernameInput, decoyPasswordInput);

    const emailField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    emailField.appendChild(createElement('span', { text: 'Email address' }));
    const emailInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocapitalize: 'none',
        autocorrect: 'off',
        autocomplete: 'off',
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
        autocomplete: 'off',
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
    actionsRow.appendChild(
      createElement('button', {
        className: 'action-button button-ghost',
        text: 'Forgot password',
        attributes: {
          title: 'Password recovery will be added later.',
          type: 'button'
        }
      })
    );
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

        navigateToUserHome(result.user);
      } catch (error) {
        renderSignedOutState(workspaceElement, {
          text: error.message || 'Could not sign in with those credentials.',
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
        value: uiHelpers.formatRole(sessionUser.role),
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

    const grid = createElement('div', { className: 'workspace-grid' });

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
            text: error.message || 'Could not change the password right now.',
            tone: 'error'
          },
          renderToken
        );
      }
    });

    passwordPanel.appendChild(passwordForm);
    grid.appendChild(passwordPanel);
    workspaceElement.appendChild(grid);
  };

  const mount = async ({ page, workspaceElement, renderToken }) => {
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
