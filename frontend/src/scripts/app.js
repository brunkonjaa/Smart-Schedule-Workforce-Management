(function bootstrapShell() {
  const shell = window.SmartSchedule || {};
  const allPages = shell.pageConfig.pages;
  const stateStore = shell.previewState;
  const layout = shell.layout;
  const overviewUi = shell.overviewUi;
  const auditLogsUi = shell.auditLogsUi;
  const sessionUi = shell.sessionUi;
  const staffManager = shell.staffManager;
  const leaveUi = shell.leaveUi;
  const swapRequestsUi = shell.swapRequestsUi;
  const shiftsUi = shell.shiftsUi;
  const assignmentsUi = shell.assignmentsUi;
  const rotaUi = shell.rotaUi;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  const navElement = document.querySelector('.top-nav');
  const themeToggleElement = document.getElementById('theme-toggle');
  const userGreetingElement = document.getElementById('user-greeting');
  const pageIntroElement = document.getElementById('page-intro');
  const workspaceElement = document.getElementById('workspace');
  const footerElement = document.querySelector('.app-footer');
  const backToTopElement = document.getElementById('back-to-top');
  const footerRevealDistance = 150;
  let lastPointerY = 0;
  let suppressNextHashChange = false;
  let renderQueue = Promise.resolve();

  function updateFooterReveal(pointerY = lastPointerY) {
    if (!footerElement) {
      return;
    }

    lastPointerY = pointerY;
    const revealStart = Math.max(0, window.innerHeight - footerRevealDistance);
    footerElement.classList.toggle('is-peeked', pointerY >= revealStart);
  }

  function updateBackToTop() {
    if (!backToTopElement) {
      return;
    }

    const shouldShow = window.scrollY > 280;
    backToTopElement.classList.toggle('is-visible', shouldShow);
  }

  window.addEventListener('mousemove', (event) => updateFooterReveal(event.clientY), { passive: true });
  window.addEventListener('resize', () => updateFooterReveal(), { passive: true });
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  backToTopElement?.addEventListener('click', () => {
    window.scrollTo({ behavior: 'smooth', top: 0 });
  });
  updateFooterReveal();
  updateBackToTop();

  function clearTransientOverlays() {
    document.getElementById('rota-modal-host')?.remove();
  }

  function pagesForRole(role) {
    if (role === 'guest') {
      return allPages.filter((page) => ['login', 'reset-password'].includes(page.id));
    }

    return allPages.filter((page) => page.audience === 'both' || page.audience === role);
  }

  function currentHash() {
    return window.location.hash.replace('#', '').split('?')[0];
  }

  function nextState(partialState) {
    const previousState = stateStore.get();
    return stateStore.set({ ...previousState, ...partialState });
  }

  function resolveState() {
    const previousState = stateStore.get();
    const hashPage = currentHash();
    const resolvedRole = ['login', 'reset-password'].includes(hashPage)
      ? 'guest'
      : previousState.role;
    const rolePages = pagesForRole(resolvedRole);
    const fallbackPage = rolePages[0] || allPages.find((page) => page.id === 'login');
    const allowedPageIds = rolePages.map((page) => page.id);
    const chosenPage = allowedPageIds.includes(hashPage)
      ? hashPage
      : allowedPageIds.includes(previousState.page)
        ? previousState.page
        : fallbackPage.id;

    const resolvedState = nextState({
      page: chosenPage,
      role: chosenPage === 'login' ? 'guest' : resolvedRole
    });
    if (chosenPage !== 'reset-password' && window.location.hash !== `#${chosenPage}`) {
      window.location.hash = chosenPage;
    }

    return resolvedState;
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    const label = theme === 'light' ? 'Dark mode' : 'Light mode';
    document.querySelector('.theme-toggle-label').textContent = label;
  }

  function renderNavigation(state) {
    navElement.innerHTML = pagesForRole(state.role)
      .map((page) => {
        if (page.id === 'login' && state.role !== 'guest') {
          return '<button class="nav-link nav-link--button" type="button" data-action="logout">Logout</button>';
        }

        const activeClass = page.id === state.page ? ' is-active' : '';
        return `<a class="nav-link${activeClass}" href="#${page.id}">${page.label}</a>`;
      })
      .join('');
  }

  async function renderUserGreeting(state) {
    if (!userGreetingElement || state.role === 'guest') {
      userGreetingElement?.setAttribute('hidden', '');
      return;
    }

    try {
      const result = await shell.apiClient.get('/api/v1/auth/me');
      const firstName = result.user.fullName?.trim().split(/\s+/)[0];

      if (!firstName) {
        userGreetingElement.setAttribute('hidden', '');
        return;
      }

      userGreetingElement.textContent = `Hello ${firstName}`;
      userGreetingElement.removeAttribute('hidden');
    } catch (error) {
      userGreetingElement.setAttribute('hidden', '');
    }
  }

  async function renderPage(state) {
    const page = allPages.find((entry) => entry.id === state.page);
    clearTransientOverlays();
    pageIntroElement.dataset.page = page.id;
    pageIntroElement.innerHTML = layout.renderPageIntro(page, state.role);
    workspaceElement.innerHTML =
      page.id === 'login' ? '' : layout.renderWorkspace(page);

    const renderToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    workspaceElement.dataset.renderToken = renderToken;

    if (staffManager) {
      await staffManager.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (overviewUi) {
      await overviewUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (auditLogsUi) {
      await auditLogsUi.mount({
        page,
        renderToken,
        workspaceElement
      });
    }

    if (leaveUi) {
      await leaveUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (swapRequestsUi) {
      await swapRequestsUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (shiftsUi) {
      await shiftsUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (assignmentsUi) {
      await assignmentsUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (rotaUi) {
      await rotaUi.mount({
        page,
        renderToken,
        role: state.role,
        workspaceElement
      });
    }

    if (sessionUi) {
      await sessionUi.mount({
        page,
        renderToken,
        workspaceElement
      });
    }
  }

  function animateStageOut() {
    if (prefersReducedMotion.matches || !pageIntroElement.innerHTML) {
      return Promise.resolve();
    }

    const options = {
      duration: 140,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    };

    return Promise.all([
      pageIntroElement.animate(
        [
          { opacity: 1 },
          { opacity: 0 }
        ],
        options
      ).finished,
      workspaceElement.animate(
        [
          { opacity: 1 },
          { opacity: 0 }
        ],
        options
      ).finished
    ]).catch(() => undefined);
  }

  function animateStageIn() {
    if (prefersReducedMotion.matches) {
      return Promise.resolve();
    }

    const options = {
      duration: 260,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'forwards'
    };

    return Promise.all([
      pageIntroElement.animate(
        [
          { opacity: 0 },
          { opacity: 1 }
        ],
        options
      ).finished,
      workspaceElement.animate(
        [
          { opacity: 0 },
          { opacity: 1 }
        ],
        options
      ).finished
    ]).catch(() => undefined);
  }

  async function render(shouldAnimate = false) {
    const state = resolveState();
    if (shouldAnimate) {
      await animateStageOut();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    applyTheme(state.theme);
    renderNavigation(state);
    await renderPage(state);
    await renderUserGreeting(state);

    if (shouldAnimate) {
      await animateStageIn();
    }
  }

  function queueRender(shouldAnimate = false) {
    renderQueue = renderQueue.then(() => {
      if (shouldAnimate && typeof document.startViewTransition === 'function') {
        try {
          const transition = document.startViewTransition(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            return render(false);
          });

          return transition.finished.catch(() => undefined);
        } catch (error) {
          return render(true);
        }
      }

      return render(shouldAnimate);
    });
    return renderQueue;
  }

  function navigateToPage(nextPage, shouldAnimate = true) {
    const currentState = stateStore.get();
    const allowedPageIds = pagesForRole(currentState.role).map((page) => page.id);

    if (!allowedPageIds.includes(nextPage) || nextPage === currentState.page) {
      return;
    }

    suppressNextHashChange = true;
    nextState({ page: nextPage });
    window.location.hash = nextPage;
    queueRender(shouldAnimate);
  }

  navElement.addEventListener('click', (event) => {
    const logoutButton = event.target.closest('button[data-action="logout"]');
    if (logoutButton) {
      event.preventDefault();
      logoutButton.disabled = true;
      logoutButton.textContent = 'Logging out...';

      window.SmartSchedule.apiClient
        .post('/api/v1/auth/logout', {})
        .then(() => {
          suppressNextHashChange = true;
          nextState({ page: 'login', role: 'guest' });
          window.location.hash = 'login';
          queueRender(true);
        })
        .catch(() => {
          logoutButton.disabled = false;
          logoutButton.textContent = 'Logout';
        });
      return;
    }

    const link = event.target.closest('a[href^="#"]');
    if (!link) {
      return;
    }

    event.preventDefault();

    const nextPage = link.getAttribute('href').replace('#', '');
    navigateToPage(nextPage);
  });

  workspaceElement.addEventListener('click', (event) => {
    const targetButton = event.target.closest('button[data-target-page]');

    if (!targetButton) {
      return;
    }

    const nextPage = targetButton.dataset.targetPage;
    if (!nextPage) {
      return;
    }

    navigateToPage(nextPage);
  });

  themeToggleElement.addEventListener('click', () => {
    const state = stateStore.get();
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    nextState({ theme: nextTheme });
    applyTheme(nextTheme);
  });

  window.addEventListener('hashchange', () => {
    if (suppressNextHashChange) {
      suppressNextHashChange = false;
      return;
    }

    queueRender(true);
  });

  queueRender(false).finally(() => {
    document.documentElement.classList.remove('app-loading');
    document.documentElement.classList.add('app-ready');
  });
})();
