const { query } = require('../config/db');
const {
  isPlainObject,
  isMondayDate,
  listUnexpectedFields,
  parseIsoDate
} = require('./workflow-service-utils');

const assignmentFieldNames = ['shiftId', 'staffProfileId'];
const listFilterFieldNames = ['weekStart'];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const getDateDetails = (dateText) => {
  const date = new Date(`${dateText}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay() || 7;
  const weekStartDate = new Date(date.getTime());
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - (dayOfWeek - 1));

  return {
    dayOfWeek,
    weekStart: weekStartDate.toISOString().slice(0, 10)
  };
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

const validateWeekStart = (value, details, fieldName = 'weekStart') => {
  const parsedDate = parseIsoDate(value);

  if (!parsedDate) {
    details.push(`${fieldName} must be a valid YYYY-MM-DD date`);
    return null;
  }

  if (!isMondayDate(parsedDate)) {
    details.push(`${fieldName} must be a Monday date`);
    return null;
  }

  return parsedDate;
};

const buildAssignmentListFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterFieldNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  return {
    details,
    filters: {
      weekStart: validateWeekStart(queryParams?.weekStart, details)
    }
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

const listAssignments = async (filters) => {
  const weekStartDate = new Date(`${filters.weekStart}T00:00:00Z`);
  const weekEndDate = new Date(weekStartDate.getTime());
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

  const weekEnd = weekEndDate.toISOString().slice(0, 10);

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
      WHERE shifts.shift_date BETWEEN $1 AND $2
      ORDER BY shifts.shift_date ASC, shifts.start_time ASC
    `,
    [filters.weekStart, weekEnd]
  );

  return result.rows.map((row) => mapAssignmentRecord(row));
};

const findShiftForAssignment = async (shiftId) => {
  const result = await query(
    `
      SELECT
        id,
        shift_date::text AS shift_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        required_role,
        status
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
        staff_profiles.full_name,
        staff_profiles.primary_role,
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

const findApprovedLeaveForShift = async (staffProfileId, shiftDate) => {
  const result = await query(
    `
      SELECT id
      FROM leave_requests
      WHERE staff_profile_id = $1
        AND status = 'APPROVED'
        AND start_date <= $2::date
        AND end_date >= $2::date
      LIMIT 1
    `,
    [staffProfileId, shiftDate]
  );

  return result.rows[0] || null;
};

const findOverlappingAssignment = async (staffProfileId, shift) => {
  const result = await query(
    `
      SELECT shift_assignments.id
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      WHERE shift_assignments.staff_profile_id = $1
        AND shifts.shift_date = $2::date
        AND shifts.start_time < $3::time
        AND shifts.end_time > $4::time
        AND shifts.id <> $5
      LIMIT 1
    `,
    [
      staffProfileId,
      shift.shift_date,
      shift.end_time,
      shift.start_time,
      shift.id
    ]
  );

  return result.rows[0] || null;
};

const findUnavailableWindowForShift = async (staffProfileId, shift) => {
  const { dayOfWeek, weekStart } = getDateDetails(shift.shift_date);
  const result = await query(
    `
      SELECT id
      FROM availability_entries
      WHERE staff_profile_id = $1
        AND week_start = $2::date
        AND day_of_week = $3
        AND status = 'UNAVAILABLE'
        AND start_time < $4::time
        AND end_time > $5::time
      LIMIT 1
    `,
    [
      staffProfileId,
      weekStart,
      dayOfWeek,
      shift.end_time,
      shift.start_time
    ]
  );

  return result.rows[0] || null;
};

const findAvailableWindowForShift = async (staffProfileId, shift) => {
  const { dayOfWeek, weekStart } = getDateDetails(shift.shift_date);
  const result = await query(
    `
      SELECT id
      FROM availability_entries
      WHERE staff_profile_id = $1
        AND week_start = $2::date
        AND day_of_week = $3
        AND status = 'AVAILABLE'
        AND start_time <= $4::time
        AND end_time >= $5::time
      LIMIT 1
    `,
    [
      staffProfileId,
      weekStart,
      dayOfWeek,
      shift.start_time,
      shift.end_time
    ]
  );

  return result.rows[0] || null;
};

const assertNoAssignmentConflicts = async (assignmentInput, shift, staffProfile) => {
  if (shift.status !== 'OPEN') {
    throw createConflictError(
      'SHIFT_NOT_OPEN',
      'Only open shifts can be assigned.'
    );
  }

  if (!staffProfile.is_active || !staffProfile.user_is_active) {
    throw createConflictError(
      'STAFF_NOT_ACTIVE',
      'Only active staff can be assigned to shifts.'
    );
  }

  if (staffProfile.primary_role !== shift.required_role) {
    throw createConflictError(
      'ASSIGNMENT_ROLE_CONFLICT',
      'This staff member role does not match the shift role.'
    );
  }

  const approvedLeave = await findApprovedLeaveForShift(
    assignmentInput.staffProfileId,
    shift.shift_date
  );

  if (approvedLeave) {
    throw createConflictError(
      'ASSIGNMENT_LEAVE_CONFLICT',
      'This staff member has approved leave on this shift date.'
    );
  }

  const overlappingAssignment = await findOverlappingAssignment(
    assignmentInput.staffProfileId,
    shift
  );

  if (overlappingAssignment) {
    throw createConflictError(
      'ASSIGNMENT_OVERLAP_CONFLICT',
      'This staff member already has an overlapping shift assignment.'
    );
  }

  const unavailableWindow = await findUnavailableWindowForShift(
    assignmentInput.staffProfileId,
    shift
  );

  if (unavailableWindow) {
    throw createConflictError(
      'ASSIGNMENT_AVAILABILITY_CONFLICT',
      'This staff member is marked unavailable for this shift time.'
    );
  }

  const availableWindow = await findAvailableWindowForShift(
    assignmentInput.staffProfileId,
    shift
  );

  if (!availableWindow) {
    throw createConflictError(
      'ASSIGNMENT_AVAILABILITY_CONFLICT',
      'This staff member does not have availability covering this shift time.'
    );
  }
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

  await assertNoAssignmentConflicts(assignmentInput, shift, staffProfile);

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
  buildAssignmentListFilters,
  createAssignment,
  listAssignments,
  validateAssignmentInput
};
