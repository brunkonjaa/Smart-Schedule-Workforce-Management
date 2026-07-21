window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.submissionReviewUi = (function createSubmissionReviewUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const helpers = window.SmartSchedule.liveUiHelpers;
  const dismissalPrefix = 'smart-schedule-review-banner-dismissed:';

  const focusPasswordControl = (controlId) => {
    window.location.hash = 'login';
    window.setTimeout(() => {
      const control = document.getElementById(controlId);
      control?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      control?.focus();
    }, 250);
  };

  const mount = async ({ page, workspaceElement }) => {
    if (!['admin', 'login'].includes(page.id)) return;

    let result;
    try {
      result = await apiClient.get('/api/v1/auth/me');
    } catch (error) {
      return;
    }

    const user = result.user;
    if (!user.isSubmissionReviewer) return;

    const dismissalKey = `${dismissalPrefix}${user.id}`;
    if (window.sessionStorage.getItem(dismissalKey) === 'true') return;

    const banner = helpers.createElement('section', {
      className: 'submission-review-banner',
      attributes: {
        'aria-labelledby': 'submission-review-title',
        role: 'region'
      }
    });
    const copy = helpers.createElement('div', { className: 'submission-review-copy' });
    copy.appendChild(helpers.createElement('strong', {
      text: 'Temporary assessment account',
      attributes: { id: 'submission-review-title' }
    }));
    copy.appendChild(helpers.createElement('p', {
      text: 'This account is ready for reviewing Smart Schedule. Changing the password or adding a passkey is optional for this account only. This exception is not intended for a real workplace.'
    }));
    const actions = helpers.createElement('div', { className: 'submission-review-actions' });
    const changePassword = helpers.createElement('button', {
      className: 'submission-review-link',
      text: 'Change password',
      attributes: { type: 'button' }
    });
    changePassword.addEventListener('click', () => focusPasswordControl('current-password'));
    const registerPasskey = helpers.createElement('button', {
      className: 'submission-review-link',
      text: 'Register passkey',
      attributes: { type: 'button' }
    });
    registerPasskey.addEventListener('click', () => focusPasswordControl('register-passkey'));
    const dismiss = helpers.createElement('button', {
      className: 'submission-review-dismiss',
      text: 'Dismiss',
      attributes: { type: 'button', 'aria-label': 'Dismiss temporary assessment account message' }
    });
    dismiss.addEventListener('click', () => {
      window.sessionStorage.setItem(dismissalKey, 'true');
      banner.remove();
    });
    actions.append(changePassword, registerPasskey);
    banner.append(copy, actions, dismiss);
    workspaceElement.prepend(banner);
  };

  const clearDismissals = () => {
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key.startsWith(dismissalPrefix)) window.sessionStorage.removeItem(key);
    });
  };

  return { clearDismissals, mount };
})();
