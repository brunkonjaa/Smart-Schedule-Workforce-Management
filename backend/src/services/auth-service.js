const bcrypt = require('bcrypt');
const { query } = require('../config/db');

const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

const mapUserRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    email: record.email,
    id: record.id,
    isActive: record.is_active,
    role: record.role,
    staffProfileId: record.staff_profile_id || null,
    staffProfileIsActive:
      typeof record.staff_profile_is_active === 'boolean'
        ? record.staff_profile_is_active
        : null
  };
};

const buildPublicUser = (user) => {
  return {
    email: user.email,
    id: user.id,
    role: user.role,
    staffProfileId: user.staffProfileId
  };
};

const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const result = await query(
    `
      SELECT
        users.id,
        users.email,
        users.password_hash,
        users.role,
        users.is_active,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.is_active AS staff_profile_is_active
      FROM users
      LEFT JOIN staff_profiles
        ON staff_profiles.user_id = users.id
      WHERE users.email = $1
      LIMIT 1
    `,
    [normalizedEmail]
  );

  return result.rows[0] || null;
};

const findUserById = async (userId) => {
  const result = await query(
    `
      SELECT
        users.id,
        users.email,
        users.role,
        users.is_active,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.is_active AS staff_profile_is_active
      FROM users
      LEFT JOIN staff_profiles
        ON staff_profiles.user_id = users.id
      WHERE users.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return mapUserRecord(result.rows[0]);
};

const authenticateUser = async ({ email, password }) => {
  const userRecord = await findUserByEmail(email);

  if (!userRecord || !userRecord.is_active) {
    return null;
  }

  if (
    typeof userRecord.staff_profile_is_active === 'boolean' &&
    !userRecord.staff_profile_is_active
  ) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(password, userRecord.password_hash);

  if (!passwordMatches) {
    return null;
  }

  return buildPublicUser(mapUserRecord(userRecord));
};

module.exports = {
  authenticateUser,
  buildPublicUser,
  findUserById,
  normalizeEmail
};
