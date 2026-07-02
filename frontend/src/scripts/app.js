(function bootstrapShell() {
  const shell = window.SmartSchedule || {};
  const allPages = shell.pageConfig.pages;
  const stateStore = shell.previewState;
  const layout = shell.layout;
  const overviewUi = shell.overviewUi;
  const sessionUi = shell.sessionUi;
  const staffManager = shell.staffManager;
  const availabilityUi = shell.availabilityUi;
  const leaveUi = shell.leaveUi;
  const shiftsUi = shell.shiftsUi;
  const assignmentsUi = shell.assignmentsUi;
  const rotaUi = shell.rotaUi;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const navElement = document.querySelector('.top-nav');
  const themeToggleElement = document.getElementById('theme-toggle');
  const pageIntroElement = document.getElementById('page-intro');
  const workspaceElement = document.getElementById('workspace');
  let suppressNextHashChange = false;
  let renderQueue = Promise.resolve();

  function pagesForRole(role) {
    if (role === 'guest') {
      return allPages.filter((page) => page.id === 'login');
    }

    return allPages.filter((page) => page.audience === 'both' || page.audience === role);
  }

  function currentHash() {
    return window.location.hash.replace('#', '');
  }

  function nextState(partialState) {
    const previousState = stateStore.get();
    return stateStore.set({ ...previousState, ...partialState });
  }

  function resolveState() {
    const previousState = stateStore.get();
    const hashPage = currentHash();
    const resolvedRole = hashPage === 'login' ? 'guest' : previousState.role;
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
    if (window.location.hash !== `#${chosenPage}`) {
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
        const activeClass = page.id === state.page ? ' is-active' : '';
        return `<a class="nav-link${activeClass}" href="#${page.id}">${page.label}</a>`;
      })
      .join('');
  }

  async function renderPage(state) {
    const page = allPages.find((entry) => entry.id === state.page);
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

    if (availabilityUi) {
      await availabilityUi.mount({
        page,
        renderToken,
        role: state.role,
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
      duration: 180,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    };

    return Promise.all([
      pageIntroElement.animate(
        [
          { opacity: 1, transform: 'translateY(0px) scale(1)' },
          { opacity: 0, transform: 'translateY(10px) scale(0.995)' }
        ],
        options
      ).finished,
      workspaceElement.animate(
        [
          { opacity: 1, transform: 'translateY(0px)' },
          { opacity: 0, transform: 'translateY(12px)' }
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
      duration: 220,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'forwards'
    };

    return Promise.all([
      pageIntroElement.animate(
        [
          { opacity: 0, transform: 'translateY(10px) scale(0.995)' },
          { opacity: 1, transform: 'translateY(0px) scale(1)' }
        ],
        options
      ).finished,
      workspaceElement.animate(
        [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0px)' }
        ],
        options
      ).finished
    ]).catch(() => undefined);
  }

  async function render(shouldAnimate = false) {
    const state = resolveState();
    if (shouldAnimate) {
      await animateStageOut();
    }
    applyTheme(state.theme);
    renderNavigation(state);
    await renderPage(state);

    if (shouldAnimate) {
      await animateStageIn();
    }
  }

  function queueRender(shouldAnimate = false) {
    renderQueue = renderQueue.then(() => render(shouldAnimate));
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

  queueRender(false);
})();
