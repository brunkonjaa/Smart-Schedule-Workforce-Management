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

  const navigateToUserHome = (user) => {
    const nextRole = user.role === 'MANAGER' ? 'manager' : 'staff';
    const nextPage = user.role === 'MANAGER' ? 'staff' : 'overview';

    previewState.set({
      ...previewState.get(),
      page: nextPage,
      role: nextRole
    });

    window.location.hash = nextPage;
  };

  const renderSignedOutState = (workspaceElement, flashMessage) => {
    workspaceElement.textContent = '';

    const metrics = createElement('div', { className: 'metric-row' });
    metrics.appendChild(
      createElement('article', {
        className: 'metric-pill metric-pill--accent'
      })
    ).append(
      createElement('span', { text: 'Access' }),
      createElement('strong', { text: 'Sign in' })
    );
    metrics.appendChild(
      createElement('article', { className: 'metric-pill' })
    ).append(
      createElement('span', { text: 'Session' }),
      createElement('strong', { text: 'Kept by server' })
    );
    metrics.appendChild(
      createElement('article', { className: 'metric-pill' })
    ).append(
      createElement('span', { text: 'Roles' }),
      createElement('strong', { text: 'Manager / Staff' })
    );
    workspaceElement.appendChild(metrics);

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

    const formPanel = createElement('section', {
      className: 'content-panel content-panel--span-10'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Account access' }));
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: 'Sign in with a work account before using staff, leave, availability, and shifts.'
      })
    );
    formPanel.appendChild(heading);

    const form = createElement('form', {
      className: 'form-shell',
      attributes: { novalidate: true }
    });
    const formGrid = createElement('div', { className: 'form-grid' });

    const emailField = createElement('label', {
      className: 'form-field form-field--span-12'
    });
    emailField.appendChild(createElement('span', { text: 'Email address' }));
    const emailInput = createElement('input', {
      className: 'input-control',
      attributes: {
        autocomplete: 'email',
        type: 'email',
        value: 'manager@example.com'
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
        type: 'password'
      }
    });
    passwordField.appendChild(passwordInput);
    formGrid.appendChild(passwordField);

    form.appendChild(formGrid);

    const actionsRow = createElement('div', { className: 'actions-row' });
    const submitButton = createElement('button', {
      className: 'action-button button-primary',
      text: 'Sign in',
      attributes: { type: 'submit' }
    });
    actionsRow.appendChild(submitButton);
    form.appendChild(actionsRow);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Signing in...';

        const result = await apiClient.post('/api/v1/auth/login', {
          email: emailInput.value.trim(),
          password: passwordInput.value
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

    const helpPanel = uiHelpers.createStepsPanel(
      'Before you start',
      'The account decides what you can see after login.',
      [
        'Managers can update staff records and create shifts.',
        'Staff can update availability and ask for leave.',
        'The server checks access again when a live page loads.'
      ],
      'content-panel--span-6'
    );
    grid.appendChild(helpPanel);

    workspaceElement.appendChild(grid);
  };

  const renderSignedInState = (workspaceElement, sessionUser) => {
    workspaceElement.textContent = '';

    const metrics = createElement('div', { className: 'metric-row' });
    metrics.appendChild(
      createElement('article', {
        className: 'metric-pill metric-pill--accent'
      })
    ).append(
      createElement('span', { text: 'Signed in as' }),
      createElement('strong', { text: uiHelpers.formatRole(sessionUser.role) })
    );
    metrics.appendChild(
      createElement('article', { className: 'metric-pill' })
    ).append(
      createElement('span', { text: 'Email' }),
      createElement('strong', { text: sessionUser.email })
    );
    metrics.appendChild(
      createElement('article', { className: 'metric-pill' })
    ).append(
      createElement('span', { text: 'Session' }),
      createElement('strong', { text: 'Active' })
    );
    workspaceElement.appendChild(metrics);

    const grid = createElement('div', { className: 'workspace-grid' });

    const panel = createElement('section', {
      className: 'content-panel content-panel--span-16'
    });
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: 'Signed in' }));
    heading.appendChild(
      createElement('p', {
        className: 'panel-copy',
        text: 'Use the buttons below to continue into the live workspace or end the current session.'
      })
    );
    panel.appendChild(heading);

    const actionsRow = createElement('div', { className: 'actions-row' });
    const homeButton = createElement('button', {
      className: 'action-button button-primary',
      text: sessionUser.role === 'MANAGER' ? 'Open staff records' : 'Open my week',
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

      renderSignedInState(workspaceElement, result.user);
    } catch (error) {
      if (!isActiveRender(workspaceElement, renderToken)) {
        return;
      }

      renderSignedOutState(workspaceElement, null);
    }
  };

  return {
    mount
  };
})();
