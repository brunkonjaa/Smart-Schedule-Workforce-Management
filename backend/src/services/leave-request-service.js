const { query } = require('../config/db');
const {
  getCurrentIsoDate,
  isPlainObject,
  listUnexpectedFields,
  normalizeText,
  parseIsoDate
} = require('./workflow-service-utils');

const allowedLeaveStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
const allowedLeaveListStatuses = ['ALL', ...allowedLeaveStatuses];
const createFieldNames = ['endDate', 'reason', 'startDate'];
const listFilterFieldNames = ['endDate', 'staffProfileId', 'startDate', 'status'];
const decisionFieldNames = ['managerComment'];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const mapLeaveRequestRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    createdAt: record.created_at,
    decidedAt: record.decided_at,
    decidedByUserId: record.decided_by_user_id,
    endDate: record.end_date,
    fullName: record.full_name || null,
    id: record.id,
    managerComment: record.manager_comment,
    reason: record.reason,
    staffProfileId: record.staff_profile_id,
    startDate: record.start_date,
    status: record.status,
    updatedAt: record.updated_at
  };
};

const validateDateWindow = (startDate, endDate, details) => {
  if (startDate && endDate && endDate < startDate) {
    details.push('endDate must be on or after startDate');
  }
};

const buildLeaveRequestListFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterFieldNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  const startDate = queryParams?.startDate
    ? parseIsoDate(queryParams.startDate)
    : null;
  const endDate = queryParams?.endDate ? parseIsoDate(queryParams.endDate) : null;
  const status = String(queryParams?.status || 'ALL').trim().toUpperCase();
  const staffProfileId = String(queryParams?.staffProfileId || '').trim();

  if (queryParams?.startDate && !startDate) {
    details.push('startDate must be a valid YYYY-MM-DD date');
  }

  if (queryParams?.endDate && !endDate) {
    details.push('endDate must be a valid YYYY-MM-DD date');
  }

  validateDateWindow(startDate, endDate, details);

  if (!allowedLeaveListStatuses.includes(status)) {
    details.push(`status must be one of: ${allowedLeaveListStatuses.join(', ')}`);
  }

  if (staffProfileId && !uuidPattern.test(staffProfileId)) {
    details.push('staffProfileId must be a valid UUID');
  }

  return {
    details,
    filters: {
      endDate,
      staffProfileId: staffProfileId || null,
      startDate,
      status
    }
  };
};

const validateLeaveCreateInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      details: ['request body must be a JSON object'],
      leaveInput: {}
    };
  }

  const details = [];
  const leaveInput = {};
  const unexpectedFields = listUnexpectedFields(payload, createFieldNames);

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  const startDate = parseIsoDate(payload.startDate);
  const endDate = parseIsoDate(payload.endDate);
  const reason = normalizeText(payload.reason);

  if (!startDate) {
    details.push('startDate must be a valid YYYY-MM-DD date');
  } else {
    leaveInput.startDate = startDate;
  }

  if (!endDate) {
    details.push('endDate must be a valid YYYY-MM-DD date');
  } else {
    leaveInput.endDate = endDate;
  }

  validateDateWindow(startDate, endDate, details);

  if (!reason) {
    details.push('reason is required');
  } else if (reason.length < 3) {
    details.push('reason must be at least 3 characters long');
  } else if (reason.length > 500) {
    details.push('reason must be 500 characters or fewer');
  } else {
    leaveInput.reason = reason;
  }

  if (startDate && startDate < getCurrentIsoDate()) {
    details.push('startDate cannot be in the past');
  }

  return {
    details,
    leaveInput
  };
};

const validateLeaveDecisionInput = (payload, requireComment = false) => {
  if (!isPlainObject(payload || {})) {
    return {
      decisionInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const decisionInput = {};
  const unexpectedFields = listUnexpectedFields(payload || {}, decisionFieldNames);

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'managerComment')) {
    const managerComment = normalizeText(payload.managerComment);

    if (!managerComment) {
      details.push('managerComment cannot be empty');
    } else if (managerComment.length > 500) {
      details.push('managerComment must be 500 characters or fewer');
    } else {
      decisionInput.managerComment = managerComment;
    }
  } else if (requireComment) {
    details.push('managerComment is required');
  }

  return {
    decisionInput,
    details
  };
};

const listLeaveRequests = async (authUser, filters) => {
  const values = [];
  const conditions = [];

  if (authUser.role === 'STAFF') {
    values.push(authUser.staffProfileId);
    conditions.push(`leave_requests.staff_profile_id = $${values.length}`);
  } else if (filters.staffProfileId) {
    values.push(filters.staffProfileId);
    conditions.push(`leave_requests.staff_profile_id = $${values.length}`);
  }

  if (filters.startDate) {
    values.push(filters.startDate);
    conditions.push(`leave_requests.end_date >= $${values.length}`);
  }

  if (filters.endDate) {
    values.push(filters.endDate);
    conditions.push(`leave_requests.start_date <= $${values.length}`);
  }

  if (filters.status !== 'ALL') {
    values.push(filters.status);
    conditions.push(`leave_requests.status = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `
      SELECT
        leave_requests.id,
        leave_requests.staff_profile_id,
        leave_requests.start_date::text AS start_date,
        leave_requests.end_date::text AS end_date,
        leave_requests.reason,
        leave_requests.status,
        leave_requests.manager_comment,
        leave_requests.decided_by_user_id,
        leave_requests.decided_at,
        leave_requests.created_at,
        leave_requests.updated_at,
        staff_profiles.full_name
      FROM leave_requests
      INNER JOIN staff_profiles
        ON staff_profiles.id = leave_requests.staff_profile_id
      ${whereClause}
      ORDER BY leave_requests.start_date ASC, leave_requests.created_at ASC
    `,
    values
  );

  return result.rows.map((row) => mapLeaveRequestRecord(row));
};

const findLeaveRequestById = async (leaveRequestId) => {
  const result = await query(
    `
      SELECT
        leave_requests.id,
        leave_requests.staff_profile_id,
        leave_requests.start_date::text AS start_date,
        leave_requests.end_date::text AS end_date,
        leave_requests.reason,
        leave_requests.status,
        leave_requests.manager_comment,
        leave_requests.decided_by_user_id,
        leave_requests.decided_at,
        leave_requests.created_at,
        leave_requests.updated_at,
        staff_profiles.full_name
      FROM leave_requests
      INNER JOIN staff_profiles
        ON staff_profiles.id = leave_requests.staff_profile_id
      WHERE leave_requests.id = $1
      LIMIT 1
    `,
    [leaveRequestId]
  );

  return mapLeaveRequestRecord(result.rows[0]);
};

const findConflictingLeaveRequest = async (staffProfileId, startDate, endDate) => {
  const result = await query(
    `
      SELECT id
      FROM leave_requests
      WHERE staff_profile_id = $1
        AND status IN ('PENDING', 'APPROVED')
        AND start_date <= $3
        AND end_date >= $2
      LIMIT 1
    `,
    [staffProfileId, startDate, endDate]
  );

  return result.rows[0] || null;
};

const createLeaveRequest = async (staffProfileId, leaveInput) => {
  const conflict = await findConflictingLeaveRequest(
    staffProfileId,
    leaveInput.startDate,
    leaveInput.endDate
  );

  if (conflict) {
    throw createConflictError(
      'LEAVE_OVERLAP_CONFLICT',
      'This leave request overlaps an existing pending or approved request.'
    );
  }

  const result = await query(
    `
      INSERT INTO leave_requests (
        staff_profile_id,
        start_date,
        end_date,
        reason,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())
      RETURNING
        id,
        staff_profile_id,
        start_date::text AS start_date,
        end_date::text AS end_date,
        reason,
        status,
        manager_comment,
        decided_by_user_id,
        decided_at,
        created_at,
        updated_at
    `,
    [staffProfileId, leaveInput.startDate, leaveInput.endDate, leaveInput.reason]
  );

  return mapLeaveRequestRecord(result.rows[0]);
};

const decideLeaveRequest = async (
  existingLeaveRequest,
  status,
  managerUserId,
  decisionInput = {}
) => {
  if (existingLeaveRequest.status !== 'PENDING') {
    throw createConflictError(
      'LEAVE_ALREADY_DECIDED',
      'Only pending leave requests can be decided.'
    );
  }

  const result = await query(
    `
      UPDATE leave_requests
      SET
        status = $1,
        manager_comment = $2,
        decided_by_user_id = $3,
        decided_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        staff_profile_id,
        start_date::text AS start_date,
        end_date::text AS end_date,
        reason,
        status,
        manager_comment,
        decided_by_user_id,
        decided_at,
        created_at,
        updated_at
    `,
    [
      status,
      decisionInput.managerComment || null,
      managerUserId,
      existingLeaveRequest.id
    ]
  );

  return mapLeaveRequestRecord(result.rows[0]);
};

const withdrawLeaveRequest = async (existingLeaveRequest) => {
  if (existingLeaveRequest.status !== 'PENDING') {
    throw createConflictError(
      'LEAVE_ALREADY_DECIDED',
      'Only pending leave requests can be withdrawn.'
    );
  }

  if (existingLeaveRequest.startDate < getCurrentIsoDate()) {
    throw createConflictError(
      'LEAVE_LOCKED',
      'Only current or future pending leave requests can be withdrawn.'
    );
  }

  await query('DELETE FROM leave_requests WHERE id = $1', [existingLeaveRequest.id]);
};

module.exports = {
  allowedLeaveListStatuses,
  allowedLeaveStatuses,
  buildLeaveRequestListFilters,
  createLeaveRequest,
  decideLeaveRequest,
  findLeaveRequestById,
  listLeaveRequests,
  validateLeaveCreateInput,
  validateLeaveDecisionInput,
  withdrawLeaveRequest
};
