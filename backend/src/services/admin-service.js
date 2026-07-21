const crypto = require('crypto');
const config = require('../config/env');
const { query, withTransaction } = require('../config/db');
const {
  assertPasswordIsSafe,
  buildPublicUser,
  createPasswordHash,
  findUserById,
  normalizeEmail,
  verifyPassword
} = require('./auth-service');
const { sendAdminInvitationEmail } = require('./email-service');
const { countActivePasskeys } = require('./passkey-service');
const { createSecurityEvent } = require('./security-event-service');

const firstAdminDisplayName = 'Bruno Suric';
const firstAdminEmail = 'brunkonjaa+admin@gmail.com';
const adminInvitationTokenPattern = /^[a-f0-9]{64}$/i;

const normalizeDisplayName = (value) => {
  return String(value || '').trim().replace(/\s+/g, ' ');
};

const hashSingleUseToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const safeTokenMatches = (submittedValue, configuredValue) => {
  const submittedHash = crypto.createHash('sha256').update(String(submittedValue || '')).digest();
  const configuredHash = crypto.createHash('sha256').update(String(configuredValue || '')).digest();
  return crypto.timingSafeEqual(submittedHash, configuredHash);
};

const mapAdminAccount = (row) => ({
  createdAt: row.created_at,
  displayName: row.display_name,
  email: row.email,
  id: row.id,
  isActive: row.is_active,
  isSubmissionReviewer: Boolean(row.is_submission_reviewer),
  passkeyCount: Number(row.passkey_count || 0),
  role: row.role
});

const mapInvitation = (row) => ({
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  displayName: row.display_name,
  email: row.invited_email,
  expiredAt: row.expired_at,
  expiresAt: row.expires_at,
  id: row.id,
  status: row.used_at
    ? 'CONSUMED'
    : row.cancelled_at
      ? 'CANCELLED'
      : row.expired_at || new Date(row.expires_at).getTime() <= Date.now()
        ? 'EXPIRED'
        : 'PENDING',
  usedAt: row.used_at
});

const expireAdminInvitations = async () => {
  const result = await query(
    `
      UPDATE admin_invitations
      SET expired_at = NOW()
      WHERE used_at IS NULL
        AND cancelled_at IS NULL
        AND expired_at IS NULL
        AND expires_at <= NOW()
      RETURNING id, invited_by_admin_user_id
    `
  );

  await Promise.all(result.rows.map((invitation) => {
    return createSecurityEvent({
      actorUserId: invitation.invited_by_admin_user_id,
      eventType: 'ADMIN_INVITATION_EXPIRED',
      metadata: { invitationId: invitation.id },
      outcome: 'SUCCESS'
    });
  }));
};

const listAdminAccounts = async () => {
  const result = await query(
    `
      SELECT users.id, users.email, users.display_name, users.role,
             users.is_active, users.is_submission_reviewer, users.created_at,
             COUNT(user_passkeys.id) FILTER (WHERE user_passkeys.revoked_at IS NULL)::INTEGER
               AS passkey_count
      FROM users
      LEFT JOIN user_passkeys ON user_passkeys.user_id = users.id
      WHERE users.role = 'ADMIN'
      GROUP BY users.id
      ORDER BY users.is_active DESC, users.is_submission_reviewer ASC,
               users.created_at ASC
    `
  );

  return result.rows.map(mapAdminAccount);
};

const listAdminInvitations = async () => {
  await expireAdminInvitations();
  const result = await query(
    `
      SELECT id, invited_email, display_name, expires_at, used_at,
             cancelled_at, expired_at, created_at
      FROM admin_invitations
      ORDER BY created_at DESC
      LIMIT 100
    `
  );

  return result.rows.map(mapInvitation);
};

const listSecurityEvents = async ({ page = 1, pageSize = 25 } = {}) => {
  const offset = (page - 1) * pageSize;
  const [eventsResult, countResult] = await Promise.all([
    query(
      `
        SELECT security_events.id, security_events.event_type,
               security_events.outcome, security_events.ip_address,
               security_events.metadata, security_events.created_at,
               COALESCE(actor.display_name, actor_profile.full_name, actor.email) AS actor_name,
               COALESCE(target.display_name, target_profile.full_name, target.email) AS target_name
        FROM security_events
        LEFT JOIN users actor ON actor.id = security_events.actor_user_id
        LEFT JOIN staff_profiles actor_profile ON actor_profile.user_id = actor.id
        LEFT JOIN users target ON target.id = security_events.target_user_id
        LEFT JOIN staff_profiles target_profile ON target_profile.user_id = target.id
        ORDER BY security_events.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, offset]
    ),
    query('SELECT COUNT(*)::INTEGER AS count FROM security_events')
  ]);
  const total = Number(countResult.rows[0].count);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    events: eventsResult.rows.map((row) => ({
      actorName: row.actor_name,
      createdAt: row.created_at,
      eventType: row.event_type,
      id: row.id,
      ipAddress: row.ip_address,
      metadata: row.metadata,
      outcome: row.outcome,
      targetName: row.target_name
    })),
    pagination: {
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      page,
      pageSize,
      total,
      totalPages
    }
  };
};

const getFirstAdminBootstrapStatus = async () => {
  const result = await query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM users
      WHERE role = 'ADMIN'
        AND is_active = TRUE
        AND is_submission_reviewer = FALSE
    `
  );
  const activeNonReviewAdminCount = Number(result.rows[0].count);

  return {
    bootstrapAllowed: activeNonReviewAdminCount === 0,
    setupRequired: activeNonReviewAdminCount === 0
  };
};

const bootstrapFirstAdmin = async ({ password }) => {
  await assertPasswordIsSafe(password);

  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('smart_schedule_first_admin'))");
    const stateResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS count
        FROM users
        WHERE role = 'ADMIN'
          AND is_active = TRUE
          AND is_submission_reviewer = FALSE
      `
    );

    if (Number(stateResult.rows[0].count) > 0) {
      const error = new Error('First-Admin bootstrap is not available anymore.');
      error.code = 'BOOTSTRAP_UNAVAILABLE';
      throw error;
    }

    const passwordRecord = await createPasswordHash(password);
    const result = await client.query(
      `
        INSERT INTO users (
          email, display_name, password_hash, password_scheme,
          password_pepper_version, role, is_active, must_change_password,
          password_changed_at, is_submission_reviewer, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'ADMIN', TRUE, FALSE, NOW(), FALSE, NOW(), NOW())
        RETURNING id
      `,
      [
        firstAdminEmail,
        firstAdminDisplayName,
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion
      ]
    );
    const user = await findUserById(result.rows[0].id, client);

    await createSecurityEvent({
      actorUserId: user.id,
      client,
      eventType: 'BOOTSTRAP_FIRST_ADMIN',
      outcome: 'SUCCESS',
      targetUserId: user.id
    });

    return buildPublicUser(user);
  });
};

const createAdminInvitation = async ({ actorUserId, displayName, email }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSingleUseToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.adminInvitationExpiryMinutes * 60 * 1000
  );

  const invitation = await withTransaction(async (client) => {
    const existingResult = await client.query(
      `
        SELECT
          EXISTS(SELECT 1 FROM users WHERE email = $1) AS user_exists,
          EXISTS(
            SELECT 1 FROM admin_invitations
            WHERE invited_email = $1
              AND used_at IS NULL
              AND cancelled_at IS NULL
              AND expired_at IS NULL
              AND expires_at > NOW()
          ) AS invitation_exists
      `,
      [normalizedEmail]
    );
    const existing = existingResult.rows[0];

    if (existing.user_exists || existing.invitation_exists) {
      const error = new Error('An account or pending invitation already uses that email.');
      error.code = 'ADMIN_EMAIL_CONFLICT';
      throw error;
    }

    const result = await client.query(
      `
        INSERT INTO admin_invitations (
          invited_email, display_name, token_hash,
          invited_by_admin_user_id, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, invited_email, display_name, expires_at, used_at,
                  cancelled_at, expired_at, created_at
      `,
      [normalizedEmail, normalizedDisplayName, tokenHash, actorUserId, expiresAt]
    );

    await createSecurityEvent({
      actorUserId,
      client,
      eventType: 'ADMIN_INVITATION_CREATED',
      metadata: { invitationId: result.rows[0].id },
      outcome: 'SUCCESS'
    });

    return result.rows[0];
  });

  const activationUrl = `${config.appBaseUrl.replace(/\/$/, '')}/#activate-admin?token=${rawToken}`;

  try {
    await sendAdminInvitationEmail({
      activationUrl,
      displayName: normalizedDisplayName,
      email: normalizedEmail
    });
  } catch (error) {
    await query(
      `UPDATE admin_invitations SET cancelled_at = NOW() WHERE id = $1 AND used_at IS NULL`,
      [invitation.id]
    );
    await createSecurityEvent({
      actorUserId,
      eventType: 'ADMIN_INVITATION_CREATED',
      metadata: { invitationId: invitation.id, reason: 'EMAIL_DELIVERY_FAILED' },
      outcome: 'FAILURE'
    });
    throw error;
  }

  return mapInvitation(invitation);
};

const cancelAdminInvitation = async ({ actorUserId, invitationId }) => {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE admin_invitations
        SET cancelled_at = NOW()
        WHERE id = $1
          AND used_at IS NULL
          AND cancelled_at IS NULL
          AND expired_at IS NULL
          AND expires_at > NOW()
        RETURNING id
      `,
      [invitationId]
    );

    if (result.rowCount === 0) {
      return false;
    }

    await createSecurityEvent({
      actorUserId,
      client,
      eventType: 'ADMIN_INVITATION_CANCELLED',
      metadata: { invitationId },
      outcome: 'SUCCESS'
    });
    return true;
  });
};

const acceptAdminInvitation = async ({ password, token }) => {
  if (!adminInvitationTokenPattern.test(String(token || ''))) {
    return { valid: false };
  }

  await assertPasswordIsSafe(password);
  const tokenHash = hashSingleUseToken(token);

  return withTransaction(async (client) => {
    const result = await client.query(
      `
        SELECT id, invited_email, display_name, invited_by_admin_user_id
        FROM admin_invitations
        WHERE token_hash = $1
          AND used_at IS NULL
          AND cancelled_at IS NULL
          AND expired_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
      `,
      [tokenHash]
    );
    const invitation = result.rows[0] || null;

    if (!invitation) {
      return { valid: false };
    }

    const passwordRecord = await createPasswordHash(password);
    const userResult = await client.query(
      `
        INSERT INTO users (
          email, display_name, password_hash, password_scheme,
          password_pepper_version, role, is_active, must_change_password,
          password_changed_at, is_submission_reviewer, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'ADMIN', FALSE, FALSE, NOW(), FALSE, NOW(), NOW())
        RETURNING id, session_version
      `,
      [
        invitation.invited_email,
        invitation.display_name,
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion
      ]
    );

    await client.query(
      'UPDATE admin_invitations SET used_at = NOW() WHERE id = $1',
      [invitation.id]
    );
    await createSecurityEvent({
      actorUserId: invitation.invited_by_admin_user_id,
      client,
      eventType: 'ADMIN_INVITATION_CONSUMED',
      metadata: { invitationId: invitation.id },
      outcome: 'SUCCESS',
      targetUserId: userResult.rows[0].id
    });

    return {
      displayName: invitation.display_name,
      email: invitation.invited_email,
      sessionVersion: Number(userResult.rows[0].session_version),
      userId: userResult.rows[0].id,
      valid: true
    };
  });
};

const activateInvitedAdmin = async ({ client, userId }) => {
  const result = await client.query(
    `
      UPDATE users
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = $1
        AND role = 'ADMIN'
        AND is_active = FALSE
        AND is_submission_reviewer = FALSE
      RETURNING id
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  await createSecurityEvent({
    actorUserId: userId,
    client,
    eventType: 'ADMIN_ACCOUNT_ACTIVATED',
    outcome: 'SUCCESS',
    targetUserId: userId
  });
  return findUserById(userId, client);
};

const createSubmissionReviewer = async ({ actorUserId, displayName, email, password }) => {
  if (!config.submissionReviewAccountsEnabled) {
    const error = new Error('Submission-review account creation is disabled.');
    error.code = 'SUBMISSION_REVIEW_DISABLED';
    throw error;
  }

  await assertPasswordIsSafe(password);
  const passwordRecord = await createPasswordHash(password);

  return withTransaction(async (client) => {
    const result = await client.query(
      `
        INSERT INTO users (
          email, display_name, password_hash, password_scheme,
          password_pepper_version, role, is_active, must_change_password,
          password_changed_at, is_submission_reviewer, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'ADMIN', TRUE, FALSE, NOW(), TRUE, NOW(), NOW())
        RETURNING id
      `,
      [
        normalizeEmail(email),
        normalizeDisplayName(displayName),
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion
      ]
    );
    const user = await findUserById(result.rows[0].id, client);

    await createSecurityEvent({
      actorUserId,
      client,
      eventType: 'SUBMISSION_REVIEWER_CREATED',
      outcome: 'SUCCESS',
      targetUserId: user.id
    });
    return buildPublicUser(user);
  });
};

const getAdminAccountForUpdate = async (client, userId) => {
  const result = await client.query(
    `
      SELECT id, role, is_active, is_submission_reviewer
      FROM users
      WHERE id = $1
      FOR UPDATE
    `,
    [userId]
  );
  return result.rows[0] || null;
};

const assertNotFinalActiveAdmin = async (client, target) => {
  if (
    target.role !== 'ADMIN' ||
    !target.is_active ||
    target.is_submission_reviewer
  ) {
    return;
  }

  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('smart_schedule_active_admin'))"
  );

  const countResult = await client.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM users
      WHERE role = 'ADMIN'
        AND is_active = TRUE
        AND is_submission_reviewer = FALSE
    `
  );

  if (Number(countResult.rows[0].count) <= 1) {
    const error = new Error('The final active non-review administrator cannot be disabled or demoted.');
    error.code = 'FINAL_ADMIN_REQUIRED';
    throw error;
  }
};

const setAdminAccountActive = async ({ actorUserId, isActive, targetUserId }) => {
  return withTransaction(async (client) => {
    const target = await getAdminAccountForUpdate(client, targetUserId);

    if (!target || target.role !== 'ADMIN') {
      return null;
    }

    if (!isActive) {
      await assertNotFinalActiveAdmin(client, target);
    } else if (!target.is_submission_reviewer) {
      const passkeyCount = await countActivePasskeys(targetUserId, client);
      if (passkeyCount === 0) {
        const error = new Error('A normal administrator needs a registered passkey before activation.');
        error.code = 'ADMIN_PASSKEY_REQUIRED';
        throw error;
      }
    }

    const result = await client.query(
      `
        UPDATE users
        SET is_active = $1,
            session_version = session_version + 1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING session_version
      `,
      [isActive, targetUserId]
    );
    await createSecurityEvent({
      actorUserId,
      client,
      eventType: isActive ? 'ADMIN_ACCOUNT_ENABLED' : 'ADMIN_ACCOUNT_DISABLED',
      outcome: 'SUCCESS',
      targetUserId
    });
    return { sessionVersion: Number(result.rows[0].session_version) };
  });
};

const revokeUserSessions = async ({ actorUserId, targetUserId }) => {
  return withTransaction(async (client) => {
    const target = await getAdminAccountForUpdate(client, targetUserId);
    if (!target) return null;

    const result = await client.query(
      `
        UPDATE users
        SET session_version = session_version + 1,
            updated_at = NOW()
        WHERE id = $1
        RETURNING session_version
      `,
      [targetUserId]
    );
    await createSecurityEvent({
      actorUserId,
      client,
      eventType: 'SESSIONS_REVOKED',
      outcome: 'SUCCESS',
      targetUserId
    });
    return { sessionVersion: Number(result.rows[0].session_version) };
  });
};

const changeUserRole = async ({ actorUserId, role, targetUserId }) => {
  return withTransaction(async (client) => {
    const target = await getAdminAccountForUpdate(client, targetUserId);
    if (!target) return null;

    if (target.role === 'ADMIN' && role !== 'ADMIN') {
      await assertNotFinalActiveAdmin(client, target);
      const profileResult = await client.query(
        'SELECT id FROM staff_profiles WHERE user_id = $1 LIMIT 1',
        [targetUserId]
      );
      if (profileResult.rowCount === 0) {
        const error = new Error('This account has no staff profile, so it cannot be changed to an operational role.');
        error.code = 'STAFF_PROFILE_REQUIRED';
        throw error;
      }
    }

    const result = await client.query(
      `
        UPDATE users
        SET role = $1::VARCHAR,
            is_submission_reviewer = CASE WHEN $1::VARCHAR = 'ADMIN' THEN is_submission_reviewer ELSE FALSE END,
            session_version = session_version + 1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING session_version
      `,
      [role, targetUserId]
    );
    await createSecurityEvent({
      actorUserId,
      client,
      eventType: 'ACCOUNT_ROLE_CHANGED',
      metadata: { role },
      outcome: 'SUCCESS',
      targetUserId
    });
    return { sessionVersion: Number(result.rows[0].session_version) };
  });
};

const verifyAdminPassword = async ({ password, userId }) => {
  const result = await query(
    `
      SELECT password_hash, password_scheme, password_pepper_version
      FROM users
      WHERE id = $1 AND role = 'ADMIN' AND is_active = TRUE
      LIMIT 1
    `,
    [userId]
  );
  const user = result.rows[0] || null;
  if (!user) return false;

  return verifyPassword({
    password,
    passwordHash: user.password_hash,
    passwordPepperVersion: user.password_pepper_version,
    passwordScheme: user.password_scheme
  });
};

module.exports = {
  acceptAdminInvitation,
  activateInvitedAdmin,
  adminInvitationTokenPattern,
  bootstrapFirstAdmin,
  cancelAdminInvitation,
  changeUserRole,
  createAdminInvitation,
  createSubmissionReviewer,
  firstAdminDisplayName,
  firstAdminEmail,
  getFirstAdminBootstrapStatus,
  hashSingleUseToken,
  listAdminAccounts,
  listAdminInvitations,
  listSecurityEvents,
  normalizeDisplayName,
  revokeUserSessions,
  safeTokenMatches,
  setAdminAccountActive,
  verifyAdminPassword
};
