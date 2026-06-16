window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.apiClient = (function createApiClient() {
  const mutationHeaderName = 'X-Smart-Schedule-CSRF';

  const parseResponseBody = async (response) => {
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  };

  const request = async (path, options = {}) => {
    const requestHeaders = new window.Headers(options.headers || {});
    const method = (options.method || 'GET').toUpperCase();

    if (options.body && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      requestHeaders.set(mutationHeaderName, '1');
    }

    const response = await window.fetch(path, {
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      headers: requestHeaders,
      method
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      const error = new Error(
        payload?.message || 'The request could not be completed.'
      );
      error.payload = payload;
      error.status = response.status;
      throw error;
    }

    return payload;
  };

  return {
    get(path) {
      return request(path);
    },
    post(path, body) {
      return request(path, {
        body,
        method: 'POST'
      });
    },
    put(path, body) {
      return request(path, {
        body,
        method: 'PUT'
      });
    }
  };
})();
