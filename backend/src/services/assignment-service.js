const { query } = require('../config/db');
const {
  isPlainObject,
  listUnexpectedFields
} = require('./workflow-service-utils');

const assignmentFieldNames = ['shiftId', 'staffProfileId'];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const mapAssignmentRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    assignedAt: record.assigned_at,
    assignedByUserId: record.assigned_by_user_id,
    createdAt: record.created_at,
    endTime: record.end_time || null,
    fullName: record.full_name || null,
    id: record.id,
    requiredRole: record.required_role || null,
    shiftDate: record.shift_date || null,
    shiftId: record.shift_id,
    staffProfileId: record.staff_profile_id,
    startTime: record.start_time || null,
    updatedAt: record.updated_at
  };
};

const validateAssignmentInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      assignmentInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const unexpectedFields = listUnexpectedFields(payload, assignmentFieldNames);
  const shiftId = String(payload.shiftId || '').trim();
  const staffProfileId = String(payload.staffProfileId || '').trim();

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  if (!uuidPattern.test(shiftId)) {
    details.push('shiftId must be a valid UUID');
  }

  if (!uuidPattern.test(staffProfileId)) {
    details.push('staffProfileId must be a valid UUID');
  }

  return {
    assignmentInput: {
      shiftId,
      staffProfileId
    },
    details
  };
};

const findShiftForAssignment = async (shiftId) => {
  const result = await query(
    `
      SELECT id
      FROM shifts
      WHERE id = $1
      LIMIT 1
    `,
    [shiftId]
  );

  return result.rows[0] || null;
};

const findStaffProfileForAssignment = async (staffProfileId) => {
  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.is_active,
        users.is_active AS user_is_active
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE staff_profiles.id = $1
      LIMIT 1
    `,
    [staffProfileId]
  );

  return result.rows[0] || null;
};

const findAssignmentByShiftId = async (shiftId) => {
  const result = await query(
    `
      SELECT id
      FROM shift_assignments
      WHERE shift_id = $1
      LIMIT 1
    `,
    [shiftId]
  );

  return result.rows[0] || null;
};

const insertAssignment = async (assignmentInput, assignedByUserId) => {
  const result = await query(
    `
      INSERT INTO shift_assignments (
        shift_id,
        staff_profile_id,
        assigned_by_user_id,
        assigned_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW(), NOW())
      RETURNING
        id,
        shift_id,
        staff_profile_id,
        assigned_by_user_id,
        assigned_at,
        created_at,
        updated_at
    `,
    [
      assignmentInput.shiftId,
      assignmentInput.staffProfileId,
      assignedByUserId
    ]
  );

  return mapAssignmentRecord(result.rows[0]);
};

const findAssignmentById = async (assignmentId) => {
  const result = await query(
    `
      SELECT
        shift_assignments.id,
        shift_assignments.shift_id,
        shift_assignments.staff_profile_id,
        shift_assignments.assigned_by_user_id,
        shift_assignments.assigned_at,
        shift_assignments.created_at,
        shift_assignments.updated_at,
        shifts.shift_date::text AS shift_date,
        shifts.start_time::text AS start_time,
        shifts.end_time::text AS end_time,
        shifts.required_role,
        staff_profiles.full_name
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      INNER JOIN staff_profiles
        ON staff_profiles.id = shift_assignments.staff_profile_id
      WHERE shift_assignments.id = $1
      LIMIT 1
    `,
    [assignmentId]
  );

  return mapAssignmentRecord(result.rows[0]);
};

const createAssignment = async (assignmentInput, assignedByUserId) => {
  const shift = await findShiftForAssignment(assignmentInput.shiftId);

  if (!shift) {
    return {
      assignment: null,
      missingResource: 'shift'
    };
  }

  const staffProfile = await findStaffProfileForAssignment(
    assignmentInput.staffProfileId
  );

  if (!staffProfile) {
    return {
      assignment: null,
      missingResource: 'staff'
    };
  }

  const existingAssignment = await findAssignmentByShiftId(assignmentInput.shiftId);

  if (existingAssignment) {
    throw createConflictError(
      'SHIFT_ALREADY_ASSIGNED',
      'This shift already has an assignment.'
    );
  }

  const insertedAssignment = await insertAssignment(
    assignmentInput,
    assignedByUserId
  );
  const assignment = await findAssignmentById(insertedAssignment.id);

  return {
    assignment,
    missingResource: null
  };
};

module.exports = {
  createAssignment,
  validateAssignmentInput
};
