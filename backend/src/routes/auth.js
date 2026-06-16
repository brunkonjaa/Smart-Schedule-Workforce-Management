const express = require('express');
const {
  authenticateUser,
  normalizeEmail
} = require('../services/auth-service');
const {
  clearSessionCookie,
  destroySession,
  requireAuth
} = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const { loginRateLimiter } = require('../config/rate-limit');

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
  loginRateLimiter,
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
  requireAuth,
  asyncHandler(async (request, response) => {
    return response.status(200).json({
      user: request.authUser
    });
  })
);

router.post(
  '/logout',
  requireMutationProtection,
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
