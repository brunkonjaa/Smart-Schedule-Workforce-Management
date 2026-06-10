(function bootstrapShell() {
  const shell = window.SmartSchedule || {};
  const allPages = shell.pageConfig.pages;
  const stateStore = shell.previewState;
  const layout = shell.layout;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const navElement = document.querySelector('.top-nav');
  const roleSwitcherElement = document.getElementById('role-switcher');
  const themeToggleElement = document.getElementById('theme-toggle');
  const pageIntroElement = document.getElementById('page-intro');
  const workspaceElement = document.getElementById('workspace');
  let suppressNextHashChange = false;
  let renderQueue = Promise.resolve();

  function pagesForRole(role) {
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
    const rolePages = pagesForRole(previousState.role);
    const hashPage = currentHash();
    const allowedPageIds = rolePages.map((page) => page.id);
    const chosenPage = allowedPageIds.includes(hashPage)
      ? hashPage
      : allowedPageIds.includes(previousState.page)
        ? previousState.page
        : rolePages[0].id;

    const resolvedState = nextState({ page: chosenPage });
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

  function renderRoleSwitcher(state) {
    roleSwitcherElement.innerHTML = ['manager', 'staff']
      .map((role) => {
        const activeClass = role === state.role ? ' is-active' : '';
        const label = role === 'manager' ? 'Manager' : 'Staff';
        return `<button class="segment-button${activeClass}" data-role="${role}" type="button">${label}</button>`;
      })
      .join('');
  }

  function renderNavigation(state) {
    navElement.innerHTML = pagesForRole(state.role)
      .map((page) => {
        const activeClass = page.id === state.page ? ' is-active' : '';
        return `<a class="nav-link${activeClass}" href="#${page.id}">${page.label}</a>`;
      })
      .join('');
  }

  function renderPage(state) {
    const page = allPages.find((entry) => entry.id === state.page);
    pageIntroElement.innerHTML = layout.renderPageIntro(page, state.role);
    workspaceElement.innerHTML = layout.renderWorkspace(page);
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
    renderRoleSwitcher(state);
    renderNavigation(state);
    renderPage(state);

    if (shouldAnimate) {
      await animateStageIn();
    }
  }

  function queueRender(shouldAnimate = false) {
    renderQueue = renderQueue.then(() => render(shouldAnimate));
    return renderQueue;
  }

  navElement.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) {
      return;
    }

    event.preventDefault();

    const nextPage = link.getAttribute('href').replace('#', '');
    const currentState = stateStore.get();
    if (nextPage === currentState.page) {
      return;
    }

    suppressNextHashChange = true;
    nextState({ page: nextPage });
    window.location.hash = nextPage;
    queueRender(true);
  });

  roleSwitcherElement.addEventListener('click', (event) => {
    const nextRole = event.target.dataset.role;
    if (!nextRole) {
      return;
    }

    const state = nextState({ role: nextRole });
    const firstAllowedPage = pagesForRole(state.role)[0].id;
    nextState({ role: nextRole, page: firstAllowedPage });
    suppressNextHashChange = true;
    window.location.hash = firstAllowedPage;
    queueRender(true);
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
