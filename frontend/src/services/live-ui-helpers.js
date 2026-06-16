window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.liveUiHelpers = (function createLiveUiHelpers() {
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

  const createMetric = (label, value, tone = 'neutral') => {
    const metric = createElement('article', {
      className: `metric-pill metric-pill--${tone}`
    });
    metric.appendChild(createElement('span', { text: label }));
    metric.appendChild(createElement('strong', { text: value }));
    return metric;
  };

  const renderUnauthorized = (workspaceElement, headingText, bodyText) => {
    workspaceElement.textContent = '';

    const metrics = createElement('div', { className: 'metric-row' });
    metrics.appendChild(createMetric('Access', 'Restricted', 'accent'));
    metrics.appendChild(createMetric('Session', 'Required'));
    workspaceElement.appendChild(metrics);

    const grid = createElement('div', { className: 'workspace-grid' });
    const panel = createElement('section', {
      className: 'content-panel content-panel--empty content-panel--span-16'
    });
    const emptyState = createElement('div', { className: 'empty-state' });
    emptyState.appendChild(createElement('h3', { text: headingText }));
    emptyState.appendChild(createElement('p', { text: bodyText }));
    panel.appendChild(emptyState);
    grid.appendChild(panel);
    workspaceElement.appendChild(grid);
  };

  const renderFlash = (flash) => {
    if (!flash) {
      return null;
    }

    const panel = createElement('section', {
      className: `content-panel content-panel--span-16 content-panel--alert content-panel--alert-${flash.tone}`
    });
    panel.appendChild(
      createElement('p', {
        className: 'panel-copy panel-copy--strong',
        text: flash.text
      })
    );

    if (Array.isArray(flash.details) && flash.details.length > 0) {
      const detailList = createElement('ul', { className: 'detail-list detail-list--dense' });
      flash.details.forEach((detail) => {
        detailList.appendChild(createElement('li', { text: detail }));
      });
      panel.appendChild(detailList);
    }

    return panel;
  };

  const getCurrentWeekStart = () => {
    const currentDate = new Date();
    const weekday = currentDate.getUTCDay() || 7;
    currentDate.setUTCDate(currentDate.getUTCDate() - (weekday - 1));
    return currentDate.toISOString().slice(0, 10);
  };

  const getDateOffset = (offsetDays) => {
    const currentDate = new Date();
    currentDate.setUTCDate(currentDate.getUTCDate() + offsetDays);
    return currentDate.toISOString().slice(0, 10);
  };

  const buildQueryString = (paramsConfig) => {
    const params = new window.URLSearchParams();

    Object.entries(paramsConfig || {}).forEach(([key, value]) => {
      if (value === null || typeof value === 'undefined' || value === '') {
        return;
      }

      params.set(key, value);
    });

    return params.toString();
  };

  const createPanelHeading = (title, caption) => {
    const heading = createElement('div', { className: 'panel-heading' });
    heading.appendChild(createElement('h3', { text: title }));

    if (caption) {
      heading.appendChild(
        createElement('p', {
          className: 'panel-copy',
          text: caption
        })
      );
    }

    return heading;
  };

  const createEmptyPanel = (title, bodyText, spanClass = 'content-panel--span-16') => {
    const panel = createElement('section', {
      className: `content-panel content-panel--empty ${spanClass}`
    });
    const emptyState = createElement('div', { className: 'empty-state' });
    emptyState.appendChild(createElement('h3', { text: title }));
    emptyState.appendChild(createElement('p', { text: bodyText }));
    panel.appendChild(emptyState);
    return panel;
  };

  const simplifyErrorDetail = (detail) => {
    if (typeof detail !== 'string') {
      return 'Please check the form and try again.';
    }

    if (
      /^entries\[\d+\]\.endTime must be after startTime$/.test(detail) ||
      detail === 'endTime must be after startTime' ||
      detail === 'Shift endTime must be after startTime.'
    ) {
      return 'End time must be later than start time.';
    }

    if (/startTime must be a valid HH:MM time$/.test(detail)) {
      return 'Enter a valid start time.';
    }

    if (/endTime must be a valid HH:MM time$/.test(detail)) {
      return 'Enter a valid end time.';
    }

    if (/shiftDate must be a valid YYYY-MM-DD date$/.test(detail)) {
      return 'Choose a valid shift date.';
    }

    if (/weekStart must be a valid YYYY-MM-DD date$/.test(detail)) {
      return 'Choose a valid week start date.';
    }

    if (/weekStart must be a Monday date$/.test(detail)) {
      return 'Choose a Monday for the week start.';
    }

    if (/requiredRole must be one of:/.test(detail)) {
      return 'Choose a valid role.';
    }

    if (/status must be one of:/.test(detail)) {
      return 'Choose a valid status.';
    }

    if (/dayOfWeek must be an integer between 1 and 7$/.test(detail)) {
      return 'Choose a valid day.';
    }

    if (/overlaps another availability window/.test(detail)) {
      return 'This time overlaps another availability entry for the same day.';
    }

    if (detail === 'entries must be a non-empty array') {
      return 'Add at least one availability entry first.';
    }

    if (detail === 'at least one availability field must be provided') {
      return 'Make a change before saving.';
    }

    if (detail === 'request body must be a JSON object') {
      return 'The form data could not be read. Please try again.';
    }

    if (detail === 'reason is required') {
      return 'Enter a reason.';
    }

    if (detail === 'reason must be at least 3 characters long') {
      return 'Reason must be at least 3 characters.';
    }

    if (detail === 'reason must be 500 characters or fewer') {
      return 'Reason must be 500 characters or less.';
    }

    if (detail === 'startDate must be a valid YYYY-MM-DD date') {
      return 'Choose a valid start date.';
    }

    if (detail === 'endDate must be a valid YYYY-MM-DD date') {
      return 'Choose a valid end date.';
    }

    if (detail === 'endDate must be on or after startDate') {
      return 'End date must be the same as or after the start date.';
    }

    if (detail === 'startDate cannot be in the past') {
      return 'Start date cannot be in the past.';
    }

    if (detail === 'managerComment cannot be empty') {
      return 'Enter a comment or leave it blank.';
    }

    if (detail === 'managerComment must be 500 characters or fewer') {
      return 'Comment must be 500 characters or less.';
    }

    if (/unsupported fields:/.test(detail) || /has unsupported fields:/.test(detail)) {
      return 'Some information in this form was not accepted.';
    }

    if (/staffProfileId must be a valid UUID$/.test(detail)) {
      return 'The staff filter is not valid.';
    }

    if (/leaveRequestId must be a valid UUID$/.test(detail) || /shiftId must be a valid UUID$/.test(detail) || /availabilityId must be a valid UUID$/.test(detail)) {
      return 'The selected item is not valid.';
    }

    return detail;
  };

  const simplifyErrorText = (error, fallbackText) => {
    const message = String(error?.payload?.message || error?.message || fallbackText || '').trim();

    if (error?.status === 401) {
      return 'Please sign in and try again.';
    }

    if (error?.status === 403) {
      return 'You do not have access to this action.';
    }

    if (error?.status >= 500) {
      return 'Something went wrong. Please try again.';
    }

    const directMessages = {
      'The availability request contains invalid fields.': 'Please check the availability details and try again.',
      'The leave request contains invalid fields.': 'Please check the leave request and try again.',
      'The shift request contains invalid fields.': 'Please check the shift details and try again.',
      'One or more availability windows overlap an existing entry for that week.':
        'These times overlap another availability entry for this week.',
      'This availability window overlaps another entry for the same week.':
        'This time overlaps another availability entry for this week.',
      'Only current or future availability entries can be changed.':
        'Past availability entries cannot be changed.',
      'The requested availability entry could not be found.':
        'This availability entry could not be found.',
      'This leave request overlaps an existing pending or approved request.':
        'These dates overlap another leave request.',
      'Only pending leave requests can be decided.':
        'This leave request has already been decided.',
      'Only pending leave requests can be withdrawn.':
        'Only pending leave requests can be removed.',
      'Only current or future pending leave requests can be withdrawn.':
        'Past leave requests cannot be removed.',
      'The requested leave request could not be found.':
        'This leave request could not be found.',
      'Only current or future shifts can be changed.':
        'Past shifts cannot be changed.',
      'The requested shift could not be found.':
        'This shift could not be found.'
    };

    return directMessages[message] || message || fallbackText;
  };

  const getErrorFeedback = (error, fallbackText) => {
    const details = Array.isArray(error?.payload?.details)
      ? Array.from(new Set(error.payload.details.map((detail) => simplifyErrorDetail(detail))))
      : [];

    return {
      details,
      text: simplifyErrorText(error, fallbackText)
    };
  };

  return {
    buildQueryString,
    createElement,
    createEmptyPanel,
    createMetric,
    createPanelHeading,
    getErrorFeedback,
    getCurrentWeekStart,
    getDateOffset,
    renderFlash,
    renderUnauthorized
  };
})();
