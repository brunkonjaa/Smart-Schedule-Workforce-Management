const crypto = require('crypto');
const config = require('../config/env');
const { query, withTransaction } = require('../config/db');
const { hashPassword, normalizeEmail, validatePassword } = require('./auth-service');
const { sendPasswordResetEmail } = require('./email-service');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createPasswordResetRequest = async ({ email, ipAddress }) => {
  const normalizedEmail = normalizeEmail(email);
  const result = await query(
    `
      SELECT users.id, users.email, staff_profiles.full_name
      FROM users
      LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
      WHERE users.email = $1 AND users.is_active = TRUE
      LIMIT 1
    `,
    [normalizedEmail]
  );
  const user = result.rows[0] || null;

  if (!user) {
    return { found: false };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + config.passwordResetExpiryMinutes * 60 * 1000
  );

  await query(
    `
      UPDATE password_reset_requests
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = $1 AND used_at IS NULL
    `,
    [user.id]
  );

  await query(
    `
      INSERT INTO password_reset_requests (
        user_id, token_hash, requested_ip, expires_at
      )
      VALUES ($1, $2, $3, $4)
    `,
    [user.id, tokenHash, ipAddress || null, expiresAt]
  );

  const resetUrl = `${config.appBaseUrl.replace(/\/$/, '')}/#reset-password?token=${rawToken}`;
  await sendPasswordResetEmail({
    email: user.email,
    fullName: user.full_name,
    resetUrl
  });

  return { found: true };
};

const validateResetPasswordInput = (payload) => {
  const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : '';
  const details = [];

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    details.push('token must be a valid reset token');
  }

  details.push(...validatePassword(newPassword, 'newPassword'));

  return { details, newPassword, token };
};

const consumePasswordReset = async ({ newPassword, token }) => {
  return withTransaction(async (client) => {
    const tokenHash = hashToken(token);
    const result = await client.query(
      `
        SELECT password_reset_requests.id, password_reset_requests.user_id,
               users.password_hash
        FROM password_reset_requests
        INNER JOIN users ON users.id = password_reset_requests.user_id
        WHERE password_reset_requests.token_hash = $1
          AND password_reset_requests.used_at IS NULL
          AND password_reset_requests.expires_at > NOW()
          AND users.is_active = TRUE
        FOR UPDATE
      `,
      [tokenHash]
    );
    const request = result.rows[0] || null;

    if (!request) {
      return { valid: false };
    }

    const passwordHash = await hashPassword(newPassword);
    await client.query(
      `
        UPDATE users
        SET password_hash = $1,
            must_change_password = FALSE,
            password_changed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, request.user_id]
    );
    await client.query(
      `UPDATE password_reset_requests SET used_at = NOW() WHERE id = $1`,
      [request.id]
    );

    return { valid: true };
  });
};

const listPasswordResetRequests = async () => {
  const result = await query(
    `
      SELECT password_reset_requests.id,
             users.email,
             staff_profiles.full_name,
             password_reset_requests.created_at,
             password_reset_requests.expires_at
      FROM password_reset_requests
      INNER JOIN users ON users.id = password_reset_requests.user_id
      LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
      WHERE password_reset_requests.used_at IS NULL
        AND password_reset_requests.expires_at > NOW()
      ORDER BY password_reset_requests.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    email: row.email,
    expiresAt: row.expires_at,
    fullName: row.full_name,
    id: row.id
  }));
};

module.exports = {
  createPasswordResetRequest,
  consumePasswordReset,
  listPasswordResetRequests,
  validateResetPasswordInput
};
