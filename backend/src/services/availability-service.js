const { pool, query } = require('../config/db');
const {
  compareTimes,
  getCurrentWeekStart,
  isMondayDate,
  isPlainObject,
  listUnexpectedFields,
  parseIsoDate,
  parseTimeValue
} = require('./workflow-service-utils');

const allowedAvailabilityStatuses = ['AVAILABLE', 'UNAVAILABLE'];
const allowedAvailabilityListStatuses = ['ALL', ...allowedAvailabilityStatuses];
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createFieldNames = ['entries', 'weekStart'];
const entryFieldNames = ['dayOfWeek', 'endTime', 'startTime', 'status'];
const listFilterFieldNames = ['staffProfileId', 'status', 'weekStart'];
const updateFieldNames = ['dayOfWeek', 'endTime', 'startTime', 'status', 'weekStart'];

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const mapAvailabilityRecord = (record) => {
  if (!record) {
    return null;
  }

  return {
    createdAt: record.created_at,
    dayOfWeek: Number(record.day_of_week),
    email: record.email || null,
    endTime: record.end_time,
    fullName: record.full_name || null,
    id: record.id,
    staffProfileId: record.staff_profile_id,
    startTime: record.start_time,
    status: record.status,
    updatedAt: record.updated_at,
    weekStart: record.week_start
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

const validateDayOfWeek = (value, details, fieldName) => {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    details.push(`${fieldName} must be an integer between 1 and 7`);
    return null;
  }

  return value;
};

const validateEntryWindows = (entries, details, prefix) => {
  const groupedEntries = new Map();

  entries.forEach((entry, index) => {
    const dayEntries = groupedEntries.get(entry.dayOfWeek) || [];
    dayEntries.push({
      endTime: entry.endTime,
      index,
      startTime: entry.startTime
    });
    groupedEntries.set(entry.dayOfWeek, dayEntries);
  });

  groupedEntries.forEach((dayEntries) => {
    const sortedEntries = dayEntries.sort((left, right) => {
      return compareTimes(left.startTime, right.startTime);
    });

    for (let index = 1; index < sortedEntries.length; index += 1) {
      const previousEntry = sortedEntries[index - 1];
      const currentEntry = sortedEntries[index];

      if (compareTimes(currentEntry.startTime, previousEntry.endTime) < 0) {
        details.push(
          `${prefix}[${currentEntry.index}] overlaps another availability window for the same day`
        );
      }
    }
  });
};

const validateAvailabilityCreateInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      availabilityInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const unexpectedFields = listUnexpectedFields(payload, createFieldNames);

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  const weekStart = validateWeekStart(payload.weekStart, details);
  const entries = [];

  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    details.push('entries must be a non-empty array');
  } else {
    payload.entries.forEach((entryPayload, index) => {
      if (!isPlainObject(entryPayload)) {
        details.push(`entries[${index}] must be an object`);
        return;
      }

      const entryUnexpectedFields = listUnexpectedFields(entryPayload, entryFieldNames);
      if (entryUnexpectedFields.length > 0) {
        details.push(
          `entries[${index}] has unsupported fields: ${entryUnexpectedFields.join(', ')}`
        );
      }

      const dayOfWeek = validateDayOfWeek(
        entryPayload.dayOfWeek,
        details,
        `entries[${index}].dayOfWeek`
      );
      const startTime = parseTimeValue(entryPayload.startTime);
      const endTime = parseTimeValue(entryPayload.endTime);
      const status = String(entryPayload.status || '').trim().toUpperCase();

      if (!startTime) {
        details.push(`entries[${index}].startTime must be a valid HH:MM time`);
      }

      if (!endTime) {
        details.push(`entries[${index}].endTime must be a valid HH:MM time`);
      }

      if (startTime && endTime && compareTimes(endTime, startTime) <= 0) {
        details.push(`entries[${index}].endTime must be after startTime`);
      }

      if (!allowedAvailabilityStatuses.includes(status)) {
        details.push(
          `entries[${index}].status must be one of: ${allowedAvailabilityStatuses.join(', ')}`
        );
      }

      if (dayOfWeek && startTime && endTime && allowedAvailabilityStatuses.includes(status)) {
        entries.push({
          dayOfWeek,
          endTime,
          startTime,
          status
        });
      }
    });
  }

  validateEntryWindows(entries, details, 'entries');

  return {
    availabilityInput: {
      entries,
      weekStart
    },
    details
  };
};

const validateAvailabilityUpdateInput = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      availabilityInput: {},
      details: ['request body must be a JSON object']
    };
  }

  const details = [];
  const availabilityInput = {};
  const unexpectedFields = listUnexpectedFields(payload, updateFieldNames);

  if (unexpectedFields.length > 0) {
    details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'weekStart')) {
    availabilityInput.weekStart = validateWeekStart(payload.weekStart, details);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'dayOfWeek')) {
    availabilityInput.dayOfWeek = validateDayOfWeek(
      payload.dayOfWeek,
      details,
      'dayOfWeek'
    );
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'startTime')) {
    const startTime = parseTimeValue(payload.startTime);

    if (!startTime) {
      details.push('startTime must be a valid HH:MM time');
    } else {
      availabilityInput.startTime = startTime;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'endTime')) {
    const endTime = parseTimeValue(payload.endTime);

    if (!endTime) {
      details.push('endTime must be a valid HH:MM time');
    } else {
      availabilityInput.endTime = endTime;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = String(payload.status || '').trim().toUpperCase();

    if (!allowedAvailabilityStatuses.includes(status)) {
      details.push(
        `status must be one of: ${allowedAvailabilityStatuses.join(', ')}`
      );
    } else {
      availabilityInput.status = status;
    }
  }

  if (Object.keys(availabilityInput).length === 0 && details.length === 0) {
    details.push('at least one availability field must be provided');
  }

  return {
    availabilityInput,
    details
  };
};

const buildAvailabilityListFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterFieldNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  const weekStart = validateWeekStart(queryParams?.weekStart, details);
  const status = String(queryParams?.status || 'ALL').trim().toUpperCase();
  const staffProfileId = String(queryParams?.staffProfileId || '').trim();

  if (!allowedAvailabilityListStatuses.includes(status)) {
    details.push(
      `status must be one of: ${allowedAvailabilityListStatuses.join(', ')}`
    );
  }

  if (staffProfileId && !uuidPattern.test(staffProfileId)) {
    details.push('staffProfileId must be a valid UUID');
  }

  return {
    details,
    filters: {
      staffProfileId: staffProfileId || null,
      status,
      weekStart
    }
  };
};

const listAvailability = async (authUser, filters) => {
  const values = [filters.weekStart];
  const conditions = ['availability_entries.week_start = $1'];

  if (authUser.role === 'STAFF') {
    values.push(authUser.staffProfileId);
    conditions.push(`availability_entries.staff_profile_id = $${values.length}`);
  } else if (filters.staffProfileId) {
    values.push(filters.staffProfileId);
    conditions.push(`availability_entries.staff_profile_id = $${values.length}`);
  }

  if (filters.status !== 'ALL') {
    values.push(filters.status);
    conditions.push(`availability_entries.status = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        availability_entries.id,
        availability_entries.staff_profile_id,
        availability_entries.week_start::text AS week_start,
        availability_entries.day_of_week,
        availability_entries.start_time::text AS start_time,
        availability_entries.end_time::text AS end_time,
        availability_entries.status,
        availability_entries.created_at,
        availability_entries.updated_at,
        staff_profiles.full_name,
        users.email
      FROM availability_entries
      INNER JOIN staff_profiles
        ON staff_profiles.id = availability_entries.staff_profile_id
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY availability_entries.day_of_week ASC, availability_entries.start_time ASC
    `,
    values
  );

  return result.rows.map((row) => mapAvailabilityRecord(row));
};

const findAvailabilityById = async (availabilityId) => {
  const result = await query(
    `
      SELECT
        availability_entries.id,
        availability_entries.staff_profile_id,
        availability_entries.week_start::text AS week_start,
        availability_entries.day_of_week,
        availability_entries.start_time::text AS start_time,
        availability_entries.end_time::text AS end_time,
        availability_entries.status,
        availability_entries.created_at,
        availability_entries.updated_at,
        staff_profiles.full_name,
        users.email
      FROM availability_entries
      INNER JOIN staff_profiles
        ON staff_profiles.id = availability_entries.staff_profile_id
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE availability_entries.id = $1
      LIMIT 1
    `,
    [availabilityId]
  );

  return mapAvailabilityRecord(result.rows[0]);
};

const findOverlappingAvailability = async (
  client,
  staffProfileId,
  weekStart,
  dayOfWeek,
  startTime,
  endTime,
  excludedAvailabilityId = null
) => {
  const result = await client.query(
    `
      SELECT id
      FROM availability_entries
      WHERE staff_profile_id = $1
        AND week_start = $2
        AND day_of_week = $3
        AND start_time < $4::time
        AND end_time > $5::time
        AND ($6::uuid IS NULL OR id <> $6)
      LIMIT 1
    `,
    [staffProfileId, weekStart, dayOfWeek, endTime, startTime, excludedAvailabilityId]
  );

  return result.rows[0] || null;
};

const createAvailabilityEntries = async (staffProfileId, availabilityInput) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const entry of availabilityInput.entries) {
      const overlap = await findOverlappingAvailability(
        client,
        staffProfileId,
        availabilityInput.weekStart,
        entry.dayOfWeek,
        entry.startTime,
        entry.endTime
      );

      if (overlap) {
        throw createConflictError(
          'AVAILABILITY_OVERLAP_CONFLICT',
          'One or more availability windows overlap an existing entry for that week.'
        );
      }
    }

    const createdEntries = [];

    for (const entry of availabilityInput.entries) {
      const insertResult = await client.query(
        `
          INSERT INTO availability_entries (
            staff_profile_id,
            week_start,
            day_of_week,
            start_time,
            end_time,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4::time, $5::time, $6, NOW(), NOW())
          RETURNING
            id,
            staff_profile_id,
            week_start::text AS week_start,
            day_of_week,
            start_time::text AS start_time,
            end_time::text AS end_time,
            status,
            created_at,
            updated_at
        `,
        [
          staffProfileId,
          availabilityInput.weekStart,
          entry.dayOfWeek,
          entry.startTime,
          entry.endTime,
          entry.status
        ]
      );

      createdEntries.push(mapAvailabilityRecord(insertResult.rows[0]));
    }

    await client.query('COMMIT');
    return createdEntries;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateAvailabilityEntry = async (existingEntry, availabilityInput) => {
  const mergedEntry = {
    dayOfWeek:
      availabilityInput.dayOfWeek || existingEntry.dayOfWeek,
    endTime: availabilityInput.endTime || existingEntry.endTime,
    startTime: availabilityInput.startTime || existingEntry.startTime,
    status: availabilityInput.status || existingEntry.status,
    weekStart: availabilityInput.weekStart || existingEntry.weekStart
  };

  if (compareTimes(mergedEntry.endTime, mergedEntry.startTime) <= 0) {
    throw createConflictError(
      'AVAILABILITY_TIME_CONFLICT',
      'Availability endTime must be after startTime.'
    );
  }

  if (existingEntry.weekStart < getCurrentWeekStart()) {
    throw createConflictError(
      'AVAILABILITY_LOCKED',
      'Only current or future availability entries can be changed.'
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const overlap = await findOverlappingAvailability(
      client,
      existingEntry.staffProfileId,
      mergedEntry.weekStart,
      mergedEntry.dayOfWeek,
      mergedEntry.startTime,
      mergedEntry.endTime,
      existingEntry.id
    );

    if (overlap) {
      throw createConflictError(
        'AVAILABILITY_OVERLAP_CONFLICT',
        'This availability window overlaps another entry for the same week.'
      );
    }

    const updateResult = await client.query(
      `
        UPDATE availability_entries
        SET
          week_start = $1,
          day_of_week = $2,
          start_time = $3::time,
          end_time = $4::time,
          status = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING
          id,
          staff_profile_id,
          week_start::text AS week_start,
          day_of_week,
          start_time::text AS start_time,
          end_time::text AS end_time,
          status,
          created_at,
          updated_at
      `,
      [
        mergedEntry.weekStart,
        mergedEntry.dayOfWeek,
        mergedEntry.startTime,
        mergedEntry.endTime,
        mergedEntry.status,
        existingEntry.id
      ]
    );

    await client.query('COMMIT');
    return mapAvailabilityRecord(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const deleteAvailabilityEntry = async (existingEntry) => {
  if (existingEntry.weekStart < getCurrentWeekStart()) {
    throw createConflictError(
      'AVAILABILITY_LOCKED',
      'Only current or future availability entries can be changed.'
    );
  }

  await query('DELETE FROM availability_entries WHERE id = $1', [existingEntry.id]);
};

module.exports = {
  allowedAvailabilityListStatuses,
  allowedAvailabilityStatuses,
  buildAvailabilityListFilters,
  createAvailabilityEntries,
  deleteAvailabilityEntry,
  findAvailabilityById,
  listAvailability,
  updateAvailabilityEntry,
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput
};
