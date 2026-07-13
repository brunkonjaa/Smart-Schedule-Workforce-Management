const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../config/db');
const { allowedWorkRoles } = require('./workflow-service-utils');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+\-\s()]{7,20}$/;
const passwordHashRounds = 12;
const legacySeedManagerEmail = 'manager@example.com';

const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

const normalizeFullName = (value) => {
  return String(value || '').trim().replace(/\s+/g, ' ');
};

const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const validatePassword = (password, fieldName = 'password') => {
  const details = [];

  if (typeof password !== 'string' || !password) {
    details.push(`${fieldName} is required`);
  } else if (password !== password.trim()) {
    details.push(`${fieldName} cannot start or end with spaces`);
  } else if (password.length < 12) {
    details.push(`${fieldName} must be at least 12 characters long`);
  } else if (password.length > 72) {
    details.push(`${fieldName} must be 72 characters or fewer`);
  } else if (!/[a-z]/.test(password)) {
    details.push(`${fieldName} must include a lowercase letter`);
  } else if (!/[A-Z]/.test(password)) {
    details.push(`${fieldName} must include an uppercase letter`);
  } else if (!/[0-9]/.test(password)) {
    details.push(`${fieldName} must include a number`);
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    details.push(`${fieldName} must include a symbol`);
  }

  return details;
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, passwordHashRounds);
};

const executeQuery = (client, text, params) => {
  if (client) {
    return client.query(text, params);
  }

  return query(text, params);
};

const mapUserRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    email: record.email,
    id: record.id,
    isActive: record.is_active,
    mustChangePassword: Boolean(record.must_change_password),
    primaryRole: record.staff_profile_primary_role || null,
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
    mustChangePassword: Boolean(user.mustChangePassword),
    primaryRole: user.primaryRole,
    role: user.role,
    staffProfileId: user.staffProfileId
  };
};

const findUserByEmail = async (email, client = null) => {
  const normalizedEmail = normalizeEmail(email);

  const result = await executeQuery(
    client,
    `
      SELECT
        users.id,
        users.email,
        users.password_hash,
        users.role,
        users.is_active,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.primary_role AS staff_profile_primary_role,
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

const findUserById = async (userId, client = null) => {
  const result = await executeQuery(
    client,
    `
      SELECT
        users.id,
        users.email,
        users.role,
        users.is_active,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.primary_role AS staff_profile_primary_role,
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

const findUserWithPasswordById = async (userId, client = null) => {
  const result = await executeQuery(
    client,
    `
      SELECT
        users.id,
        users.email,
        users.password_hash,
        users.role,
        users.is_active,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.primary_role AS staff_profile_primary_role,
        staff_profiles.is_active AS staff_profile_is_active
      FROM users
      LEFT JOIN staff_profiles
        ON staff_profiles.user_id = users.id
      WHERE users.id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
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

const changeCurrentUserPassword = async ({
  currentPassword,
  newPassword,
  userId
}) => {
  return withTransaction(async (client) => {
    const userRecord = await findUserWithPasswordById(userId, client);

    if (!userRecord || !userRecord.is_active) {
      return {
        invalidCurrentPassword: true,
        user: null
      };
    }

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      userRecord.password_hash
    );

    if (!currentPasswordMatches) {
      return {
        invalidCurrentPassword: true,
        user: null
      };
    }

    const newPasswordMatchesExisting = await bcrypt.compare(
      newPassword,
      userRecord.password_hash
    );

    if (newPasswordMatchesExisting) {
      const error = new Error('The new password must be different from the current password.');
      error.code = 'PASSWORD_REUSE';
      throw error;
    }

    const passwordHash = await hashPassword(newPassword);

    await executeQuery(
      client,
      `
        UPDATE users
        SET
          password_hash = $1,
          must_change_password = FALSE,
          password_changed_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, userId]
    );

    return {
      invalidCurrentPassword: false,
      user: buildPublicUser(await findUserById(userId, client))
    };
  });
};

const getBootstrapManagerState = async (client = null) => {
  const result = await executeQuery(
    client,
    `
      SELECT
        users.id,
        users.email,
        staff_profiles.id AS staff_profile_id
      FROM users
      LEFT JOIN staff_profiles
        ON staff_profiles.user_id = users.id
      WHERE users.role = 'MANAGER'
        AND users.is_active = TRUE
      ORDER BY users.created_at ASC
    `
  );

  const activeManagers = result.rows;
  const legacyManager = activeManagers.find((manager) => {
    return normalizeEmail(manager.email) === legacySeedManagerEmail;
  }) || null;
  const activeNonLegacyManagers = activeManagers.filter((manager) => {
    return normalizeEmail(manager.email) !== legacySeedManagerEmail;
  });

  return {
    activeManagerCount: activeManagers.length,
    bootstrapAllowed: activeNonLegacyManagers.length === 0,
    legacyManager,
    legacySeedManagerPresent: Boolean(legacyManager),
    setupRequired: activeNonLegacyManagers.length === 0
  };
};

const getBootstrapStatus = async () => {
  return getBootstrapManagerState();
};

const bootstrapFirstManager = async ({
  email,
  fullName,
  password,
  phoneNumber,
  primaryRole
}) => {
  return withTransaction(async (client) => {
    const bootstrapState = await getBootstrapManagerState(client);

    if (!bootstrapState.bootstrapAllowed) {
      const error = new Error('First-manager bootstrap is not available anymore.');
      error.code = 'BOOTSTRAP_UNAVAILABLE';
      throw error;
    }

    const passwordHash = await hashPassword(password);
    let userId = null;
    let staffProfileId = null;

    if (bootstrapState.legacyManager) {
      userId = bootstrapState.legacyManager.id;
      staffProfileId = bootstrapState.legacyManager.staff_profile_id || null;

      await executeQuery(
        client,
        `
          UPDATE users
          SET
            email = $1,
            password_hash = $2,
            must_change_password = FALSE,
            password_changed_at = NOW(),
            updated_at = NOW()
          WHERE id = $3
        `,
        [email, passwordHash, userId]
      );

      if (staffProfileId) {
        await executeQuery(
          client,
          `
            UPDATE staff_profiles
            SET
              full_name = $1,
              primary_role = $2,
              contract_hours = 40.00,
              phone_number = $3,
              is_active = TRUE,
              updated_at = NOW()
            WHERE id = $4
          `,
          [fullName, primaryRole, phoneNumber || null, staffProfileId]
        );
      } else {
        const insertedStaffProfile = await executeQuery(
          client,
          `
            INSERT INTO staff_profiles (
              user_id,
              full_name,
              primary_role,
              contract_hours,
              phone_number,
              is_active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, 40.00, $4, TRUE, NOW(), NOW())
            RETURNING id
          `,
          [userId, fullName, primaryRole, phoneNumber || null]
        );

        staffProfileId = insertedStaffProfile.rows[0].id;
      }
    } else {
      const insertedUser = await executeQuery(
        client,
        `
          INSERT INTO users (
            email,
            password_hash,
            role,
            is_active,
            must_change_password,
            password_changed_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'MANAGER', TRUE, FALSE, NOW(), NOW(), NOW())
          RETURNING id
        `,
        [email, passwordHash]
      );

      userId = insertedUser.rows[0].id;

      const insertedStaffProfile = await executeQuery(
        client,
        `
          INSERT INTO staff_profiles (
            user_id,
            full_name,
            primary_role,
            contract_hours,
            phone_number,
            is_active,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, 40.00, $4, TRUE, NOW(), NOW())
          RETURNING id
        `,
        [userId, fullName, primaryRole, phoneNumber || null]
      );

      staffProfileId = insertedStaffProfile.rows[0].id;
    }

    const user = await findUserById(userId, client);

    return {
      staffProfileId,
      user: buildPublicUser(user)
    };
  });
};

module.exports = {
  authenticateUser,
  bootstrapFirstManager,
  buildPublicUser,
  changeCurrentUserPassword,
  findUserById,
  getBootstrapStatus,
  hashPassword,
  legacySeedManagerEmail,
  normalizeFullName,
  normalizeEmail
  ,
  normalizePhoneNumber,
  passwordHashRounds,
  phonePattern,
  validatePassword,
  emailPattern,
  allowedWorkRoles
};
