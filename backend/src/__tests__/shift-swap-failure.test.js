const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { closePool, query } = require('../config/db');
const {
  acceptSwapRequest,
  createSwapRequest,
  decideSwapRequest,
  withdrawSwapRequest
} = require('../services/shift-swap-service');

jest.setTimeout(30000);

const getFutureMonday = (offsetWeeks = 11) => {
  const date = new Date();
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (weekday - 1) + (offsetWeeks * 7));
  return date.toISOString().slice(0, 10);
};

const addDays = (dateValue, days) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

describe('shift swap failure and race-condition checks', () => {
  const runId = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const managerId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const weekStart = getFutureMonday();
  const userIds = [managerId];
  const profileIds = [managerProfileId];
  const shiftIds = [];
  const assignmentIds = [];

  const insertStaff = async (label, {
    active = true,
    contractHours = 40,
    role = 'BAR',
    userActive = true
  } = {}) => {
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const hash = await bcrypt.hash('Phase 2 swap password 123!', 10);
    userIds.push(userId);
    profileIds.push(profileId);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'STAFF', $4, NOW(), NOW())`,
      [userId, `phase2.swap.${label}.${runId}@example.test`, hash, userActive]
    );
    await query(
      `INSERT INTO staff_profiles (
         id, user_id, full_name, primary_role, contract_hours,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [profileId, userId, `Phase 2 ${label}`, role, contractHours, active]
    );
    return { profileId, userId };
  };

  const insertAssignment = async ({
    date = weekStart,
    endTime = '17:00',
    profileId,
    startTime = '09:00',
    status = 'OPEN'
  }) => {
    const shiftId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    shiftIds.push(shiftId);
    assignmentIds.push(assignmentId);
    await query(
      `INSERT INTO shifts (
         id, shift_date, start_time, end_time, required_role,
         status, notes, created_at, updated_at
       ) VALUES ($1, $2, $3::time, $4::time, 'BAR', $5, $6, NOW(), NOW())`,
      [shiftId, date, startTime, endTime, status, `Phase 2 swap ${runId}`]
    );
    await query(
      `INSERT INTO shift_assignments (
         id, shift_id, staff_profile_id, assigned_by_user_id,
         assigned_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())`,
      [assignmentId, shiftId, profileId, managerId]
    );
    return { assignmentId, shiftId };
  };

  const createSwap = async (requesterProfileId, assignmentId, targetStaffProfileId = null) => {
    return createSwapRequest({
      requesterStaffProfileId: requesterProfileId,
      swapInput: {
        assignmentId,
        reason: 'Phase 2 swap check',
        targetStaffProfileId
      }
    });
  };

  beforeAll(async () => {
    const hash = await bcrypt.hash('Phase 2 swap manager 123!', 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW())`,
      [managerId, `phase2.swap.manager.${runId}@example.test`, hash]
    );
    await query(
      `INSERT INTO staff_profiles (
         id, user_id, full_name, primary_role, contract_hours,
         is_active, created_at, updated_at
       ) VALUES ($1, $2, 'Phase 2 Swap Manager', 'FLOOR', 40, TRUE, NOW(), NOW())`,
      [managerProfileId, managerId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM audit_logs WHERE actor_user_id = $1', [managerId]);
    await query('DELETE FROM shift_swap_requests WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
    await query('DELETE FROM shift_assignments WHERE id = ANY($1::uuid[])', [assignmentIds]);
    await query('DELETE FROM leave_requests WHERE staff_profile_id = ANY($1::uuid[])', [profileIds]);
    await query('DELETE FROM shifts WHERE id = ANY($1::uuid[])', [shiftIds]);
    await query('DELETE FROM staff_profiles WHERE id = ANY($1::uuid[])', [profileIds]);
    await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await closePool();
  });

  test('inactive accounts and wrong-role targets are rejected when the swap is created', async () => {
    const requester = await insertStaff('create.requester');
    const inactive = await insertStaff('create.inactive', { userActive: false });
    const wrongRole = await insertStaff('create.wrongrole', { role: 'FLOOR' });
    const first = await insertAssignment({ date: addDays(weekStart, 0), profileId: requester.profileId });
    const second = await insertAssignment({ date: addDays(weekStart, 1), profileId: requester.profileId });

    await expect(createSwap(requester.profileId, first.assignmentId, inactive.profileId))
      .resolves.toEqual({ code: 'TARGET_INELIGIBLE' });
    await expect(createSwap(requester.profileId, second.assignmentId, wrongRole.profileId))
      .resolves.toEqual({ code: 'TARGET_INELIGIBLE' });
  });

  test('duplicate requests are blocked, and only the requester can withdraw one', async () => {
    const requester = await insertStaff('withdraw.requester');
    const other = await insertStaff('withdraw.other');
    const source = await insertAssignment({ date: addDays(weekStart, 2), profileId: requester.profileId });
    const created = await createSwap(requester.profileId, source.assignmentId);

    await expect(createSwap(requester.profileId, source.assignmentId))
      .resolves.toEqual({ code: 'ALREADY_REQUESTED' });
    await expect(withdrawSwapRequest({
      requesterStaffProfileId: other.profileId,
      swapId: created.swap.id
    })).resolves.toEqual({ code: 'FORBIDDEN' });
    await expect(withdrawSwapRequest({
      requesterStaffProfileId: requester.profileId,
      swapId: created.swap.id
    })).resolves.toEqual({ withdrawn: true });

    const row = await query('SELECT status FROM shift_swap_requests WHERE id = $1', [created.swap.id]);
    expect(row.rows[0].status).toBe('CANCELLED');
    await expect(createSwap(requester.profileId, source.assignmentId))
      .resolves.toEqual(expect.objectContaining({ swap: expect.objectContaining({ status: 'PENDING' }) }));
  });

  test('two employees accepting the same open swap produce one accepted record', async () => {
    const requester = await insertStaff('race.requester');
    const firstTarget = await insertStaff('race.first');
    const secondTarget = await insertStaff('race.second');
    const source = await insertAssignment({ date: addDays(weekStart, 3), profileId: requester.profileId });
    const created = await createSwap(requester.profileId, source.assignmentId);

    const results = await Promise.all([
      acceptSwapRequest({ swapId: created.swap.id, staffProfileId: firstTarget.profileId }),
      acceptSwapRequest({ swapId: created.swap.id, staffProfileId: secondTarget.profileId })
    ]);

    expect(results.filter((result) => result.swap)).toHaveLength(1);
    expect(results.filter((result) => result.code === 'NOT_AVAILABLE')).toHaveLength(1);
    const row = await query(
      'SELECT status, accepted_by_staff_profile_id FROM shift_swap_requests WHERE id = $1',
      [created.swap.id]
    );
    expect(row.rows[0].status).toBe('ACCEPTED');
    expect([firstTarget.profileId, secondTarget.profileId]).toContain(
      row.rows[0].accepted_by_staff_profile_id
    );
  });

  test.each([
    ['approved leave', 'leave'],
    ['an overlapping shift', 'overlap'],
    ['the five-shift weekly limit', 'limit']
  ])('acceptance is blocked by %s', async (label, reason) => {
    const requester = await insertStaff(`accept.${reason}.requester`);
    const target = await insertStaff(`accept.${reason}.target`);
    const date = addDays(weekStart, 4);
    const source = await insertAssignment({ date, profileId: requester.profileId });
    const created = await createSwap(requester.profileId, source.assignmentId, target.profileId);

    if (reason === 'leave') {
      await query(
        `INSERT INTO leave_requests (
           staff_profile_id, start_date, end_date, reason, status,
           manager_comment, decided_by_user_id, decided_at,
           created_at, updated_at
         ) VALUES ($1, $2, $2, 'Swap leave', 'APPROVED', 'Approved', $3, NOW(), NOW(), NOW())`,
        [target.profileId, date, managerId]
      );
    } else if (reason === 'overlap') {
      await insertAssignment({
        date,
        endTime: '18:00',
        profileId: target.profileId,
        startTime: '10:00'
      });
    } else {
      for (let day = 0; day < 5; day += 1) {
        await insertAssignment({
          date: addDays(weekStart, day),
          endTime: '15:00',
          profileId: target.profileId,
          startTime: '09:00'
        });
      }
    }

    await expect(acceptSwapRequest({
      swapId: created.swap.id,
      staffProfileId: target.profileId
    })).resolves.toEqual({ code: 'TARGET_INELIGIBLE' });
  });

  test.each([
    ['role', 'role'],
    ['shift status', 'status'],
    ['approved leave', 'leave'],
    ['overlap', 'overlap'],
    ['weekly limit', 'limit'],
    ['original assignment ownership', 'ownership']
  ])('manager approval revalidates %s', async (label, reason) => {
    const requester = await insertStaff(`approve.${reason}.requester`);
    const target = await insertStaff(`approve.${reason}.target`);
    const date = addDays(weekStart, 5);
    const source = await insertAssignment({ date, profileId: requester.profileId });
    const created = await createSwap(requester.profileId, source.assignmentId, target.profileId);
    expect((await acceptSwapRequest({
      swapId: created.swap.id,
      staffProfileId: target.profileId
    })).swap.status).toBe('ACCEPTED');

    if (reason === 'role') {
      await query("UPDATE staff_profiles SET primary_role = 'FLOOR' WHERE id = $1", [target.profileId]);
    } else if (reason === 'status') {
      await query("UPDATE shifts SET status = 'CANCELLED' WHERE id = $1", [source.shiftId]);
    } else if (reason === 'leave') {
      await query(
        `INSERT INTO leave_requests (
           staff_profile_id, start_date, end_date, reason, status,
           manager_comment, decided_by_user_id, decided_at,
           created_at, updated_at
         ) VALUES ($1, $2, $2, 'Approval leave', 'APPROVED', 'Approved', $3, NOW(), NOW(), NOW())`,
        [target.profileId, date, managerId]
      );
    } else if (reason === 'overlap') {
      await insertAssignment({ date, endTime: '18:00', profileId: target.profileId, startTime: '10:00' });
    } else if (reason === 'limit') {
      for (let day = 0; day < 5; day += 1) {
        await insertAssignment({
          date: addDays(weekStart, day),
          endTime: '15:00',
          profileId: target.profileId,
          startTime: '09:00'
        });
      }
    } else {
      await query(
        'UPDATE shift_assignments SET staff_profile_id = $1 WHERE id = $2',
        [target.profileId, source.assignmentId]
      );
    }

    const decision = await decideSwapRequest({
      decision: 'APPROVE',
      managerNote: 'Phase 2 revalidation',
      managerUserId: managerId,
      swapId: created.swap.id
    });
    expect(decision.code).toBe('ASSIGNMENT_CONFLICT');

    const assignment = await query(
      'SELECT staff_profile_id FROM shift_assignments WHERE id = $1',
      [source.assignmentId]
    );
    if (reason !== 'ownership') {
      expect(assignment.rows[0].staff_profile_id).toBe(requester.profileId);
    }
  });

  test('manager approval rolls back both the assignment and swap when its audit insert fails', async () => {
    const requester = await insertStaff('approve.rollback.requester');
    const target = await insertStaff('approve.rollback.target');
    const source = await insertAssignment({
      date: addDays(weekStart, 6),
      profileId: requester.profileId
    });
    const created = await createSwap(
      requester.profileId,
      source.assignmentId,
      target.profileId
    );
    expect((await acceptSwapRequest({
      swapId: created.swap.id,
      staffProfileId: target.profileId
    })).swap.status).toBe('ACCEPTED');

    const triggerName = 'phase2_fail_swap_assignment_audit';
    const functionName = 'phase2_fail_swap_assignment_audit_fn';
    await query(`
      CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = 'ASSIGNMENT_UPDATED' AND NEW.actor_user_id = '${managerId}'::uuid THEN
          RAISE EXCEPTION 'phase 2 forced swap audit failure';
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

    try {
      await expect(decideSwapRequest({
        decision: 'APPROVE',
        managerNote: 'Must roll back',
        managerUserId: managerId,
        swapId: created.swap.id
      })).rejects.toThrow('phase 2 forced swap audit failure');
    } finally {
      await query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_logs`);
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    const assignment = await query(
      'SELECT staff_profile_id FROM shift_assignments WHERE id = $1',
      [source.assignmentId]
    );
    const swap = await query(
      'SELECT status FROM shift_swap_requests WHERE id = $1',
      [created.swap.id]
    );
    expect(assignment.rows[0].staff_profile_id).toBe(requester.profileId);
    expect(swap.rows[0].status).toBe('ACCEPTED');
  });
});
