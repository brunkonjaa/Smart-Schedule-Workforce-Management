window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.previewState = (function createPreviewState() {
  const storageKey = 'smart-schedule-shell-state';
  const fallbackState = {
    page: 'overview',
    role: 'manager',
    theme: 'light'
  };

  function readState() {
    try {
      const rawState = window.localStorage.getItem(storageKey);
      if (!rawState) {
        return { ...fallbackState };
      }

      return { ...fallbackState, ...JSON.parse(rawState) };
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
