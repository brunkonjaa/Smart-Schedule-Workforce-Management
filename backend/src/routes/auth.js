const express = require('express');
const config = require('../config/env');
const { withTransaction } = require('../config/db');
const { applySessionPolicy } = require('../config/session');
const {
  authenticateUser,
  bootstrapFirstManager,
  buildPublicUser,
  changeCurrentUserPassword,
  emailPattern,
  findUserByEmail,
  findUserById,
  getBootstrapStatus,
  normalizeFullName,
  normalizeEmail,
  normalizePhoneNumber,
  phonePattern,
  validatePassword,
  allowedWorkRoles
} = require('../services/auth-service');
const {
  clearSessionCookie,
  destroySession,
  requireAuth,
  resolveAuthenticatedUser,
  setNoStoreHeaders
} = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const { loginRateLimiter } = require('../config/rate-limit');
const { createSecurityEvent } = require('../services/security-event-service');
const {
  consumePasswordReset,
  createPasswordResetRequest,
  listPasswordResetRequests,
  validateResetPasswordInput
} = require('../services/password-reset-service');
const { requireRole } = require('../middleware/auth');
const {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  countActivePasskeys,
  saveRegistration,
  verifyAuthentication
} = require('../services/passkey-service');
const {
  acceptAdminInvitation,
  activateInvitedAdmin,
  bootstrapFirstAdmin,
  getFirstAdminBootstrapStatus,
  safeTokenMatches
} = require('../services/admin-service');

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

const bindAuthenticatedSession = async (request, user, { rememberMe = false } = {}) => {
  await regenerateSession(request);
  applySessionPolicy(request, {
    rememberMe,
    role: user.role,
    sessionVersion: user.sessionVersion
  });
  request.session.user = {
    email: user.email,
    id: user.id,
    primaryRole: user.primaryRole,
    role: user.role,
    staffProfileId: user.staffProfileId
  };
  await saveSession(request);
};

const passkeyChallengeLifetimeMs = 5 * 60 * 1000;

const getFreshPasskeyChallenge = (request, name) => {
  const challengeRecord = request.session?.[name];

  if (!challengeRecord || typeof challengeRecord !== 'object') {
    return null;
  }

  if (
    typeof challengeRecord.value !== 'string' ||
    !Number.isFinite(challengeRecord.createdAt) ||
    Date.now() - challengeRecord.createdAt > passkeyChallengeLifetimeMs
  ) {
    delete request.session[name];
    return null;
  }

  return challengeRecord.value;
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

const validateFirstAdminBootstrapPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      bootstrapToken: '',
      details: ['request body must be a JSON object'],
      password: ''
    };
  }

  const bootstrapToken = typeof payload.bootstrapToken === 'string'
    ? payload.bootstrapToken.trim()
    : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const details = [];
  if (!bootstrapToken) details.push('bootstrapToken is required');
  details.push(...validatePassword(password, 'password'));
  return { bootstrapToken, details, password };
};

const handlePasswordSecurityError = (error, response) => {
  if (error.code === 'PASSWORD_REUSE') {
    response.status(409).json({ error: 'Conflict', message: error.message });
    return true;
  }

  if (error.code === 'BREACHED_PASSWORD') {
    response.status(400).json({
      details: [error.message],
      error: 'Validation Failed',
      message: error.message
    });
    return true;
  }

  if (error.code === 'BREACHED_PASSWORD_CHECK_UNAVAILABLE') {
    response.status(503).json({
      error: 'Service Unavailable',
      message: error.message
    });
    return true;
  }

  return false;
};

const pendingAdminActivationLifetimeMs = 10 * 60 * 1000;

const resolvePasskeyRegistrationUser = async (request, response) => {
  const pendingActivation = request.session?.pendingAdminActivation;

  if (pendingActivation) {
    if (
      !Number.isFinite(pendingActivation.createdAt) ||
      Date.now() - pendingActivation.createdAt > pendingAdminActivationLifetimeMs
    ) {
      delete request.session.pendingAdminActivation;
      return null;
    }

    const user = await findUserById(pendingActivation.userId);
    if (
      user &&
      user.role === 'ADMIN' &&
      !user.isActive &&
      user.sessionVersion === pendingActivation.sessionVersion
    ) {
      return { pendingActivation: true, user: buildPublicUser(user) };
    }

    delete request.session.pendingAdminActivation;
    return null;
  }

  const user = await resolveAuthenticatedUser(request, response);
  if (!user) return null;

  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    response.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this route.'
    });
    return null;
  }

  return { pendingActivation: false, user };
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
      const attemptedUser = await findUserByEmail(email);
      await logSecurityEventSafely({
        eventType: attemptedUser?.role === 'ADMIN'
          ? 'ADMIN_AUTHENTICATION'
          : 'LOGIN',
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

    if (authenticatedUser.passwordUpgraded) {
      await logSecurityEventSafely({
        actorUserId: authenticatedUser.id,
        eventType: 'LEGACY_PASSWORD_HASH_UPGRADED',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: authenticatedUser.staffProfileId,
        targetUserId: authenticatedUser.id
      });
    }

    const passkeyCount =
      ['ADMIN', 'MANAGER'].includes(authenticatedUser.role)
        ? await countActivePasskeys(authenticatedUser.id)
        : 0;

    if (passkeyCount > 0) {
      await regenerateSession(request);
      request.session.pendingPasskeyUser = {
        ...authenticatedUser,
        rememberMe: authenticatedUser.role === 'ADMIN' ? false : rememberMe,
        sessionVersion: authenticatedUser.sessionVersion
      };
      await saveSession(request);
      setNoStoreHeaders(response);

      return response.status(200).json({
        message: 'Passkey verification required.',
        mfaRequired: true,
        user: null
      });
    }

    await bindAuthenticatedSession(request, authenticatedUser, { rememberMe });
    setNoStoreHeaders(response);
    await logSecurityEventSafely({
      actorUserId: authenticatedUser.id,
      eventType: authenticatedUser.role === 'ADMIN'
        ? 'ADMIN_AUTHENTICATION'
        : 'LOGIN',
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

router.post(
  '/passkeys/registration/options',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const registrationContext = await resolvePasskeyRegistrationUser(request, response);
    if (!registrationContext) {
      if (!response.headersSent) {
        response.status(401).json({
          error: 'Authentication Required',
          message: 'Sign in before registering a passkey.'
        });
      }
      return;
    }

    const options = await buildRegistrationOptions({ user: registrationContext.user });
    request.session.passkeyRegistrationChallenge = {
      createdAt: Date.now(),
      pendingActivation: registrationContext.pendingActivation,
      userId: registrationContext.user.id,
      value: options.challenge
    };
    await saveSession(request);
    setNoStoreHeaders(response);
    return response.status(200).json({ options });
  })
);

router.post(
  '/passkeys/registration/verify',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const registrationContext = await resolvePasskeyRegistrationUser(request, response);
    if (!registrationContext) {
      if (!response.headersSent) {
        response.status(401).json({
          error: 'Authentication Required',
          message: 'Sign in before registering a passkey.'
        });
      }
      return;
    }

    const challenge = getFreshPasskeyChallenge(
      request,
      'passkeyRegistrationChallenge'
    );
    const challengeRecord = request.session.passkeyRegistrationChallenge;

    if (
      !challenge ||
      challengeRecord?.userId !== registrationContext.user.id ||
      Boolean(challengeRecord?.pendingActivation) !== registrationContext.pendingActivation ||
      !request.body ||
      typeof request.body !== 'object'
    ) {
      return response.status(400).json({
        error: 'Passkey Registration Failed',
        message: 'The passkey registration has expired. Start again.'
      });
    }

    delete request.session.passkeyRegistrationChallenge;
    await saveSession(request);

    try {
      let result;
      let authenticatedUser;

      if (registrationContext.pendingActivation) {
        const activationResult = await withTransaction(async (client) => {
          const registration = await saveRegistration({
            client,
            expectedChallenge: challenge,
            response: request.body,
            userId: registrationContext.user.id
          });
          if (!registration.verified) return { registration, user: null };
          const user = await activateInvitedAdmin({
            client,
            userId: registrationContext.user.id
          });
          return { registration, user };
        });
        result = activationResult.registration;
        authenticatedUser = activationResult.user
          ? buildPublicUser(activationResult.user)
          : null;
      } else {
        result = await saveRegistration({
          expectedChallenge: challenge,
          response: request.body,
          userId: registrationContext.user.id
        });
        const refreshedUser = result.verified
          ? await findUserById(registrationContext.user.id)
          : null;
        authenticatedUser = refreshedUser ? buildPublicUser(refreshedUser) : null;
      }

      if (!result.verified || !authenticatedUser) {
        return response.status(400).json({
          error: 'Passkey Registration Failed',
          message: 'The passkey could not be verified.'
        });
      }

      await bindAuthenticatedSession(request, authenticatedUser, { rememberMe: false });

      await logSecurityEventSafely({
        actorUserId: authenticatedUser.id,
        eventType: 'PASSKEY_REGISTERED',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: authenticatedUser.staffProfileId,
        targetUserId: authenticatedUser.id
      });

      return response.status(201).json({
        message: `Passkey registered. Future ${authenticatedUser.role === 'ADMIN' ? 'administrator' : 'manager'} logins will require it.`,
        user: authenticatedUser
      });
    } catch (error) {
      return response.status(400).json({
        error: 'Passkey Registration Failed',
        message: 'The passkey could not be verified.'
      });
    }
  })
);

router.post(
  '/passkeys/login/options',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const pendingUser = request.session.pendingPasskeyUser;

    if (!pendingUser || !['ADMIN', 'MANAGER'].includes(pendingUser.role)) {
      return response.status(401).json({
        error: 'Authentication Required',
        message: 'Start sign-in with your email and password first.'
      });
    }

    const options = await buildAuthenticationOptions({ userId: pendingUser.id });
    request.session.passkeyAuthenticationChallenge = {
      createdAt: Date.now(),
      value: options.challenge
    };
    await saveSession(request);
    setNoStoreHeaders(response);
    return response.status(200).json({ options });
  })
);

router.post(
  '/passkeys/login/verify',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const pendingUser = request.session.pendingPasskeyUser;
    const challenge = getFreshPasskeyChallenge(
      request,
      'passkeyAuthenticationChallenge'
    );

    if (
      !pendingUser ||
      !['ADMIN', 'MANAGER'].includes(pendingUser.role) ||
      !challenge ||
      !request.body ||
      typeof request.body !== 'object'
    ) {
      return response.status(401).json({
        error: 'Authentication Failed',
        message: 'The passkey verification has expired. Start again.'
      });
    }

    delete request.session.passkeyAuthenticationChallenge;
    await saveSession(request);

    try {
      const result = await verifyAuthentication({
        expectedChallenge: challenge,
        response: request.body,
        userId: pendingUser.id
      });

      if (!result.verified) {
        await logSecurityEventSafely({
          actorUserId: pendingUser.id,
          eventType: 'PASSKEY_LOGIN',
          ipAddress: request.ip,
          outcome: 'FAILURE',
          targetUserId: pendingUser.id
        });
        if (pendingUser.role === 'ADMIN') {
          await logSecurityEventSafely({
            actorUserId: pendingUser.id,
            eventType: 'ADMIN_AUTHENTICATION',
            ipAddress: request.ip,
            outcome: 'FAILURE',
            targetUserId: pendingUser.id
          });
        }
        return response.status(401).json({
          error: 'Authentication Failed',
          message: 'The passkey could not be verified.'
        });
      }

      const verifiedUser = buildPublicUser(pendingUser);
      await bindAuthenticatedSession(request, verifiedUser, {
        rememberMe: pendingUser.rememberMe
      });
      setNoStoreHeaders(response);
      await logSecurityEventSafely({
        actorUserId: pendingUser.id,
        eventType: 'PASSKEY_LOGIN',
        ipAddress: request.ip,
        outcome: 'SUCCESS',
        staffProfileId: pendingUser.staffProfileId,
        targetUserId: pendingUser.id
      });
      if (pendingUser.role === 'ADMIN') {
        await logSecurityEventSafely({
          actorUserId: pendingUser.id,
          eventType: 'ADMIN_AUTHENTICATION',
          ipAddress: request.ip,
          outcome: 'SUCCESS',
          targetUserId: pendingUser.id
        });
      }

      return response.status(200).json({
        message: 'Passkey login successful.',
        user: verifiedUser
      });
    } catch (error) {
      return response.status(401).json({
        error: 'Authentication Failed',
        message: 'The passkey could not be verified.'
      });
    }
  })
);

router.post(
  '/password-reset/request',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const email = normalizeEmail(request.body?.email);

    if (!email || email.length > 255 || !emailPattern.test(email)) {
      return sendValidationError(response, ['email must be a valid email address']);
    }

    try {
      await createPasswordResetRequest({
        email,
        ipAddress: request.ip
      });
    } catch (error) {
      if (error.code === 'EMAIL_NOT_CONFIGURED') {
        return response.status(503).json({
          error: 'Configuration Error',
          message: 'Password recovery email is not configured on this server.'
        });
      }

      throw error;
    }

    return response.status(202).json({
      message: 'If an active account matches that email, a reset link has been sent.'
    });
  })
);

router.post(
  '/password-reset/confirm',
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { details, newPassword, token } = validateResetPasswordInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    let result;

    try {
      result = await consumePasswordReset({ newPassword, token });
    } catch (error) {
      if (handlePasswordSecurityError(error, response)) return;
      throw error;
    }

    if (!result.valid) {
      return response.status(400).json({
        error: 'Invalid Reset Link',
        message: 'This password reset link is invalid, expired, or already used.'
      });
    }

    await logSecurityEventSafely({
      eventType: 'PASSWORD_RESET',
      ipAddress: request.ip,
      outcome: 'SUCCESS',
      targetUserId: result.userId
    });

    return response.status(200).json({
      message: 'Password reset successfully. You can now sign in.'
    });
  })
);

router.get(
  '/password-reset/requests',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (request, response) => {
    return response.status(200).json({
      requests: await listPasswordResetRequests()
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

      if (handlePasswordSecurityError(error, response)) return;

      throw error;
    }
  })
);

router.get(
  '/bootstrap/admin/status',
  asyncHandler(async (request, response) => {
    const state = await getFirstAdminBootstrapStatus();
    return response.status(200).json({
      bootstrap: {
        bootstrapAllowed: state.bootstrapAllowed && Boolean(config.firstAdminBootstrapToken),
        bootstrapTokenConfigured: Boolean(config.firstAdminBootstrapToken),
        setupRequired: state.setupRequired
      }
    });
  })
);

router.post(
  '/bootstrap/first-admin',
  loginRateLimiter,
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!config.firstAdminBootstrapToken) {
      return response.status(503).json({
        error: 'Configuration Error',
        message: 'First-Admin bootstrap is not configured on this server.'
      });
    }

    const input = validateFirstAdminBootstrapPayload(request.body);
    if (input.details.length > 0) return sendValidationError(response, input.details);

    if (!safeTokenMatches(input.bootstrapToken, config.firstAdminBootstrapToken)) {
      await logSecurityEventSafely({
        eventType: 'BOOTSTRAP_FIRST_ADMIN',
        ipAddress: request.ip,
        outcome: 'FAILURE'
      });
      return response.status(403).json({
        error: 'Forbidden',
        message: 'The bootstrap token is invalid.'
      });
    }

    try {
      const user = await bootstrapFirstAdmin({ password: input.password });
      return response.status(201).json({
        message: 'First administrator account created successfully.',
        user
      });
    } catch (error) {
      await logSecurityEventSafely({
        eventType: 'BOOTSTRAP_FIRST_ADMIN',
        ipAddress: request.ip,
        outcome: 'FAILURE'
      });
      if (error.code === 'BOOTSTRAP_UNAVAILABLE') {
        return response.status(409).json({ error: 'Conflict', message: error.message });
      }
      if (error.code === '23505') {
        return response.status(409).json({
          error: 'Conflict',
          message: 'The first administrator identity already exists.'
        });
      }
      if (handlePasswordSecurityError(error, response)) return;
      throw error;
    }
  })
);

router.post(
  '/admin-invitations/accept',
  loginRateLimiter,
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      return sendValidationError(response, ['request body must be a JSON object']);
    }

    const token = typeof request.body.token === 'string' ? request.body.token.trim() : '';
    const password = typeof request.body.password === 'string' ? request.body.password : '';
    const details = validatePassword(password, 'password');
    if (!token) details.push('token is required');
    if (details.length > 0) return sendValidationError(response, details);

    try {
      const result = await acceptAdminInvitation({ password, token });
      if (!result.valid) {
        return response.status(400).json({
          error: 'Invalid Invitation',
          message: 'This administrator invitation is invalid, expired, cancelled, or already used.'
        });
      }

      await regenerateSession(request);
      request.session.pendingAdminActivation = {
        createdAt: Date.now(),
        sessionVersion: result.sessionVersion,
        userId: result.userId
      };
      request.session.cookie.maxAge = pendingAdminActivationLifetimeMs;
      await saveSession(request);
      setNoStoreHeaders(response);
      return response.status(200).json({
        message: 'Password saved. Register a passkey to activate the administrator account.',
        passkeySetupRequired: true
      });
    } catch (error) {
      if (error.code === '23505') {
        return response.status(409).json({
          error: 'Conflict',
          message: 'An account already uses the invited email.'
        });
      }
      if (handlePasswordSecurityError(error, response)) return;
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

    const rememberMe = Boolean(request.session?.auth?.rememberMe);

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

      await bindAuthenticatedSession(request, result.user, { rememberMe });
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
      if (handlePasswordSecurityError(error, response)) return;

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
