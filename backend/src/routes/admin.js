const express = require('express');
const config = require('../config/env');
const { passwordActionRateLimiter } = require('../config/rate-limit');
const { withTransaction } = require('../config/db');
const {
  requireAuth,
  sendForbidden,
  setNoStoreHeaders
} = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  cancelAdminInvitation,
  changeUserRole,
  createAdminInvitation,
  createSubmissionReviewer,
  listAdminAccounts,
  listAdminInvitations,
  listSecurityEvents,
  normalizeDisplayName,
  revokeUserSessions,
  setAdminAccountActive,
  verifyAdminPassword
} = require('../services/admin-service');
const {
  emailPattern,
  normalizeEmail,
  validatePassword
} = require('../services/auth-service');
const {
  countActivePasskeys,
  listPublicPasskeys,
  revokePasskey
} = require('../services/passkey-service');
const { createSecurityEvent } = require('../services/security-event-service');

const router = express.Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recentAuthenticationLifetimeMs = 5 * 60 * 1000;

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const sendValidationError = (response, details) => {
  return response.status(400).json({
    details,
    error: 'Validation Failed',
    message: 'The administrator request contains invalid fields.'
  });
};

const sendConflict = (response, message) => {
  return response.status(409).json({ error: 'Conflict', message });
};

const handleSecurityServiceError = (error, response) => {
  if (error.code === 'BREACHED_PASSWORD') {
    response.status(400).json({
      details: [error.message],
      error: 'Validation Failed',
      message: error.message
    });
    return true;
  }

  if (
    error.code === 'BREACHED_PASSWORD_CHECK_UNAVAILABLE' ||
    error.code === 'EMAIL_NOT_CONFIGURED'
  ) {
    response.status(503).json({
      error: 'Service Unavailable',
      message: error.message
    });
    return true;
  }

  if (
    [
      'ADMIN_EMAIL_CONFLICT',
      'ADMIN_PASSKEY_REQUIRED',
      'FINAL_ADMIN_REQUIRED',
      'STAFF_PROFILE_REQUIRED'
    ].includes(error.code)
  ) {
    sendConflict(response, error.message);
    return true;
  }

  if (error.code === 'SUBMISSION_REVIEW_DISABLED') {
    sendForbidden(response);
    return true;
  }

  return false;
};

const validateUuid = (value, fieldName) => {
  return uuidPattern.test(String(value || ''))
    ? []
    : [`${fieldName} must be a valid UUID`];
};

const validateAdminIdentity = (payload, { passwordRequired = false } = {}) => {
  const details = [];
  const displayName = normalizeDisplayName(payload?.displayName);
  const email = normalizeEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!displayName) {
    details.push('displayName is required');
  } else if (displayName.length > 120) {
    details.push('displayName must be 120 characters or fewer');
  }

  if (!email || email.length > 255 || !emailPattern.test(email)) {
    details.push('email must be a valid email address');
  }

  if (passwordRequired) {
    details.push(...validatePassword(password, 'password'));
  }

  return { details, displayName, email, password };
};

const requireAdminRole = asyncHandler(async (request, response, next) => {
  if (request.authUser.role === 'ADMIN') {
    next();
    return;
  }

  try {
    await createSecurityEvent({
      actorUserId: request.authUser.id,
      eventType: 'ADMIN_ROUTE_ACCESS_DENIED',
      ipAddress: request.ip,
      metadata: { method: request.method, path: request.baseUrl + request.path },
      outcome: 'FAILURE',
      targetUserId: request.authUser.id
    });
  } catch (error) {
    // The authorization result must not depend on event storage.
  }

  sendForbidden(response);
});

const requireAdminWorkspace = asyncHandler(async (request, response, next) => {
  if (request.authUser.isSubmissionReviewer) {
    next();
    return;
  }

  const passkeyCount = await countActivePasskeys(request.authUser.id);
  if (passkeyCount > 0) {
    next();
    return;
  }

  response.status(403).json({
    code: 'ADMIN_PASSKEY_REQUIRED',
    error: 'Admin Setup Required',
    message: 'Register a passkey from Password before opening the Admin workspace.'
  });
});

const requireRecentAdminAuthentication = (request, response, next) => {
  const reauthenticatedAt = Number(request.session?.adminReauthenticatedAt);

  if (
    Number.isFinite(reauthenticatedAt) &&
    Date.now() - reauthenticatedAt <= recentAuthenticationLifetimeMs
  ) {
    next();
    return;
  }

  response.status(401).json({
    code: 'RECENT_AUTHENTICATION_REQUIRED',
    error: 'Recent Authentication Required',
    message: 'Confirm your administrator password before completing this action.'
  });
};

router.use(requireAuth, requireAdminRole, requireAdminWorkspace);

router.post(
  '/reauthenticate',
  passwordActionRateLimiter,
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const password = typeof request.body?.password === 'string'
      ? request.body.password
      : '';

    if (!password) {
      return sendValidationError(response, ['password is required']);
    }

    const verified = await verifyAdminPassword({
      password,
      userId: request.authUser.id
    });

    if (!verified) {
      await createSecurityEvent({
        actorUserId: request.authUser.id,
        eventType: 'ADMIN_REAUTHENTICATION',
        ipAddress: request.ip,
        outcome: 'FAILURE',
        targetUserId: request.authUser.id
      });
      return response.status(401).json({
        error: 'Authentication Failed',
        message: 'The administrator password is incorrect.'
      });
    }

    request.session.adminReauthenticatedAt = Date.now();
    await createSecurityEvent({
      actorUserId: request.authUser.id,
      eventType: 'ADMIN_REAUTHENTICATION',
      ipAddress: request.ip,
      outcome: 'SUCCESS',
      targetUserId: request.authUser.id
    });
    setNoStoreHeaders(response);
    return response.status(204).send();
  })
);

router.get(
  '/accounts',
  asyncHandler(async (request, response) => {
    const [accounts, invitations] = await Promise.all([
      listAdminAccounts(),
      listAdminInvitations()
    ]);
    return response.status(200).json({
      accounts,
      invitations,
      submissionReviewAccountsEnabled: config.submissionReviewAccountsEnabled
    });
  })
);

router.post(
  '/invitations',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const input = validateAdminIdentity(request.body);
    if (input.details.length > 0) return sendValidationError(response, input.details);

    try {
      const invitation = await createAdminInvitation({
        actorUserId: request.authUser.id,
        displayName: input.displayName,
        email: input.email
      });
      return response.status(201).json({
        invitation,
        message: 'Administrator invitation created and sent.'
      });
    } catch (error) {
      if (handleSecurityServiceError(error, response)) return;
      throw error;
    }
  })
);

router.post(
  '/invitations/:invitationId/cancel',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const details = validateUuid(request.params.invitationId, 'invitationId');
    if (details.length > 0) return sendValidationError(response, details);

    const cancelled = await cancelAdminInvitation({
      actorUserId: request.authUser.id,
      invitationId: request.params.invitationId
    });
    if (!cancelled) return sendConflict(response, 'This invitation is no longer pending.');
    return response.status(200).json({ message: 'Administrator invitation cancelled.' });
  })
);

router.post(
  '/submission-reviewers',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const input = validateAdminIdentity(request.body, { passwordRequired: true });
    if (input.details.length > 0) return sendValidationError(response, input.details);

    try {
      const user = await createSubmissionReviewer({
        actorUserId: request.authUser.id,
        displayName: input.displayName,
        email: input.email,
        password: input.password
      });
      return response.status(201).json({
        message: 'Temporary submission reviewer account created.',
        user
      });
    } catch (error) {
      if (error.code === '23505') {
        return sendConflict(response, 'An account already uses that email.');
      }
      if (handleSecurityServiceError(error, response)) return;
      throw error;
    }
  })
);

const accountStatusRoute = (isActive) => asyncHandler(async (request, response) => {
  const details = validateUuid(request.params.userId, 'userId');
  if (details.length > 0) return sendValidationError(response, details);

  try {
    const result = await setAdminAccountActive({
      actorUserId: request.authUser.id,
      isActive,
      targetUserId: request.params.userId
    });
    if (!result) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The administrator account could not be found.'
      });
    }
    return response.status(200).json({
      message: isActive ? 'Administrator account enabled.' : 'Administrator account disabled.'
    });
  } catch (error) {
    if (handleSecurityServiceError(error, response)) return;
    throw error;
  }
});

router.post(
  '/accounts/:userId/disable',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  accountStatusRoute(false)
);
router.post(
  '/accounts/:userId/enable',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  accountStatusRoute(true)
);

router.post(
  '/accounts/:userId/revoke-sessions',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const details = validateUuid(request.params.userId, 'userId');
    if (details.length > 0) return sendValidationError(response, details);

    const result = await revokeUserSessions({
      actorUserId: request.authUser.id,
      targetUserId: request.params.userId
    });
    if (!result) {
      return response.status(404).json({ error: 'Not Found', message: 'The account could not be found.' });
    }
    return response.status(200).json({ message: 'Existing sessions revoked.' });
  })
);

router.post(
  '/accounts/:userId/role',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const details = validateUuid(request.params.userId, 'userId');
    const role = String(request.body?.role || '').trim().toUpperCase();
    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
      details.push('role must be one of: ADMIN, MANAGER, STAFF');
    }
    if (details.length > 0) return sendValidationError(response, details);

    try {
      const result = await changeUserRole({
        actorUserId: request.authUser.id,
        role,
        targetUserId: request.params.userId
      });
      if (!result) {
        return response.status(404).json({ error: 'Not Found', message: 'The account could not be found.' });
      }
      return response.status(200).json({ message: 'Account role changed.' });
    } catch (error) {
      if (handleSecurityServiceError(error, response)) return;
      throw error;
    }
  })
);

router.get(
  '/accounts/:userId/passkeys',
  asyncHandler(async (request, response) => {
    const details = validateUuid(request.params.userId, 'userId');
    if (details.length > 0) return sendValidationError(response, details);
    return response.status(200).json({
      passkeys: await listPublicPasskeys(request.params.userId)
    });
  })
);

router.post(
  '/accounts/:userId/passkeys/:passkeyId/revoke',
  requireMutationProtection,
  requireRecentAdminAuthentication,
  asyncHandler(async (request, response) => {
    const details = [
      ...validateUuid(request.params.userId, 'userId'),
      ...validateUuid(request.params.passkeyId, 'passkeyId')
    ];
    if (details.length > 0) return sendValidationError(response, details);

    const result = await withTransaction(async (client) => {
      const revoked = await revokePasskey({
        client,
        passkeyId: request.params.passkeyId,
        userId: request.params.userId
      });
      if (!revoked) return null;

      await createSecurityEvent({
        actorUserId: request.authUser.id,
        client,
        eventType: 'PASSKEY_REVOKED',
        outcome: 'SUCCESS',
        targetUserId: request.params.userId
      });
      return revoked;
    });
    if (!result) {
      return response.status(404).json({ error: 'Not Found', message: 'The passkey could not be found.' });
    }
    return response.status(200).json({ message: 'Passkey revoked.' });
  })
);

router.get(
  '/security-events',
  asyncHandler(async (request, response) => {
    const page = Number(request.query.page || 1);
    if (!Number.isInteger(page) || page < 1) {
      return sendValidationError(response, ['page must be a whole number greater than 0']);
    }
    return response.status(200).json(await listSecurityEvents({ page, pageSize: 25 }));
  })
);

module.exports = router;
