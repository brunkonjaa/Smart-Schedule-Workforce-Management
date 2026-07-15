const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');
dotenv.config({
  override: true,
  path: path.join(backendRoot, 'local-evidence.env')
});

const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, pool } = require('../config/db');

const targetEmail = process.env.STAFF_HISTORY_EMAIL || 'alex.byrne@example.com';
const historyWeeks = 12;
const historyNote = 'Demo previous weeks worked history';

const getCurrentWeekStart = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - daysFromMonday);
  return monday.toISOString().slice(0, 10);
};

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const addWeeks = (dateValue, weeks) => addDays(dateValue, weeks * 7);

const assertLocalDatabase = () => {
  if (config.nodeEnv === 'production' || !isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Staff history seed is only allowed against a local non-production database.');
  }
};

const run = async () => {
  assertLocalDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const staffResult = await client.query(
      `
        SELECT staff_profiles.id, staff_profiles.full_name, staff_profiles.primary_role
        FROM staff_profiles
        INNER JOIN users ON users.id = staff_profiles.user_id
        WHERE users.email = $1
          AND users.role = 'STAFF'
          AND users.is_active = TRUE
        LIMIT 1
      `,
      [targetEmail]
    );
    if (staffResult.rowCount === 0) {
      throw new Error(`Could not find active staff account ${targetEmail}.`);
    }

    const managerResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE role = 'MANAGER' AND is_active = TRUE
        ORDER BY created_at ASC
        LIMIT 1
      `
    );
    if (managerResult.rowCount === 0) {
      throw new Error('Could not find an active manager for the history assignments.');
    }

    const staff = staffResult.rows[0];
    const managerId = managerResult.rows[0].id;
    const currentWeekStart = getCurrentWeekStart();

    await client.query(
      `
        DELETE FROM shifts
        WHERE notes = $1
          AND id IN (
            SELECT shift_assignments.shift_id
            FROM shift_assignments
            WHERE shift_assignments.staff_profile_id = $2
          )
      `,
      [historyNote, staff.id]
    );

    const shifts = [];
    const assignments = [];
    for (let week = 1; week <= historyWeeks; week += 1) {
      const weekStart = addWeeks(currentWeekStart, -week);
      [
        { dayOffset: 1, startTime: '11:00', endTime: '16:00' },
        { dayOffset: 3, startTime: '15:00', endTime: '21:00' }
      ].forEach(({ dayOffset, startTime, endTime }) => {
        const shiftId = crypto.randomUUID();
        shifts.push({
          end_time: endTime,
          id: shiftId,
          notes: historyNote,
          required_role: staff.primary_role === 'OTHER' ? 'KITCHEN' : staff.primary_role,
          shift_date: addDays(weekStart, dayOffset),
          start_time: startTime,
          status: 'OPEN'
        });
        assignments.push({
          assigned_by_user_id: managerId,
          id: crypto.randomUUID(),
          shift_id: shiftId,
          staff_profile_id: staff.id
        });
      });
    }

    for (const shift of shifts) {
      await client.query(
        `
          INSERT INTO shifts (id, shift_date, start_time, end_time, required_role, status, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [shift.id, shift.shift_date, shift.start_time, shift.end_time, shift.required_role, shift.status, shift.notes]
      );
    }

    for (const assignment of assignments) {
      await client.query(
        `
          INSERT INTO shift_assignments (id, shift_id, staff_profile_id, assigned_by_user_id)
          VALUES ($1, $2, $3, $4)
        `,
        [assignment.id, assignment.shift_id, assignment.staff_profile_id, assignment.assigned_by_user_id]
      );
    }

    await client.query('COMMIT');
    console.log(`Added ${assignments.length} assigned history shifts for ${staff.full_name}.`);
    console.log(`History range: ${addWeeks(currentWeekStart, -historyWeeks)} to ${addDays(currentWeekStart, -1)}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await closePool();
  }
};

if (!fs.existsSync(path.join(backendRoot, 'local-evidence.env'))) {
  throw new Error('backend/local-evidence.env is required for this local-only seed.');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
