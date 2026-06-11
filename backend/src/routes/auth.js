const express = require('express');
const {
  authenticateUser,
  buildPublicUser,
  findUserById,
  normalizeEmail
} = require('../services/auth-service');
const { sessionCookieName } = require('../config/session');

const router = express.Router();

const asyncHandler = (handler) => {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};

const regenerateSession = (request) => {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const saveSession = (request) => {
  return new Promise((resolve, reject) => {
    request.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
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
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax'
  });
};

const sendValidationError = (response, details) => {
  return response.status(400).json({
    details,
    error: 'Validation Failed',
    message: 'The login request is missing required fields.'
  });
};

const validateLoginPayload = (payload) => {
  const details = [];
  const email = normalizeEmail(payload?.email);
  const password =
    typeof payload?.password === 'string' ? payload.password : '';

  if (!email) {
    details.push('email is required');
  }

  if (!password) {
    details.push('password is required');
  }

  if (email && !email.includes('@')) {
    details.push('email must be a valid email address');
  }

  return {
    details,
    email,
    password
  };
};

router.post(
  '/login',
  asyncHandler(async (request, response) => {
    const { details, email, password } = validateLoginPayload(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const authenticatedUser = await authenticateUser({
      email,
      password
    });

    if (!authenticatedUser) {
      return response.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password.'
      });
    }

    await regenerateSession(request);

    request.session.user = {
      email: authenticatedUser.email,
      id: authenticatedUser.id,
      role: authenticatedUser.role,
      staffProfileId: authenticatedUser.staffProfileId
    };

    await saveSession(request);

    return response.status(200).json({
      message: 'Login successful.',
      user: authenticatedUser
    });
  })
);

router.get(
  '/me',
  asyncHandler(async (request, response) => {
    if (!request.session?.user?.id) {
      return response.status(401).json({
        error: 'Authentication Required',
        message: 'You must be logged in to access this route.'
      });
    }

    const user = await findUserById(request.session.user.id);

    if (!user || !user.isActive) {
      await destroySession(request);
      clearSessionCookie(response);

      return response.status(401).json({
        error: 'Authentication Required',
        message: 'Your session is no longer valid.'
      });
    }

    if (
      typeof user.staffProfileIsActive === 'boolean' &&
      !user.staffProfileIsActive
    ) {
      await destroySession(request);
      clearSessionCookie(response);

      return response.status(401).json({
        error: 'Authentication Required',
        message: 'Your session is no longer valid.'
      });
    }

    return response.status(200).json({
      user: buildPublicUser(user)
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (request, response) => {
    if (!request.session) {
      clearSessionCookie(response);
      return response.status(204).send();
    }

    await destroySession(request);
    clearSessionCookie(response);

    return response.status(204).send();
  })
);

module.exports = router;
