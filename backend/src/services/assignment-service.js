const { query, withTransaction } = require('../config/db');
const { createAuditLog } = require('./audit-log-service');
const {
  isPlainObject,
  getCurrentIsoDate,
  isMondayDate,
  listUnexpectedFields,
  parseIsoDate
} = require('./workflow-service-utils');

const assignmentFieldNames = ['shiftId', 'staffProfileId'];
const assignmentUpdateFieldNames = ['staffProfileId'];
const listFilterFieldNames = ['weekStart'];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assignmentTransactionRetries = 2;
const maxWeeklyAssignedShifts = 5;
const maxWeeklyHours = 40;

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const executeQuery = (client, text, params) => {
  if (client) {
    return client.query(text, params);
  }

  return query(text, params);
};

const withAssignmentTransaction = async (handler) => {
  let lastError = null;

  for (let attempt = 0; attempt < assignmentTransactionRetries; attempt += 1) {
    try {
      return await withTransaction(
        (client) => handler(client),
        { isolationLevel: 'SERIALIZABLE' }
      );
    } catch (error) {
      if (error.code === '40001') {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw createConflictError(
    'ASSIGNMENT_CONCURRENT_MODIFICATION',
    lastError?.message ||
      'The assignment changed while this request was running. Please retry.'
  );
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

const roundHours = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const getShiftHours = (shift) => {
  const start = new Date(`1970-01-01T${shift.start_time}Z`);
  const end = new Date(`1970-01-01T${shift.end_time}Z`);

  return roundHours((end.getTime() - start.getTime()) / (1000 * 60 * 60));
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

const validateAssignmentUpdateInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      assignmentInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const unexpectedFields = listUnexpectedFields(payload, assignmentUpdateFieldNames);
  const staffProfileId = String(payload.staffProfileId || '').trim();

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  if (!uuidPattern.test(staffProfileId)) {
    details.push('staffProfileId must be a valid UUID');
  }

  return {
    assignmentInput: {
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

const findShiftForAssignment = async (shiftId, client = null, options = {}) => {
  const result = await executeQuery(
    client,
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
      ${options.forUpdate ? 'FOR UPDATE' : ''}
    `,
    [shiftId]
  );

  return result.rows[0] || null;
};

const findStaffProfileForAssignment = async (staffProfileId, client = null) => {
  const result = await executeQuery(
    client,
    `
      SELECT
        staff_profiles.id,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours,
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

const lockStaffAssignmentWindow = async (staffProfileId, client) => {
  // Serialize weekly assignment checks for one staff member. SERIALIZABLE retries
  // remain enabled, but this lock stops two different shifts for the same person
  // passing the weekly hours/count check at the same time.
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [staffProfileId]
  );
};

const findAssignmentByShiftId = async (shiftId, client = null, options = {}) => {
  const result = await executeQuery(
    client,
    `
      SELECT id
      FROM shift_assignments
      WHERE shift_id = $1
      LIMIT 1
      ${options.forUpdate ? 'FOR UPDATE' : ''}
    `,
    [shiftId]
  );

  return result.rows[0] || null;
};

const findApprovedLeaveForShift = async (staffProfileId, shiftDate, client = null) => {
  const result = await executeQuery(
    client,
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

const findSameDayTimeConflictAssignment = async (
  staffProfileId,
  shift,
  client = null
) => {
  const result = await executeQuery(
    client,
    `
      SELECT shift_assignments.id
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      WHERE shift_assignments.staff_profile_id = $1
        AND shifts.shift_date = $2::date
        AND shifts.start_time <= $3::time
        AND shifts.end_time >= $4::time
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

const buildContractHoursWarnings = async (staffProfile, shift, client = null) => {
  const weeklyHours = await getWeeklyHoursSummary(staffProfile, shift, client);

  return buildContractHoursWarningsFromSummary(staffProfile, weeklyHours);
};

const getAssignmentTotalsForWeek = async (
  staffProfileId,
  weekStart,
  { client = null, excludeShiftId = null } = {}
) => {
  const weekStartDate = new Date(`${weekStart}T00:00:00Z`);
  const weekEndDate = new Date(weekStartDate.getTime());
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const result = await executeQuery(
    client,
    `
      SELECT COALESCE(
        SUM(EXTRACT(EPOCH FROM (shifts.end_time - shifts.start_time)) / 3600),
        0
      ) AS assigned_hours,
      COUNT(*)::int AS assigned_shift_count
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      WHERE shift_assignments.staff_profile_id = $1
        AND shifts.shift_date BETWEEN $2::date AND $3::date
        AND shifts.status <> 'CANCELLED'
        AND ($4::uuid IS NULL OR shifts.id <> $4::uuid)
    `,
    [staffProfileId, weekStart, weekEnd, excludeShiftId]
  );

  return {
    assignedHours: roundHours(result.rows[0]?.assigned_hours),
    assignedShiftCount: Number(result.rows[0]?.assigned_shift_count || 0),
    weekEnd,
    weekStart
  };
};

const getWeeklyHoursSummary = async (staffProfile, shift, client = null) => {
  const { weekStart } = getDateDetails(shift.shift_date);
  const totals = await getAssignmentTotalsForWeek(staffProfile.id, weekStart, {
    client,
    excludeShiftId: shift.id
  });

  const assignedHoursBefore = totals.assignedHours;
  const assignedShiftCountBefore = totals.assignedShiftCount;
  const shiftHours = getShiftHours(shift);
  const projectedHours = roundHours(assignedHoursBefore + shiftHours);
  const contractHours = roundHours(staffProfile.contract_hours);

  return {
    assignedHoursBefore,
    assignedShiftCountBefore,
    contractHours,
    projectedHours,
    projectedShiftCount: assignedShiftCountBefore + 1,
    shiftHours,
    weekStart
  };
};

const getWeeklyScheduleLimitConflict = (weeklyHours) => {
  if (weeklyHours.projectedShiftCount > maxWeeklyAssignedShifts) {
    return {
      code: 'ASSIGNMENT_WEEKLY_SHIFT_LIMIT',
      message: `This staff member would go over ${maxWeeklyAssignedShifts} shifts for the week.`
    };
  }

  if (weeklyHours.projectedHours > maxWeeklyHours) {
    return {
      code: 'ASSIGNMENT_WEEKLY_HOURS_LIMIT',
      message: `This staff member would go over ${maxWeeklyHours} hours for the week.`
    };
  }

  return null;
};

const buildContractHoursWarningsFromSummary = (staffProfile, weeklyHours) => {
  if (weeklyHours.projectedHours <= weeklyHours.contractHours) {
    return [];
  }

  return [
    {
      assignedHoursBefore: weeklyHours.assignedHoursBefore,
      code: 'CONTRACT_HOURS_EXCEEDED',
      contractHours: weeklyHours.contractHours,
      message: `${staffProfile.full_name} would be assigned ${weeklyHours.projectedHours} hours this week, which is ${roundHours(weeklyHours.projectedHours - weeklyHours.contractHours)} hours over their contract.`,
      overByHours: roundHours(weeklyHours.projectedHours - weeklyHours.contractHours),
      projectedHours: weeklyHours.projectedHours,
      shiftHours: weeklyHours.shiftHours,
      weekStart: weeklyHours.weekStart
    }
  ];
};

const getAssignmentConflict = async (
  assignmentInput,
  shift,
  staffProfile,
  client = null
) => {
  if (shift.status !== 'OPEN') {
    return {
      code: 'SHIFT_NOT_OPEN',
      message: 'Only open shifts can be assigned.'
    };
  }

  if (!staffProfile.is_active || !staffProfile.user_is_active) {
    return {
      code: 'STAFF_NOT_ACTIVE',
      message: 'Only active staff can be assigned to shifts.'
    };
  }

  if (staffProfile.primary_role !== shift.required_role) {
    return {
      code: 'ASSIGNMENT_ROLE_CONFLICT',
      message: 'This staff member role does not match the shift role.'
    };
  }

  const approvedLeave = await findApprovedLeaveForShift(
    assignmentInput.staffProfileId,
    shift.shift_date,
    client
  );

  if (approvedLeave) {
    return {
      code: 'ASSIGNMENT_LEAVE_CONFLICT',
      message: 'This staff member has approved leave on this shift date.'
    };
  }

  const sameDayTimeConflict = await findSameDayTimeConflictAssignment(
    assignmentInput.staffProfileId,
    shift,
    client
  );

  if (sameDayTimeConflict) {
    return {
      code: 'ASSIGNMENT_OVERLAP_CONFLICT',
      message: 'This staff member already has a shift that overlaps or touches this shift time.'
    };
  }

  return null;
};

const evaluateAssignmentEligibility = async (
  assignmentInput,
  shift,
  staffProfile,
  client = null
) => {
  const exclusionReason = await getAssignmentConflict(
    assignmentInput,
    shift,
    staffProfile,
    client
  );

  if (exclusionReason) {
    return {
      eligible: false,
      exclusionReason,
      warnings: [],
      weeklyHours: null
    };
  }

  const weeklyHours = await getWeeklyHoursSummary(staffProfile, shift, client);
  const scheduleLimitConflict = getWeeklyScheduleLimitConflict(weeklyHours);

  if (scheduleLimitConflict) {
    return {
      eligible: false,
      exclusionReason: scheduleLimitConflict,
      warnings: [],
      weeklyHours
    };
  }

  return {
    eligible: true,
    exclusionReason: null,
    warnings: buildContractHoursWarningsFromSummary(staffProfile, weeklyHours),
    weeklyHours
  };
};

const assertNoAssignmentConflicts = async (
  assignmentInput,
  shift,
  staffProfile,
  client = null
) => {
  const conflict = await getAssignmentConflict(
    assignmentInput,
    shift,
    staffProfile,
    client
  );

  if (conflict) {
    throw createConflictError(conflict.code, conflict.message);
  }

  const weeklyHours = await getWeeklyHoursSummary(staffProfile, shift, client);
  const scheduleLimitConflict = getWeeklyScheduleLimitConflict(weeklyHours);

  if (scheduleLimitConflict) {
    throw createConflictError(
      scheduleLimitConflict.code,
      scheduleLimitConflict.message
    );
  }

  return weeklyHours;
};

const insertAssignment = async (assignmentInput, assignedByUserId, client = null) => {
  const result = await executeQuery(
    client,
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

const findAssignmentById = async (assignmentId, client = null, options = {}) => {
  const result = await executeQuery(
    client,
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
      ${options.forUpdate ? 'FOR UPDATE OF shift_assignments' : ''}
    `,
    [assignmentId]
  );

  return mapAssignmentRecord(result.rows[0]);
};

const assertAssignmentCanBeChanged = (assignment) => {
  if (assignment.shiftDate < getCurrentIsoDate()) {
    const error = new Error('Only current or future assignments can be changed.');
    error.code = 'ASSIGNMENT_LOCKED';
    throw error;
  }
};

const createAssignment = async (assignmentInput, assignedByUserId) => {
  try {
    return await withAssignmentTransaction(async (client) => {
      const shift = await findShiftForAssignment(
        assignmentInput.shiftId,
        client,
        { forUpdate: true }
      );

      if (!shift) {
        return {
          assignment: null,
          missingResource: 'shift'
        };
      }

      const staffProfile = await findStaffProfileForAssignment(
        assignmentInput.staffProfileId,
        client
      );

      if (!staffProfile) {
        return {
          assignment: null,
          missingResource: 'staff'
        };
      }

      await lockStaffAssignmentWindow(assignmentInput.staffProfileId, client);

      const existingAssignment = await findAssignmentByShiftId(
        assignmentInput.shiftId,
        client,
        { forUpdate: true }
      );

      if (existingAssignment) {
        throw createConflictError(
          'SHIFT_ALREADY_ASSIGNED',
          'This shift already has an assignment.'
        );
      }

      const weeklyHours = await assertNoAssignmentConflicts(
        assignmentInput,
        shift,
        staffProfile,
        client
      );

      const warnings = buildContractHoursWarningsFromSummary(staffProfile, weeklyHours);
      const insertedAssignment = await insertAssignment(
        assignmentInput,
        assignedByUserId,
        client
      );
      const assignment = await findAssignmentById(insertedAssignment.id, client);

      await createAuditLog({
        action: 'ASSIGNMENT_CREATED',
        actorUserId: assignedByUserId,
        afterState: assignment,
        beforeState: null,
        client,
        entityId: assignment.id,
        entityType: 'ASSIGNMENT',
        summary: `Assigned staff profile ${assignment.staffProfileId} to shift ${assignment.shiftId}.`
      });

      return {
        assignment,
        missingResource: null,
        warnings
      };
    });
  } catch (error) {
    if (error.code === '23505') {
      throw createConflictError(
        'SHIFT_ALREADY_ASSIGNED',
        'This shift already has an assignment.'
      );
    }

    throw error;
  }
};

const updateAssignment = async (assignmentId, assignmentInput, assignedByUserId) => {
  return withAssignmentTransaction(async (client) => {
    const existingAssignment = await findAssignmentById(
      assignmentId,
      client,
      { forUpdate: true }
    );

    if (!existingAssignment) {
      return {
        assignment: null,
        missingResource: 'assignment'
      };
    }

    assertAssignmentCanBeChanged(existingAssignment);

    const shift = await findShiftForAssignment(
      existingAssignment.shiftId,
      client,
      { forUpdate: true }
    );
    const staffProfile = await findStaffProfileForAssignment(
      assignmentInput.staffProfileId,
      client
    );

    if (!staffProfile) {
      return {
        assignment: null,
        missingResource: 'staff'
      };
    }

    await lockStaffAssignmentWindow(assignmentInput.staffProfileId, client);

    const weeklyHours = await assertNoAssignmentConflicts(
      {
        shiftId: existingAssignment.shiftId,
        staffProfileId: assignmentInput.staffProfileId
      },
      shift,
      staffProfile,
      client
    );

    const warnings = buildContractHoursWarningsFromSummary(staffProfile, weeklyHours);

    await executeQuery(
      client,
      `
        UPDATE shift_assignments
        SET
          staff_profile_id = $1,
          assigned_by_user_id = $2,
          assigned_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
      `,
      [assignmentInput.staffProfileId, assignedByUserId, assignmentId]
    );

    const assignment = await findAssignmentById(assignmentId, client);

    await createAuditLog({
      action: 'ASSIGNMENT_UPDATED',
      actorUserId: assignedByUserId,
      afterState: assignment,
      beforeState: existingAssignment,
      client,
      entityId: assignment.id,
      entityType: 'ASSIGNMENT',
      summary: `Changed assignment ${assignment.id} to staff profile ${assignment.staffProfileId}.`
    });

    return {
      assignment,
      missingResource: null,
      warnings
    };
  });
};

const deleteAssignment = async (assignmentId, actorUserId) => {
  return withAssignmentTransaction(async (client) => {
    const existingAssignment = await findAssignmentById(
      assignmentId,
      client,
      { forUpdate: true }
    );

    if (!existingAssignment) {
      return false;
    }

    assertAssignmentCanBeChanged(existingAssignment);

    await executeQuery(client, 'DELETE FROM shift_assignments WHERE id = $1', [
      assignmentId
    ]);
    await createAuditLog({
      action: 'ASSIGNMENT_DELETED',
      actorUserId,
      afterState: null,
      beforeState: existingAssignment,
      client,
      entityId: existingAssignment.id,
      entityType: 'ASSIGNMENT',
      summary: `Removed assignment ${existingAssignment.id} from shift ${existingAssignment.shiftId}.`
    });
    return true;
  });
};

module.exports = {
  buildAssignmentListFilters,
  createAssignment,
  deleteAssignment,
  evaluateAssignmentEligibility,
  findAssignmentById,
  findAssignmentByShiftId,
  findShiftForAssignment,
  findStaffProfileForAssignment,
  getAssignmentTotalsForWeek,
  getDateDetails,
  getShiftHours,
  getWeeklyHoursSummary,
  listAssignments,
  roundHours,
  updateAssignment,
  validateAssignmentInput,
  validateAssignmentUpdateInput
};
