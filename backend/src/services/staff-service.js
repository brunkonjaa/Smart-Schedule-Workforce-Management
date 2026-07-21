const { pool, query } = require('../config/db');
const {
  assertPasswordIsSafe,
  createPasswordHash,
  normalizeEmail,
  validatePassword
} = require('./auth-service');

const allowedPrimaryRoles = ['FLOOR', 'BAR', 'KITCHEN', 'OTHER'];
const allowedStatusFilters = ['ALL', 'ACTIVE', 'INACTIVE'];
const createFieldNames = [
  'contractHours',
  'email',
  'fullName',
  'isActive',
  'password',
  'phoneNumber',
  'primaryRole'
];
const updateFieldNames = [
  'contractHours',
  'email',
  'fullName',
  'isActive',
  'phoneNumber',
  'primaryRole'
];
const listFilterNames = ['primaryRole', 'search', 'status'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapStaffRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    contractHours: Number(record.contract_hours),
    createdAt: record.created_at,
    email: record.email,
    fullName: record.full_name,
    id: record.id,
    isActive: record.user_is_active && record.staff_profile_is_active,
    phoneNumber: record.phone_number,
    primaryRole: record.primary_role,
    role: record.user_role,
    updatedAt: record.updated_at,
    userId: record.user_id
  };
};

const normalizePrimaryRole = (value) => {
  return String(value || '').trim().toUpperCase();
};

const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeFullName = (value) => {
  return String(value || '').trim().replace(/\s+/g, ' ');
};

const normalizeContractHours = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Number(parsedValue.toFixed(2));
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const listUnexpectedFields = (payload, allowedFields) => {
  if (!isPlainObject(payload)) {
    return [];
  }

  return Object.keys(payload).filter((fieldName) => {
    return !allowedFields.includes(fieldName);
  });
};

const hasTwoDecimalPlacesOrFewer = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') {
    return false;
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue) {
    return false;
  }

  return /^-?\d+(\.\d{1,2})?$/.test(normalizedValue);
};

const normalizeStatusFilter = (value) => {
  const normalizedValue = String(value || 'ACTIVE').trim().toUpperCase();

  if (!allowedStatusFilters.includes(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

const validateStaffCreateInput = (payload) => {
  const details = [];
  const unexpectedFields = listUnexpectedFields(payload, createFieldNames);

  if (!isPlainObject(payload)) {
    return {
      details: ['request body must be a JSON object'],
      staffInput: {}
    };
  }

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  const email = normalizeEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const fullName = normalizeFullName(payload?.fullName);
  const primaryRole = normalizePrimaryRole(payload?.primaryRole);
  const contractHours = normalizeContractHours(payload?.contractHours);
  const phoneNumber = normalizePhoneNumber(payload?.phoneNumber);
  const hasIsActive = Object.prototype.hasOwnProperty.call(payload, 'isActive');
  const isActive = hasIsActive ? payload.isActive : true;

  if (!email) {
    details.push('email is required');
  } else if (email.length > 255) {
    details.push('email must be 255 characters or fewer');
  } else if (!emailPattern.test(email)) {
    details.push('email must be a valid email address');
  }

  if (!password) {
    details.push(...validatePassword(password, 'password'));
  } else {
    details.push(...validatePassword(password, 'password'));
  }

  if (!fullName) {
    details.push('fullName is required');
  } else if (fullName.length > 120) {
    details.push('fullName must be 120 characters or fewer');
  }

  if (!allowedPrimaryRoles.includes(primaryRole)) {
    details.push(`primaryRole must be one of: ${allowedPrimaryRoles.join(', ')}`);
  }

  if (!hasTwoDecimalPlacesOrFewer(payload?.contractHours)) {
    details.push('contractHours must use no more than 2 decimal places');
  } else if (contractHours === null) {
    details.push('contractHours must be a valid number');
  } else if (contractHours < 0 || contractHours > 60) {
    details.push('contractHours must be between 0 and 60');
  }

  if (
    phoneNumber &&
    !/^[0-9+\-\s()]{7,20}$/.test(phoneNumber)
  ) {
    details.push('phoneNumber must contain only digits and common phone symbols');
  }

  if (hasIsActive && typeof isActive !== 'boolean') {
    details.push('isActive must be a boolean');
  }

  return {
    details,
    staffInput: {
      contractHours,
      email,
      fullName,
      isActive,
      password,
      phoneNumber: phoneNumber || null,
      primaryRole
    }
  };
};

const validateStaffUpdateInput = (payload) => {
  const details = [];
  const candidateInput = {};
  const unexpectedFields = listUnexpectedFields(payload, updateFieldNames);

  if (!isPlainObject(payload)) {
    return {
      details: ['request body must be a JSON object'],
      staffInput: {}
    };
  }

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    const email = normalizeEmail(payload.email);
    if (!email) {
      details.push('email cannot be empty');
    } else if (email.length > 255) {
      details.push('email must be 255 characters or fewer');
    } else if (!emailPattern.test(email)) {
      details.push('email must be a valid email address');
    } else {
      candidateInput.email = email;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'fullName')) {
    const fullName = normalizeFullName(payload.fullName);
    if (!fullName) {
      details.push('fullName cannot be empty');
    } else if (fullName.length > 120) {
      details.push('fullName must be 120 characters or fewer');
    } else {
      candidateInput.fullName = fullName;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'primaryRole')) {
    const primaryRole = normalizePrimaryRole(payload.primaryRole);
    if (!allowedPrimaryRoles.includes(primaryRole)) {
      details.push(`primaryRole must be one of: ${allowedPrimaryRoles.join(', ')}`);
    } else {
      candidateInput.primaryRole = primaryRole;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'contractHours')) {
    const contractHours = normalizeContractHours(payload.contractHours);
    if (!hasTwoDecimalPlacesOrFewer(payload.contractHours)) {
      details.push('contractHours must use no more than 2 decimal places');
    } else if (contractHours === null) {
      details.push('contractHours must be a valid number');
    } else if (contractHours < 0 || contractHours > 60) {
      details.push('contractHours must be between 0 and 60');
    } else {
      candidateInput.contractHours = contractHours;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'phoneNumber')) {
    const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
    if (
      phoneNumber &&
      !/^[0-9+\-\s()]{7,20}$/.test(phoneNumber)
    ) {
      details.push('phoneNumber must contain only digits and common phone symbols');
    } else {
      candidateInput.phoneNumber = phoneNumber || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    if (typeof payload.isActive !== 'boolean') {
      details.push('isActive must be a boolean');
    } else {
      candidateInput.isActive = payload.isActive;
    }
  }

  if (Object.keys(candidateInput).length === 0 && details.length === 0) {
    details.push('at least one staff field must be provided');
  }

  return {
    details,
    staffInput: candidateInput
  };
};

const buildListFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterNames.includes(fieldName);
  });
  let search = '';
  let primaryRole = '';
  let status = 'ACTIVE';

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(queryParams || {}, 'search')) {
    if (typeof queryParams.search !== 'string') {
      details.push('search must be a string');
    } else {
      search = queryParams.search.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(queryParams || {}, 'primaryRole')) {
    if (typeof queryParams.primaryRole !== 'string') {
      details.push('primaryRole must be a string');
    } else {
      primaryRole = normalizePrimaryRole(queryParams.primaryRole);
    }
  }

  if (Object.prototype.hasOwnProperty.call(queryParams || {}, 'status')) {
    if (typeof queryParams.status !== 'string') {
      details.push('status must be a string');
      status = null;
    } else {
      status = normalizeStatusFilter(queryParams.status);
    }
  } else {
    status = normalizeStatusFilter('ACTIVE');
  }

  if (search.length > 100) {
    details.push('search must be 100 characters or fewer');
  }

  if (primaryRole && !allowedPrimaryRoles.includes(primaryRole)) {
    details.push(`primaryRole must be one of: ${allowedPrimaryRoles.join(', ')}`);
  }

  if (!status) {
    details.push(`status must be one of: ${allowedStatusFilters.join(', ')}`);
  }

  return {
    details,
    filters: {
      primaryRole: primaryRole || null,
      search,
      status
    }
  };
};

const listStaff = async (filters) => {
  const values = [];
  const conditions = [`users.role = 'STAFF'`];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const searchPlaceholder = `$${values.length}`;
    conditions.push(
      `(
        staff_profiles.full_name ILIKE ${searchPlaceholder}
        OR users.email ILIKE ${searchPlaceholder}
        OR staff_profiles.primary_role ILIKE ${searchPlaceholder}
      )`
    );
  }

  if (filters.primaryRole) {
    values.push(filters.primaryRole);
    conditions.push(`staff_profiles.primary_role = $${values.length}`);
  }

  if (filters.status === 'ACTIVE') {
    conditions.push('users.is_active = TRUE');
    conditions.push('staff_profiles.is_active = TRUE');
  }

  if (filters.status === 'INACTIVE') {
    conditions.push('(users.is_active = FALSE OR staff_profiles.is_active = FALSE)');
  }

  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.user_id,
        users.email,
        users.role AS user_role,
        users.is_active AS user_is_active,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours,
        staff_profiles.phone_number,
        staff_profiles.is_active AS staff_profile_is_active,
        staff_profiles.created_at,
        staff_profiles.updated_at
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY staff_profiles.full_name ASC
    `,
    values
  );

  return result.rows.map((row) => mapStaffRecord(row));
};

const findStaffById = async (staffId) => {
  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.user_id,
        users.email,
        users.role AS user_role,
        users.is_active AS user_is_active,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours,
        staff_profiles.phone_number,
        staff_profiles.is_active AS staff_profile_is_active,
        staff_profiles.created_at,
        staff_profiles.updated_at
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE staff_profiles.id = $1
        AND users.role = 'STAFF'
      LIMIT 1
    `,
    [staffId]
  );

  return mapStaffRecord(result.rows[0]);
};

const createStaff = async (staffInput) => {
  await assertPasswordIsSafe(staffInput.password);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordRecord = await createPasswordHash(staffInput.password);

    const userResult = await client.query(
      `
        INSERT INTO users (
          email,
          password_hash,
          password_scheme,
          password_pepper_version,
          role,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'STAFF', $5, NOW(), NOW())
        RETURNING id, email, role, is_active
      `,
      [
        staffInput.email,
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion,
        staffInput.isActive
      ]
    );

    const createdUser = userResult.rows[0];

    const staffResult = await client.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING
          id,
          user_id,
          full_name,
          primary_role,
          contract_hours,
          phone_number,
          is_active AS staff_profile_is_active,
          created_at,
          updated_at
      `,
      [
        createdUser.id,
        staffInput.fullName,
        staffInput.primaryRole,
        staffInput.contractHours,
        staffInput.phoneNumber,
        staffInput.isActive
      ]
    );

    await client.query('COMMIT');

    return mapStaffRecord({
      ...staffResult.rows[0],
      email: createdUser.email,
      user_is_active: createdUser.is_active,
      user_role: createdUser.role
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateStaff = async (staffId, staffInput) => {
  const existingStaff = await findStaffById(staffId);

  if (!existingStaff) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (
      Object.prototype.hasOwnProperty.call(staffInput, 'email') ||
      Object.prototype.hasOwnProperty.call(staffInput, 'isActive')
    ) {
      await client.query(
        `
          UPDATE users
          SET
            email = COALESCE($1, email),
            is_active = COALESCE($2, is_active),
            session_version = CASE
              WHEN $2::BOOLEAN IS NULL THEN session_version
              ELSE session_version + 1
            END,
            updated_at = NOW()
          WHERE id = $3
        `,
        [
          Object.prototype.hasOwnProperty.call(staffInput, 'email')
            ? staffInput.email
            : null,
          Object.prototype.hasOwnProperty.call(staffInput, 'isActive')
            ? staffInput.isActive
            : null,
          existingStaff.userId
        ]
      );
    }

    await client.query(
      `
        UPDATE staff_profiles
        SET
          full_name = COALESCE($1, full_name),
          primary_role = COALESCE($2, primary_role),
          contract_hours = COALESCE($3, contract_hours),
          phone_number = $4,
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
        WHERE id = $6
      `,
      [
        Object.prototype.hasOwnProperty.call(staffInput, 'fullName')
          ? staffInput.fullName
          : null,
        Object.prototype.hasOwnProperty.call(staffInput, 'primaryRole')
          ? staffInput.primaryRole
          : null,
        Object.prototype.hasOwnProperty.call(staffInput, 'contractHours')
          ? staffInput.contractHours
          : null,
        Object.prototype.hasOwnProperty.call(staffInput, 'phoneNumber')
          ? staffInput.phoneNumber
          : existingStaff.phoneNumber,
        Object.prototype.hasOwnProperty.call(staffInput, 'isActive')
          ? staffInput.isActive
          : null,
        staffId
      ]
    );

    await client.query('COMMIT');

    return findStaffById(staffId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const validateTemporaryPasswordInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      details: ['request body must be a JSON object'],
      temporaryPassword: ''
    };
  }

  const temporaryPassword =
    typeof payload.temporaryPassword === 'string' ? payload.temporaryPassword : '';

  return {
    details: validatePassword(temporaryPassword, 'temporaryPassword'),
    temporaryPassword
  };
};

const resetStaffPassword = async (staffId, temporaryPassword) => {
  const existingStaff = await findStaffById(staffId);

  if (!existingStaff) {
    return null;
  }

  await assertPasswordIsSafe(temporaryPassword);
  const passwordRecord = await createPasswordHash(temporaryPassword);

  await query(
    `
      UPDATE users
      SET
        password_hash = $1,
        password_scheme = $2,
        password_pepper_version = $3,
        must_change_password = TRUE,
        password_changed_at = NOW(),
        session_version = session_version + 1,
        updated_at = NOW()
      WHERE id = $4
    `,
    [
      passwordRecord.passwordHash,
      passwordRecord.passwordScheme,
      passwordRecord.passwordPepperVersion,
      existingStaff.userId
    ]
  );

  return findStaffById(staffId);
};

module.exports = {
  allowedPrimaryRoles,
  buildListFilters,
  createStaff,
  findStaffById,
  listStaff,
  resetStaffPassword,
  updateStaff,
  validateStaffCreateInput,
  validateTemporaryPasswordInput,
  validateStaffUpdateInput
};
