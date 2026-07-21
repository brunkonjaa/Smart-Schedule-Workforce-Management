const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const { getAssignmentTotalsForWeek } = require('../services/assignment-service');

jest.setTimeout(30000);

const getFutureMonday = (offsetWeeks = 8) => {
  const date = new Date();
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (weekday - 1) + (offsetWeeks * 7));
  return date.toISOString().slice(0, 10);
};

const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

describe('assignment transaction and weekly boundary failures', () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const managerId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const managerEmail = `phase2.manager.${runId}@example.test`;
  const password = 'Phase 2 assignment password 123!';
  const weekStart = getFutureMonday();
  const userIds = [managerId];
  const profileIds = [managerProfileId];
  const shiftIds = [];
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };
  let firstManager;
  let secondManager;

  const insertStaff = async (label, contractHours = 40) => {
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    userIds.push(userId);
    profileIds.push(profileId);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [userId, `phase2.${label}.${runId}@example.test`, passwordHash]
    );
    await query(
      `INSERT INTO staff_profiles (
         id, user_id, full_name, primary_role, contract_hours,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, 'BAR', $4, TRUE, NOW(), NOW())`,
      [profileId, userId, `Phase 2 ${label}`, contractHours]
    );
    return { profileId, userId };
  };

  const insertShift = async ({ date, endTime, label, startTime }) => {
    const shiftId = crypto.randomUUID();
    shiftIds.push(shiftId);
    await query(
      `INSERT INTO shifts (
         id, shift_date, start_time, end_time, required_role,
         status, notes, created_at, updated_at
       ) VALUES ($1, $2, $3::time, $4::time, 'BAR', 'OPEN', $5, NOW(), NOW())`,
      [shiftId, date, startTime, endTime, `Phase 2 ${runId} ${label}`]
    );
    return shiftId;
  };

  const assignDirectly = async (shiftId, profileId) => {
    await query(
      `INSERT INTO shift_assignments (
         shift_id, staff_profile_id, assigned_by_user_id,
         assigned_at, created_at, updated_at
       ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
      [shiftId, profileId, managerId]
    );
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW())`,
      [managerId, managerEmail, passwordHash]
    );
    await query(
      `INSERT INTO staff_profiles (
         id, user_id, full_name, primary_role, contract_hours,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, 'Phase 2 Manager', 'FLOOR', 40, TRUE, NOW(), NOW())`,
      [managerProfileId, managerId]
    );
    firstManager = request.agent(app);
    secondManager = request.agent(app);
    expect((await firstManager.post('/api/v1/auth/login').send({
      email: managerEmail,
      password
    })).status).toBe(200);
    expect((await secondManager.post('/api/v1/auth/login').send({
      email: managerEmail,
      password
    })).status).toBe(200);
  });

  afterAll(async () => {
    await query('DELETE FROM audit_logs WHERE actor_user_id = $1', [managerId]);
    await query('DELETE FROM shift_assignments WHERE shift_id = ANY($1::uuid[])', [shiftIds]);
    await query('DELETE FROM leave_requests WHERE staff_profile_id = ANY($1::uuid[])', [profileIds]);
    await query('DELETE FROM shifts WHERE id = ANY($1::uuid[])', [shiftIds]);
    await query('DELETE FROM staff_profiles WHERE id = ANY($1::uuid[])', [profileIds]);
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await closePool();
  });

  test('a failure after assignment insert rolls back the assignment and its audit row', async () => {
    const staff = await insertStaff('rollback');
    const shiftId = await insertShift({
      date: addDays(weekStart, 0),
      endTime: '17:00',
      label: 'rollback',
      startTime: '09:00'
    });
    const triggerName = 'phase2_fail_assignment_audit';
    const functionName = 'phase2_fail_assignment_audit_fn';
    await query(`
      CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'ASSIGNMENT_CREATED' AND NEW.actor_user_id = '${managerId}'::uuid THEN
          RAISE EXCEPTION 'phase 2 forced assignment audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await query(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await firstManager
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({ shiftId, staffProfileId: staff.profileId });
      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
      await query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_logs`);
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    expect((await query(
      'SELECT id FROM shift_assignments WHERE shift_id = $1',
      [shiftId]
    )).rowCount).toBe(0);
  });

  test('near-simultaneous overlapping assignments allow one request only', async () => {
    const staff = await insertStaff('concurrency');
    const firstShiftId = await insertShift({
      date: addDays(weekStart, 1),
      endTime: '17:00',
      label: 'concurrency first',
      startTime: '09:00'
    });
    const secondShiftId = await insertShift({
      date: addDays(weekStart, 1),
      endTime: '18:00',
      label: 'concurrency second',
      startTime: '10:00'
    });

    const responses = await Promise.all([
      firstManager.post('/api/v1/assignments').set(mutationHeader).send({
        shiftId: firstShiftId,
        staffProfileId: staff.profileId
      }),
      secondManager.post('/api/v1/assignments').set(mutationHeader).send({
        shiftId: secondShiftId,
        staffProfileId: staff.profileId
      })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect((await query(
      'SELECT id FROM shift_assignments WHERE shift_id = ANY($1::uuid[])',
      [[firstShiftId, secondShiftId]]
    )).rowCount).toBe(1);
  });

  test.each([
    ['39 hours 59 minutes', '19:00', '22:59', 201],
    ['exactly 40 hours', '19:00', '23:00', 201],
    ['40 hours 1 minute', '18:59', '23:00', 409]
  ])('%s follows the hard weekly limit', async (label, startTime, endTime, expectedStatus) => {
    const staff = await insertStaff(label.replace(/\W/g, '').toLowerCase());

    for (let index = 0; index < 4; index += 1) {
      const shiftId = await insertShift({
        date: addDays(weekStart, index),
        endTime: '18:00',
        label: `${label} existing ${index}`,
        startTime: '09:00'
      });
      await assignDirectly(shiftId, staff.profileId);
    }
    const targetShiftId = await insertShift({
      date: addDays(weekStart, 4),
      endTime,
      label: `${label} target`,
      startTime
    });

    const response = await firstManager
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({ shiftId: targetShiftId, staffProfileId: staff.profileId });
    expect(response.status).toBe(expectedStatus);

    const assigned = await query(
      'SELECT id FROM shift_assignments WHERE shift_id = $1',
      [targetShiftId]
    );
    expect(assigned.rowCount).toBe(expectedStatus === 201 ? 1 : 0);
  });

  test('an overnight Sunday shift stays in its starting week and checks Monday leave and overlap', async () => {
    const overnightStaff = await insertStaff('overnight');
    const sunday = addDays(weekStart, 6);
    const monday = addDays(weekStart, 7);
    const created = await firstManager
      .post('/api/v1/shifts')
      .set(mutationHeader)
      .send({
        endTime: '06:00',
        notes: `Phase 2 ${runId} overnight week boundary`,
        requiredRole: 'BAR',
        shiftDate: sunday,
        startTime: '22:00',
        status: 'OPEN'
      });
    expect(created.status).toBe(201);
    const overnightShiftId = created.body.shift.id;
    shiftIds.push(overnightShiftId);

    const assignment = await firstManager
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({ shiftId: overnightShiftId, staffProfileId: overnightStaff.profileId });
    expect(assignment.status).toBe(201);
    expect(assignment.body.warnings).toEqual([]);

    await expect(getAssignmentTotalsForWeek(
      overnightStaff.profileId,
      weekStart
    )).resolves.toEqual(expect.objectContaining({ assignedHours: 8, assignedShiftCount: 1 }));
    await expect(getAssignmentTotalsForWeek(
      overnightStaff.profileId,
      monday
    )).resolves.toEqual(expect.objectContaining({ assignedHours: 0, assignedShiftCount: 0 }));

    const overlapShiftId = await insertShift({
      date: monday,
      endTime: '10:00',
      label: 'overnight partial overlap',
      startTime: '05:00'
    });
    const overlap = await firstManager
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({ shiftId: overlapShiftId, staffProfileId: overnightStaff.profileId });
    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toContain('overlaps or touches');

    const leaveStaff = await insertStaff('overnightleave');
    const leaveShiftId = await insertShift({
      date: sunday,
      endTime: '06:00',
      label: 'overnight into approved leave',
      startTime: '22:00'
    });
    await query(
      `INSERT INTO leave_requests (
         staff_profile_id, start_date, end_date, reason, status,
         manager_comment, decided_by_user_id, decided_at,
         created_at, updated_at
       ) VALUES ($1, $2, $2, 'Monday leave', 'APPROVED', 'Approved', $3, NOW(), NOW(), NOW())`,
      [leaveStaff.profileId, monday, managerId]
    );
    const leaveConflict = await firstManager
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({ shiftId: leaveShiftId, staffProfileId: leaveStaff.profileId });
    expect(leaveConflict.status).toBe(409);
    expect(leaveConflict.body.message).toContain('approved leave');

    const zeroLength = await firstManager
      .post('/api/v1/shifts')
      .set(mutationHeader)
      .send({
        endTime: '22:00',
        requiredRole: 'BAR',
        shiftDate: sunday,
        startTime: '22:00',
        status: 'OPEN'
      });
    expect(zeroLength.status).toBe(400);
    expect(zeroLength.body.details).toContain('endTime must not equal startTime');
  });

  test('pending, rejected, withdrawn and approved leave have distinct assignment outcomes', async () => {
    const date = addDays(weekStart, 6);
    const cases = [
      { expectedStatus: 201, label: 'pending leave', status: 'PENDING' },
      { expectedStatus: 201, label: 'rejected leave', status: 'REJECTED' },
      { expectedStatus: 201, label: 'withdrawn leave', status: null },
      { expectedStatus: 409, label: 'approved leave', status: 'APPROVED' }
    ];

    for (const testCase of cases) {
      const staff = await insertStaff(testCase.label.replace(/\W/g, ''));
      const shiftId = await insertShift({
        date,
        endTime: '17:00',
        label: testCase.label,
        startTime: '09:00'
      });
      if (testCase.status) {
        if (testCase.status === 'PENDING') {
          await query(
            `INSERT INTO leave_requests (
               staff_profile_id, start_date, end_date, reason, status,
               created_at, updated_at
             ) VALUES ($1, $2, $2, $3, $4, NOW(), NOW())`,
            [staff.profileId, date, testCase.label, testCase.status]
          );
        } else {
          await query(
            `INSERT INTO leave_requests (
               staff_profile_id, start_date, end_date, reason, status,
               manager_comment, decided_by_user_id, decided_at,
               created_at, updated_at
             ) VALUES ($1, $2, $2, $3, $4, 'Phase 2 decision', $5, NOW(), NOW(), NOW())`,
            [staff.profileId, date, testCase.label, testCase.status, managerId]
          );
        }
      } else {
        const withdrawn = await query(
          `INSERT INTO leave_requests (
             staff_profile_id, start_date, end_date, reason, status,
             created_at, updated_at
           ) VALUES ($1, $2, $2, $3, 'PENDING', NOW(), NOW()) RETURNING id`,
          [staff.profileId, date, testCase.label]
        );
        await query('DELETE FROM leave_requests WHERE id = $1', [withdrawn.rows[0].id]);
      }

      const response = await firstManager
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({ shiftId, staffProfileId: staff.profileId });
      expect(response.status).toBe(testCase.expectedStatus);
    }
  });
});
