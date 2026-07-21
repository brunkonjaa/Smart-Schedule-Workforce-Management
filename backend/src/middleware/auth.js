const {
  buildPublicUser,
  findUserById
} = require('../services/auth-service');
const {
  sessionCookieClearOptions,
  sessionCookieName
} = require('../config/session');

const setNoStoreHeaders = (response) => {
  response.set('Cache-Control', 'no-store');
  response.set('Pragma', 'no-cache');
};

const sendAuthenticationRequired = (response, message) => {
  return response.status(401).json({
    error: 'Authentication Required',
    message
  });
};

const destroySession = (request) => {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const clearSessionCookie = (response) => {
  response.clearCookie(sessionCookieName, sessionCookieClearOptions);
};

const invalidateSession = async (request, response) => {
  if (request.session) {
    await destroySession(request);
  }

  clearSessionCookie(response);
};

const loadAuthenticatedUser = async (request, response) => {
  if (!request.session?.user?.id) {
    sendAuthenticationRequired(
      response,
      'You must be logged in to access this route.'
    );
    return null;
  }

  const absoluteExpiresAt = request.session?.auth?.absoluteExpiresAt;

  if (absoluteExpiresAt) {
    const expiresAtTimestamp = Date.parse(absoluteExpiresAt);

    if (Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp <= Date.now()) {
      await invalidateSession(request, response);
      sendAuthenticationRequired(response, 'Your session has expired.');
      return null;
    }
  }

  const user = await findUserById(request.session.user.id);
  const sessionVersion = Number(request.session?.auth?.sessionVersion);
  const hasInactiveStaffProfile =
    typeof user?.staffProfileIsActive === 'boolean' && !user.staffProfileIsActive;

  if (
    !user ||
    !user.isActive ||
    hasInactiveStaffProfile ||
    !Number.isInteger(sessionVersion) ||
    sessionVersion !== user.sessionVersion
  ) {
    await invalidateSession(request, response);
    sendAuthenticationRequired(response, 'Your session is no longer valid.');
    return null;
  }

  setNoStoreHeaders(response);
  return buildPublicUser(user);
};

const resolveAuthenticatedUser = (request, response) => {
  if (request.authUser) {
    return Promise.resolve(request.authUser);
  }

  return Promise.resolve(loadAuthenticatedUser(request, response)).then(
    (authenticatedUser) => {
      if (!authenticatedUser) {
        return null;
      }

      request.authUser = authenticatedUser;
      return authenticatedUser;
    }
  );
};

const sendForbidden = (response) => {
  return response.status(403).json({
    error: 'Forbidden',
    message: 'You do not have permission to access this route.'
  });
};

const requireAuth = (request, response, next) => {
  resolveAuthenticatedUser(request, response)
    .then((authenticatedUser) => {
      if (!authenticatedUser) {
        return;
      }

      next();
    })
    .catch(next);
};

const requireRole = (...allowedRoles) => {
  const normalizedRoles = allowedRoles.filter(Boolean);

  if (normalizedRoles.length === 0) {
    throw new Error('requireRole must be called with at least one role.');
  }

  return (request, response, next) => {
    resolveAuthenticatedUser(request, response)
      .then((authenticatedUser) => {
        if (!authenticatedUser) {
          return;
        }

        if (!normalizedRoles.includes(authenticatedUser.role)) {
          sendForbidden(response);
          return;
        }

        next();
      })
      .catch(next);
  };
};

module.exports = {
  clearSessionCookie,
  destroySession,
  requireAuth,
  requireRole,
  resolveAuthenticatedUser,
  setNoStoreHeaders,
  sendForbidden,
  sendAuthenticationRequired
};
