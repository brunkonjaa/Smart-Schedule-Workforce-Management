const express = require('express');
const config = require('../config/env');
const { applySessionPolicy } = require('../config/session');
const {
  authenticateUser,
  bootstrapFirstManager,
  changeCurrentUserPassword,
  emailPattern,
  getBootstrapStatus,
  normalizeFullName,
  normalizeEmail
  ,
  normalizePhoneNumber,
  phonePattern,
  validatePassword,
  allowedWorkRoles
} = require('../services/auth-service');
const {
  clearSessionCookie,
  destroySession,
  requireAuth,
  setNoStoreHeaders
} = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const { loginRateLimiter } = require('../config/rate-limit');
const { createSecurityEvent } = require('../services/security-event-service');

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

const logSecurityEventSafely = async (eventInput) => {
  try {
    await createSecurityEvent(eventInput);
  } catch (error) {
    // Security-event writes should not break the main request path.
  }
};

const sendValidationError = (response, details) => {
  return response.status(400).json({
    details,
    error: 'Validation Failed',
    message: 'The auth request contains invalid fields.'
  });
};

const validateLoginPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      details: ['request body must be a JSON object'],
      email: '',
      password: ''
    };
  }

  const details = [];
  const email = normalizeEmail(payload?.email);
  const password =
    typeof payload?.password === 'string' ? payload.password : '';
  const rememberMe =
    typeof payload?.rememberMe === 'boolean' ? payload.rememberMe : false;

  if (!email) {
    details.push('email is required');
  }

  if (!password) {
    details.push('password is required');
  }

  if (email.length > 255) {
    details.push('email must be 255 characters or fewer');
  }

  if (email && !emailPattern.test(email)) {
    details.push('email must be a valid email address');
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'rememberMe') &&
    typeof payload.rememberMe !== 'boolean'
  ) {
    details.push('rememberMe must be a boolean');
  }

  return {
    details,
    email,
    password,
    rememberMe
  };
};

const validateChangePasswordPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      currentPassword: '',
      details: ['request body must be a JSON object'],
      newPassword: ''
    };
  }

  const currentPassword =
    typeof payload.currentPassword === 'string' ? payload.currentPassword : '';
  const newPassword =
    typeof payload.newPassword === 'string' ? payload.newPassword : '';
  const details = [];

  if (!currentPassword) {
    details.push('currentPassword is required');
  }

  details.push(...validatePassword(newPassword, 'newPassword'));

  return {
    currentPassword,
    details,
    newPassword
  };
};

const validateBootstrapPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      bootstrapInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const email = normalizeEmail(payload.email);
  const fullName = normalizeFullName(payload.fullName);
  const password = typeof payload.password === 'string' ? payload.password : '';
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const primaryRole = String(payload.primaryRole || 'FLOOR').trim().toUpperCase();
  const bootstrapToken =
    typeof payload.bootstrapToken === 'string' ? payload.bootstrapToken.trim() : '';

  if (!email) {
    details.push('email is required');
  } else if (email.length > 255) {
    details.push('email must be 255 characters or fewer');
  } else if (!emailPattern.test(email)) {
    details.push('email must be a valid email address');
  }

  if (!fullName) {
    details.push('fullName is required');
  } else if (fullName.length > 120) {
    details.push('fullName must be 120 characters or fewer');
  }

  if (!allowedWorkRoles.includes(primaryRole)) {
    details.push(`primaryRole must be one of: ${allowedWorkRoles.join(', ')}`);
  }

  if (phoneNumber && !phonePattern.test(phoneNumber)) {
    details.push('phoneNumber must contain only digits and common phone symbols');
  }

  if (!bootstrapToken) {
    details.push('bootstrapToken is required');
  }

  details.push(...validatePassword(password, 'password'));

  return {
    bootstrapInput: {
      bootstrapToken,
      email,
      fullName,
      password,
      phoneNumber: phoneNumber || null,
      primaryRole
    },
    details
  };
};

router.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (request, response) => {
    const { details, email, password, rememberMe } = validateLoginPayload(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const authenticatedUser = await authenticateUser({
      email,
      password
    });

    if (!authenticatedUser) {
      await logSecurityEventSafely({
        eventType: 'LOGIN',
        ipAddress: request.ip,
        metadata: {
          email
        },
        outcome: 'FAILURE'
      });

      return response.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password.'
      });
    }

    await regenerateSession(request);

    applySessionPolicy(request, {
      rememberMe,
      role: authenticatedUser.role
    });
    request.session.user = {
      email: authenticatedUser.email,
      id: authenticatedUser.id,
      primaryRole: authenticatedUser.primaryRole,
      role: authenticatedUser.role,
      staffProfileId: authenticatedUser.staffProfileId
    };

    await saveSession(request);
    setNoStoreHeaders(response);
    await logSecurityEventSafely({
      actorUserId: authenticatedUser.id,
      eventType: 'LOGIN',
      ipAddress: request.ip,
      outcome: 'SUCCESS',
      staffProfileId: authenticatedUser.staffProfileId,
      targetUserId: authenticatedUser.id
    });

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

router.get(
  '/bootstrap/status',
  asyncHandler(async (request, response) => {
    const bootstrapStatus = await getBootstrapStatus();

    return response.status(200).json({
      bootstrap: {
        bootstrapAllowed:
          bootstrapStatus.bootstrapAllowed &&
          Boolean(config.firstManagerBootstrapToken),
        bootstrapTokenConfigured: Boolean(config.firstManagerBootstrapToken),
        legacySeedManagerPresent: bootstrapStatus.legacySeedManagerPresent,
        setupRequired: bootstrapStatus.setupRequired
      }
    });
  })
);

router.post(
  '/bootstrap/first-manager',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!config.firstManagerBootstrapToken) {
      return response.status(503).json({
        error: 'Configuration Error',
        message: 'First-manager bootstrap is not configured on this server.'
      });
    }

    const { bootstrapInput, details } = validateBootstrapPayload(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    if (bootstrapInput.bootstrapToken !== config.firstManagerBootstrapToken) {
      await logSecurityEventSafely({
        eventType: 'BOOTSTRAP_FIRST_MANAGER',
        ipAddress: request.ip,
        metadata: {
          email: bootstrapInput.email
        },
        outcome: 'FAILURE'
      });

      return response.status(403).json({
        error: 'Forbidden',
        message: 'The bootstrap token is invalid.'
      });
    }

    try {
      const result = await bootstrapFirstManager(bootstrapInput);

      await logSecurityEventSafely({
        actorUserId: result.user.id,
        eventType: 'BOOTSTRAP_FIRST_MANAGER',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: result.staffProfileId,
        targetUserId: result.user.id
      });

      return response.status(201).json({
        message: 'First manager account created successfully.',
        user: result.user
      });
    } catch (error) {
      if (error.code === 'BOOTSTRAP_UNAVAILABLE') {
        return response.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }

      if (error.code === '23505') {
        return response.status(409).json({
          error: 'Conflict',
          message: 'A user with that email already exists.'
        });
      }

      throw error;
    }
  })
);

router.post(
  '/change-password',
  requireAuth,
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { currentPassword, details, newPassword } = validateChangePasswordPayload(
      request.body
    );

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const result = await changeCurrentUserPassword({
        currentPassword,
        newPassword,
        userId: request.authUser.id
      });

      if (result.invalidCurrentPassword) {
        await logSecurityEventSafely({
          actorUserId: request.authUser.id,
          eventType: 'PASSWORD_CHANGE',
          ipAddress: request.ip,
          outcome: 'FAILURE',
          staffProfileId: request.authUser.staffProfileId,
          targetUserId: request.authUser.id
        });

        return response.status(401).json({
          error: 'Authentication Failed',
          message: 'The current password is incorrect.'
        });
      }

      setNoStoreHeaders(response);
      await logSecurityEventSafely({
        actorUserId: request.authUser.id,
        eventType: 'PASSWORD_CHANGE',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: request.authUser.staffProfileId,
        targetUserId: request.authUser.id
      });

      return response.status(200).json({
        message: 'Password changed successfully.',
        user: result.user
      });
    } catch (error) {
      if (error.code === 'PASSWORD_REUSE') {
        return response.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }

      throw error;
    }
  })
);

router.post(
  '/logout',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const sessionUser = request.session?.user || null;

    if (!request.session) {
      clearSessionCookie(response);
      setNoStoreHeaders(response);
      return response.status(204).send();
    }

    await destroySession(request);
    clearSessionCookie(response);
    setNoStoreHeaders(response);

    if (sessionUser?.id) {
      await logSecurityEventSafely({
        actorUserId: sessionUser.id,
        eventType: 'LOGOUT',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: sessionUser.staffProfileId,
        targetUserId: sessionUser.id
      });
    }

    return response.status(204).send();
  })
);

module.exports = router;
