window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.previewState = (function createPreviewState() {
  const storageKey = 'smart-schedule-shell-state';
  const allowedRoles = ['admin', 'guest', 'manager', 'staff'];
  const fallbackState = {
    page: 'login',
    role: 'guest',
    theme: 'light'
  };

  function normalizeRole(role) {
    return allowedRoles.includes(role) ? role : fallbackState.role;
  }

  function readState() {
    try {
      const rawState = window.localStorage.getItem(storageKey);
      if (!rawState) {
        return { ...fallbackState };
      }

      const parsedState = JSON.parse(rawState);

      return {
        ...fallbackState,
        ...parsedState,
        role: normalizeRole(parsedState?.role)
      };
    } catch (error) {
      return { ...fallbackState };
    }
  }

  function writeState(nextState) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  return {
    get() {
      return readState();
    },
    set(nextState) {
      writeState(nextState);
      return nextState;
    },
    fallbackState
  };
})();
