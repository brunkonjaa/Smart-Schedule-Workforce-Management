const { query } = require('../config/db');
const { createAuditLog } = require('./audit-log-service');
const {
  allowedWorkRoles,
  compareTimes,
  getCurrentIsoDate,
  isMondayDate,
  isPlainObject,
  listUnexpectedFields,
  normalizeText,
  parseIsoDate,
  parseTimeValue
} = require('./workflow-service-utils');

const allowedShiftStatuses = ['DRAFT', 'OPEN', 'CANCELLED'];
const allowedShiftListStatuses = ['ALL', ...allowedShiftStatuses];
const createFieldNames = ['endTime', 'notes', 'requiredRole', 'shiftDate', 'startTime', 'status'];
const listFilterFieldNames = ['requiredRole', 'status', 'weekStart'];

const mapShiftRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    createdAt: record.created_at,
    endTime: record.end_time,
    id: record.id,
    notes: record.notes,
    requiredRole: record.required_role,
    shiftDate: record.shift_date,
    startTime: record.start_time,
    status: record.status,
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

const buildShiftListFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterFieldNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  const weekStart = validateWeekStart(queryParams?.weekStart, details);
  const requiredRole = String(queryParams?.requiredRole || '').trim().toUpperCase();
  const status = String(queryParams?.status || 'ALL').trim().toUpperCase();

  if (requiredRole && !allowedWorkRoles.includes(requiredRole)) {
    details.push(`requiredRole must be one of: ${allowedWorkRoles.join(', ')}`);
  }

  if (!allowedShiftListStatuses.includes(status)) {
    details.push(`status must be one of: ${allowedShiftListStatuses.join(', ')}`);
  }

  return {
    details,
    filters: {
      requiredRole: requiredRole || null,
      status,
      weekStart
    }
  };
};

const validateShiftInput = (payload, requireAllFields = true) => {
  if (!isPlainObject(payload)) {
    return {
      details: ['request body must be a JSON object'],
      shiftInput: {}
    };
  }

  const details = [];
  const shiftInput = {};
  const unexpectedFields = listUnexpectedFields(payload, createFieldNames);

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  const shouldValidateField = (fieldName) => {
    return requireAllFields || Object.prototype.hasOwnProperty.call(payload, fieldName);
  };

  if (shouldValidateField('shiftDate')) {
    const shiftDate = parseIsoDate(payload.shiftDate);

    if (!shiftDate) {
      details.push('shiftDate must be a valid YYYY-MM-DD date');
    } else if (shiftDate < getCurrentIsoDate()) {
      details.push('shiftDate cannot be in the past');
    } else {
      shiftInput.shiftDate = shiftDate;
    }
  }

  if (shouldValidateField('startTime')) {
    const startTime = parseTimeValue(payload.startTime);

    if (!startTime) {
      details.push('startTime must be a valid HH:MM time');
    } else {
      shiftInput.startTime = startTime;
    }
  }

  if (shouldValidateField('endTime')) {
    const endTime = parseTimeValue(payload.endTime);

    if (!endTime) {
      details.push('endTime must be a valid HH:MM time');
    } else {
      shiftInput.endTime = endTime;
    }
  }

  if (shouldValidateField('requiredRole')) {
    const requiredRole = String(payload.requiredRole || '').trim().toUpperCase();

    if (!allowedWorkRoles.includes(requiredRole)) {
      details.push(`requiredRole must be one of: ${allowedWorkRoles.join(', ')}`);
    } else {
      shiftInput.requiredRole = requiredRole;
    }
  }

  if (shouldValidateField('status')) {
    const status = String(payload.status || 'OPEN').trim().toUpperCase();

    if (!allowedShiftStatuses.includes(status)) {
      details.push(`status must be one of: ${allowedShiftStatuses.join(', ')}`);
    } else {
      shiftInput.status = status;
    }
  } else if (requireAllFields) {
    shiftInput.status = 'OPEN';
  }

  if (shouldValidateField('notes')) {
    const notes = normalizeText(payload.notes);

    if (notes && notes.length > 500) {
      details.push('notes must be 500 characters or fewer');
    } else {
      shiftInput.notes = notes || null;
    }
  } else if (requireAllFields) {
    shiftInput.notes = null;
  }

  const startTime = shiftInput.startTime;
  const endTime = shiftInput.endTime;

  if (startTime && endTime && compareTimes(endTime, startTime) === 0) {
    details.push('endTime must not equal startTime');
  }

  if (!requireAllFields && Object.keys(shiftInput).length === 0 && details.length === 0) {
    details.push('at least one shift field must be provided');
  }

  return {
    details,
    shiftInput
  };
};

const listShifts = async (filters) => {
  const weekStartDate = new Date(`${filters.weekStart}T00:00:00Z`);
  const weekEndDate = new Date(weekStartDate.getTime());
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

  const weekEnd = weekEndDate.toISOString().slice(0, 10);
  const values = [filters.weekStart, weekEnd];
  const conditions = ['shift_date BETWEEN $1 AND $2'];

  if (filters.requiredRole) {
    values.push(filters.requiredRole);
    conditions.push(`required_role = $${values.length}`);
  }

  if (filters.status !== 'ALL') {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        id,
        shift_date::text AS shift_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        required_role,
        status,
        notes,
        created_at,
        updated_at
      FROM shifts
      WHERE ${conditions.join(' AND ')}
      ORDER BY shift_date ASC, start_time ASC
    `,
    values
  );

  return result.rows.map((row) => mapShiftRecord(row));
};

const findShiftById = async (shiftId) => {
  const result = await query(
    `
      SELECT
        id,
        shift_date::text AS shift_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        required_role,
        status,
        notes,
        created_at,
        updated_at
      FROM shifts
      WHERE id = $1
      LIMIT 1
    `,
    [shiftId]
  );

  return mapShiftRecord(result.rows[0]);
};

const createShift = async (shiftInput, actorUserId) => {
  const result = await query(
    `
      INSERT INTO shifts (
        shift_date,
        start_time,
        end_time,
        required_role,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2::time, $3::time, $4, $5, $6, NOW(), NOW())
      RETURNING
        id,
        shift_date::text AS shift_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        required_role,
        status,
        notes,
        created_at,
        updated_at
    `,
    [
      shiftInput.shiftDate,
      shiftInput.startTime,
      shiftInput.endTime,
      shiftInput.requiredRole,
      shiftInput.status,
      shiftInput.notes
    ]
  );

  const shift = mapShiftRecord(result.rows[0]);

  await createAuditLog({
    action: 'SHIFT_CREATED',
    actorUserId,
    afterState: shift,
    beforeState: null,
    entityId: shift.id,
    entityType: 'SHIFT',
    summary: `Created ${shift.requiredRole} shift ${shift.id} for ${shift.shiftDate}.`
  });

  return shift;
};

const updateShift = async (existingShift, shiftInput, actorUserId) => {
  if (existingShift.shiftDate < getCurrentIsoDate()) {
    const error = new Error('Only current or future shifts can be changed.');
    error.code = 'SHIFT_LOCKED';
    throw error;
  }

  const mergedShift = {
    endTime: shiftInput.endTime || existingShift.endTime,
    notes:
      Object.prototype.hasOwnProperty.call(shiftInput, 'notes')
        ? shiftInput.notes
        : existingShift.notes,
    requiredRole: shiftInput.requiredRole || existingShift.requiredRole,
    shiftDate: shiftInput.shiftDate || existingShift.shiftDate,
    startTime: shiftInput.startTime || existingShift.startTime,
    status: shiftInput.status || existingShift.status
  };

  if (compareTimes(mergedShift.endTime, mergedShift.startTime) <= 0) {
    const error = new Error('Shift endTime must be after startTime.');
    error.code = 'SHIFT_TIME_CONFLICT';
    throw error;
  }

  const result = await query(
    `
      UPDATE shifts
      SET
        shift_date = $1,
        start_time = $2::time,
        end_time = $3::time,
        required_role = $4,
        status = $5,
        notes = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        shift_date::text AS shift_date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        required_role,
        status,
        notes,
        created_at,
        updated_at
    `,
    [
      mergedShift.shiftDate,
      mergedShift.startTime,
      mergedShift.endTime,
      mergedShift.requiredRole,
      mergedShift.status,
      mergedShift.notes,
      existingShift.id
    ]
  );

  const shift = mapShiftRecord(result.rows[0]);

  await createAuditLog({
    action: 'SHIFT_UPDATED',
    actorUserId,
    afterState: shift,
    beforeState: existingShift,
    entityId: shift.id,
    entityType: 'SHIFT',
    summary: `Updated ${shift.requiredRole} shift ${shift.id} for ${shift.shiftDate}.`
  });

  return shift;
};

const deleteShift = async (existingShift, actorUserId) => {
  if (existingShift.shiftDate < getCurrentIsoDate()) {
    const error = new Error('Only current or future shifts can be changed.');
    error.code = 'SHIFT_LOCKED';
    throw error;
  }

  await query('DELETE FROM shifts WHERE id = $1', [existingShift.id]);
  await createAuditLog({
    action: 'SHIFT_DELETED',
    actorUserId,
    afterState: null,
    beforeState: existingShift,
    entityId: existingShift.id,
    entityType: 'SHIFT',
    summary: `Deleted ${existingShift.requiredRole} shift ${existingShift.id} for ${existingShift.shiftDate}.`
  });
};

module.exports = {
  allowedShiftListStatuses,
  allowedShiftStatuses,
  buildShiftListFilters,
  createShift,
  deleteShift,
  findShiftById,
  listShifts,
  updateShift,
  validateShiftInput
};
