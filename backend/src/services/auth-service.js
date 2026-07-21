const { query, withTransaction } = require('../config/db');
const { allowedWorkRoles } = require('./workflow-service-utils');
const {
  ARGON2ID_PEPPERED,
  BCRYPT,
  assertPasswordIsSafe,
  createPasswordHash,
  validatePassword,
  verifyPassword
} = require('./password-security-service');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+\-\s()]{7,20}$/;
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
    displayName: record.display_name || null,
    email: record.email,
    fullName: record.staff_profile_full_name || record.display_name || null,
    id: record.id,
    isActive: record.is_active,
    isSubmissionReviewer: Boolean(record.is_submission_reviewer),
    mustChangePassword: Boolean(record.must_change_password),
    passwordPepperVersion: record.password_pepper_version || null,
    passwordScheme: record.password_scheme || BCRYPT,
    primaryRole: record.staff_profile_primary_role || null,
    role: record.role,
    sessionVersion: Number(record.session_version || 1),
    staffProfileId: record.staff_profile_id || null,
    staffProfileIsActive:
      typeof record.staff_profile_is_active === 'boolean'
        ? record.staff_profile_is_active
        : null
  };
};

const buildPublicUser = (user) => {
  const publicUser = {
    email: user.email,
    fullName: user.fullName || null,
    id: user.id,
    mustChangePassword: Boolean(user.mustChangePassword),
    primaryRole: user.primaryRole,
    role: user.role,
    staffProfileId: user.staffProfileId
  };

  if (user.role === 'ADMIN') {
    publicUser.displayName = user.displayName || user.fullName || null;
    publicUser.isSubmissionReviewer = Boolean(user.isSubmissionReviewer);
  }

  Object.defineProperty(publicUser, 'sessionVersion', {
    enumerable: false,
    value: Number(user.sessionVersion || 1)
  });

  return publicUser;
};

const findUserByEmail = async (email, client = null) => {
  const normalizedEmail = normalizeEmail(email);

  const result = await executeQuery(
    client,
    `
      SELECT
        users.id,
        users.email,
        users.display_name,
        users.password_hash,
        users.password_scheme,
        users.password_pepper_version,
        users.role,
        users.is_active,
        users.is_submission_reviewer,
        users.session_version,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.full_name AS staff_profile_full_name,
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
        users.display_name,
        users.role,
        users.is_active,
        users.is_submission_reviewer,
        users.password_scheme,
        users.password_pepper_version,
        users.session_version,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.full_name AS staff_profile_full_name,
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
        users.display_name,
        users.password_hash,
        users.password_scheme,
        users.password_pepper_version,
        users.role,
        users.is_active,
        users.is_submission_reviewer,
        users.session_version,
        COALESCE(users.must_change_password, FALSE) AS must_change_password,
        staff_profiles.id AS staff_profile_id,
        staff_profiles.full_name AS staff_profile_full_name,
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
  return withTransaction(async (client) => {
    const normalizedEmail = normalizeEmail(email);
    const result = await client.query(
      `
        SELECT
          users.id,
          users.email,
          users.display_name,
          users.password_hash,
          users.password_scheme,
          users.password_pepper_version,
          users.role,
          users.is_active,
          users.is_submission_reviewer,
          users.session_version,
          COALESCE(users.must_change_password, FALSE) AS must_change_password,
          staff_profiles.id AS staff_profile_id,
          staff_profiles.full_name AS staff_profile_full_name,
          staff_profiles.primary_role AS staff_profile_primary_role,
          staff_profiles.is_active AS staff_profile_is_active
        FROM users
        LEFT JOIN staff_profiles
          ON staff_profiles.user_id = users.id
        WHERE users.email = $1
        LIMIT 1
        FOR UPDATE OF users
      `,
      [normalizedEmail]
    );
    const userRecord = result.rows[0] || null;

    if (!userRecord || !userRecord.is_active) {
      return null;
    }

    if (
      typeof userRecord.staff_profile_is_active === 'boolean' &&
      !userRecord.staff_profile_is_active
    ) {
      return null;
    }

    const passwordMatches = await verifyPassword({
      password,
      passwordHash: userRecord.password_hash,
      passwordPepperVersion: userRecord.password_pepper_version,
      passwordScheme: userRecord.password_scheme || BCRYPT
    });

    if (!passwordMatches) {
      return null;
    }

    let passwordUpgraded = false;

    if ((userRecord.password_scheme || BCRYPT) === BCRYPT) {
      const passwordRecord = await createPasswordHash(password);
      await client.query(
        `
          UPDATE users
          SET password_hash = $1,
              password_scheme = $2,
              password_pepper_version = $3,
              password_changed_at = NOW(),
              updated_at = NOW()
          WHERE id = $4
        `,
        [
          passwordRecord.passwordHash,
          passwordRecord.passwordScheme,
          passwordRecord.passwordPepperVersion,
          userRecord.id
        ]
      );
      userRecord.password_hash = passwordRecord.passwordHash;
      userRecord.password_scheme = passwordRecord.passwordScheme;
      userRecord.password_pepper_version = passwordRecord.passwordPepperVersion;
      passwordUpgraded = true;
    }

    const publicUser = buildPublicUser(mapUserRecord(userRecord));
    Object.defineProperty(publicUser, 'passwordUpgraded', {
      enumerable: false,
      value: passwordUpgraded
    });
    return publicUser;
  });
};

const changeCurrentUserPassword = async ({
  currentPassword,
  newPassword,
  userId
}) => {
  await assertPasswordIsSafe(newPassword);

  return withTransaction(async (client) => {
    const userRecord = await findUserWithPasswordById(userId, client);

    if (!userRecord || !userRecord.is_active) {
      return {
        invalidCurrentPassword: true,
        user: null
      };
    }

    const currentPasswordMatches = await verifyPassword({
      password: currentPassword,
      passwordHash: userRecord.password_hash,
      passwordPepperVersion: userRecord.password_pepper_version,
      passwordScheme: userRecord.password_scheme || BCRYPT
    });

    if (!currentPasswordMatches) {
      return {
        invalidCurrentPassword: true,
        user: null
      };
    }

    const newPasswordMatchesExisting = await verifyPassword({
      password: newPassword,
      passwordHash: userRecord.password_hash,
      passwordPepperVersion: userRecord.password_pepper_version,
      passwordScheme: userRecord.password_scheme || BCRYPT
    });

    if (newPasswordMatchesExisting) {
      const error = new Error('The new password must be different from the current password.');
      error.code = 'PASSWORD_REUSE';
      throw error;
    }

    const passwordRecord = await createPasswordHash(newPassword);

    await executeQuery(
      client,
      `
        UPDATE users
        SET
          password_hash = $1,
          password_scheme = $2,
          password_pepper_version = $3,
          must_change_password = FALSE,
          password_changed_at = NOW(),
          session_version = session_version + 1,
          updated_at = NOW()
        WHERE id = $4
      `,
      [
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion,
        userId
      ]
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
  await assertPasswordIsSafe(password);

  return withTransaction(async (client) => {
    const bootstrapState = await getBootstrapManagerState(client);

    if (!bootstrapState.bootstrapAllowed) {
      const error = new Error('First-manager bootstrap is not available anymore.');
      error.code = 'BOOTSTRAP_UNAVAILABLE';
      throw error;
    }

    const passwordRecord = await createPasswordHash(password);
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
            password_scheme = $3,
            password_pepper_version = $4,
            must_change_password = FALSE,
            password_changed_at = NOW(),
            session_version = session_version + 1,
            updated_at = NOW()
          WHERE id = $5
        `,
        [
          email,
          passwordRecord.passwordHash,
          passwordRecord.passwordScheme,
          passwordRecord.passwordPepperVersion,
          userId
        ]
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
            password_scheme,
            password_pepper_version,
            role,
            is_active,
            must_change_password,
            password_changed_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, 'MANAGER', TRUE, FALSE, NOW(), NOW(), NOW())
          RETURNING id
        `,
        [
          email,
          passwordRecord.passwordHash,
          passwordRecord.passwordScheme,
          passwordRecord.passwordPepperVersion
        ]
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
  findUserByEmail,
  findUserById,
  getBootstrapStatus,
  createPasswordHash,
  legacySeedManagerEmail,
  normalizeEmail,
  normalizeFullName,
  normalizePhoneNumber,
  phonePattern,
  validatePassword,
  verifyPassword,
  assertPasswordIsSafe,
  ARGON2ID_PEPPERED,
  emailPattern,
  allowedWorkRoles
};
