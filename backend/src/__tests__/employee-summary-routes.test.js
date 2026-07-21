const bcrypt = require('bcrypt');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

jest.setTimeout(30000);

const addDays = (dateValue, dayCount) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
};

const getMonday = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const offset = (date.getUTCDay() || 7) - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
};

describe('Employee Summary routes', () => {
  const managerUserId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const inactiveUserId = crypto.randomUUID();
  const inactiveProfileId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();
  const otherProfileId = crypto.randomUUID();
  const managerEmail = `maeveobrien${Date.now()}fake@gmail.com`;
  const staffEmail = `aoifebrennan${Date.now()}fake@gmail.com`;
  const inactiveEmail = `seamusdoyle${Date.now()}fake@gmail.com`;
  const otherEmail = `orlakelly${Date.now()}fake@gmail.com`;
  const managerPassword = 'SummaryManager123!';
  const staffPassword = 'SummaryStaff123!';
  const currentDate = new Date().toISOString().slice(0, 10);
  const currentWeekStart = getMonday(currentDate);
  const selectedWeekStart = addDays(currentWeekStart, 7);
  const createdShiftIds = [];
  const createdAssignmentIds = [];
  const createdLeaveIds = [];
  const createdSwapIds = [];
  const completedLeaveIds = [];
  const completedSwapIds = [];
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };

  const insertShiftAssignment = async ({
    date,
    endTime,
    role = 'BAR',
    staffId = staffProfileId,
    startTime,
    status = 'OPEN'
  }) => {
    const shiftId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    createdShiftIds.push(shiftId);
    createdAssignmentIds.push(assignmentId);

    await query(
      `
        INSERT INTO shifts (
          id, shift_date, start_time, end_time, required_role, status,
          created_at, updated_at
        )
        VALUES ($1, $2, $3::time, $4::time, $5, $6, NOW(), NOW())
      `,
      [shiftId, date, startTime, endTime, role, status]
    );
    await query(
      `
        INSERT INTO shift_assignments (
          id, shift_id, staff_profile_id, assigned_by_user_id,
          assigned_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `,
      [assignmentId, shiftId, staffId, managerUserId]
    );

    return { assignmentId, shiftId };
  };

  beforeAll(async () => {
    const managerHash = await bcrypt.hash(managerPassword, 10);
    const staffHash = await bcrypt.hash(staffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW()),
          ($7, $8, $6, 'STAFF', FALSE, NOW(), NOW()),
          ($9, $10, $6, 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        managerUserId,
        managerEmail,
        managerHash,
        staffUserId,
        staffEmail,
        staffHash,
        inactiveUserId,
        inactiveEmail,
        otherUserId,
        otherEmail
      ]
    );
    await query(
      `
        INSERT INTO staff_profiles (
          id, user_id, full_name, primary_role, contract_hours, phone_number,
          is_active, created_at, updated_at
        )
        VALUES
          ($1, $2, 'Maeve O''Brien', 'FLOOR', 40, '0857000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Aoife Brennan', 'BAR', 32, '0857000002', TRUE, '2025-09-15', NOW()),
          ($5, $6, 'Seamus Doyle', 'KITCHEN', 20, NULL, FALSE, '2024-11-04', NOW()),
          ($7, $8, 'Orla Kelly', 'BAR', 24, '0857000004', TRUE, NOW(), NOW())
      `,
      [
        managerProfileId,
        managerUserId,
        staffProfileId,
        staffUserId,
        inactiveProfileId,
        inactiveUserId,
        otherProfileId,
        otherUserId
      ]
    );

    await insertShiftAssignment({
      date: selectedWeekStart,
      endTime: '17:00',
      startTime: '09:00'
    });
    await insertShiftAssignment({
      date: addDays(selectedWeekStart, 2),
      endTime: '14:00',
      startTime: '10:00'
    });
    await insertShiftAssignment({
      date: addDays(selectedWeekStart, 4),
      endTime: '12:00',
      startTime: '09:00',
      status: 'CANCELLED'
    });
    await insertShiftAssignment({
      date: currentDate,
      endTime: '15:00',
      startTime: '09:00'
    });
    await insertShiftAssignment({
      date: addDays(currentDate, 21),
      endTime: '18:00',
      startTime: '12:00'
    });
    await insertShiftAssignment({
      date: addDays(currentDate, 30),
      endTime: '13:00',
      startTime: '08:00'
    });
    await insertShiftAssignment({
      date: addDays(currentDate, 31),
      endTime: '13:00',
      startTime: '08:00'
    });

    const previousHourChunks = [[10], [20], [15, 15], [20, 20]];
    for (let index = 0; index < previousHourChunks.length; index += 1) {
      for (let chunkIndex = 0; chunkIndex < previousHourChunks[index].length; chunkIndex += 1) {
        const chunkHours = previousHourChunks[index][chunkIndex];
        await insertShiftAssignment({
          date: addDays(currentWeekStart, (index + 1) * -7 + chunkIndex),
          endTime: `${String(chunkHours).padStart(2, '0')}:00`,
          startTime: '00:00'
        });
      }
    }

    await query(
      `
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, summary,
          before_state, after_state, created_at
        )
        VALUES
          ($1, $2, 'ASSIGNMENT_DELETED', 'ASSIGNMENT', $3,
           'Deleted retained assignment', $4::jsonb, NULL, NOW() - INTERVAL '1 minute'),
          ($5, $2, 'ASSIGNMENT_DELETED', 'ASSIGNMENT', $6,
           'Deleted incomplete assignment', $7::jsonb, NULL, NOW())
      `,
      [
        crypto.randomUUID(),
        managerUserId,
        crypto.randomUUID(),
        JSON.stringify({
          endTime: '20:00',
          requiredRole: 'BAR',
          shiftDate: addDays(selectedWeekStart, 1),
          staffProfileId,
          startTime: '18:00'
        }),
        crypto.randomUUID(),
        crypto.randomUUID(),
        JSON.stringify({ staffProfileId })
      ]
    );

    const pendingLeaveId = crypto.randomUUID();
    const activeLeaveId = crypto.randomUUID();
    createdLeaveIds.push(pendingLeaveId, activeLeaveId);
    await query(
      `
        INSERT INTO leave_requests (
          id, staff_profile_id, start_date, end_date, reason, status,
          decided_by_user_id, decided_at, created_at, updated_at
        )
        VALUES
          ($1, $3, $4, $4, 'Family appointment', 'PENDING', NULL, NULL, NOW(), NOW()),
          ($2, $3, $5, $6, 'Annual leave', 'APPROVED', $7, NOW(), NOW(), NOW())
      `,
      [
        pendingLeaveId,
        activeLeaveId,
        staffProfileId,
        addDays(currentDate, 5),
        addDays(currentDate, -1),
        addDays(currentDate, 1),
        managerUserId
      ]
    );
    for (let index = 0; index < 12; index += 1) {
      const leaveId = crypto.randomUUID();
      createdLeaveIds.push(leaveId);
      completedLeaveIds.push(leaveId);
      await query(
        `
          INSERT INTO leave_requests (
            id, staff_profile_id, start_date, end_date, reason, status,
            decided_by_user_id, decided_at, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $3, $4, 'REJECTED', $5,
            NOW() - ($6::int * INTERVAL '1 minute'), NOW(),
            NOW() - ($6::int * INTERVAL '1 minute')
          )
        `,
        [
          leaveId,
          staffProfileId,
          addDays(currentDate, index + 40),
          `Completed reason ${index}`,
          managerUserId,
          index
        ]
      );
    }

    const pendingAssignment = await insertShiftAssignment({
      date: addDays(currentDate, 60),
      endTime: '16:00',
      startTime: '10:00'
    });
    const acceptedAssignment = await insertShiftAssignment({
      date: addDays(currentDate, 61),
      endTime: '16:00',
      startTime: '10:00'
    });
    const completedAssignment = await insertShiftAssignment({
      date: addDays(currentDate, 62),
      endTime: '16:00',
      startTime: '10:00'
    });
    const pendingSwapId = crypto.randomUUID();
    const acceptedSwapId = crypto.randomUUID();
    createdSwapIds.push(pendingSwapId, acceptedSwapId);
    await query(
      `
        INSERT INTO shift_swap_requests (
          id, assignment_id, requester_staff_profile_id,
          target_staff_profile_id, accepted_by_staff_profile_id,
          status, reason, created_at, accepted_at
        )
        VALUES
          ($1, $3, $5, $6, NULL, 'PENDING', 'Need this evening free', NOW(), NULL),
          ($2, $4, $5, $6, $6, 'ACCEPTED', 'Course appointment', NOW(), NOW())
      `,
      [
        pendingSwapId,
        acceptedSwapId,
        pendingAssignment.assignmentId,
        acceptedAssignment.assignmentId,
        staffProfileId,
        otherProfileId
      ]
    );
    for (let index = 0; index < 12; index += 1) {
      const swapId = crypto.randomUUID();
      createdSwapIds.push(swapId);
      completedSwapIds.push(swapId);
      await query(
        `
          INSERT INTO shift_swap_requests (
            id, assignment_id, requester_staff_profile_id,
            target_staff_profile_id, status, reason, created_at,
            decided_at, decided_by_user_id
          )
          VALUES (
            $1, $2, $3, $4, 'REJECTED', $5, NOW(),
            NOW() - ($6::int * INTERVAL '1 minute'), $7
          )
        `,
        [
          swapId,
          completedAssignment.assignmentId,
          staffProfileId,
          otherProfileId,
          `Completed swap ${index}`,
          index,
          managerUserId
        ]
      );
    }
  });

  afterAll(async () => {
    await query(
      `DELETE FROM audit_logs
       WHERE actor_user_id IN ($1, $2)
          OR entity_id IN ($3, $4)`,
      [managerUserId, staffUserId, staffProfileId, inactiveProfileId]
    );
    await query('DELETE FROM shift_swap_requests WHERE id = ANY($1::uuid[])', [createdSwapIds]);
    await query('DELETE FROM leave_requests WHERE id = ANY($1::uuid[])', [createdLeaveIds]);
    await query('DELETE FROM shift_assignments WHERE id = ANY($1::uuid[])', [createdAssignmentIds]);
    await query('DELETE FROM shifts WHERE id = ANY($1::uuid[])', [createdShiftIds]);
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2, $3, $4)',
      [managerProfileId, staffProfileId, inactiveProfileId, otherProfileId]
    );
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3, $4)',
      [managerUserId, staffUserId, inactiveUserId, otherUserId]
    );
    await closePool();
  });

  const login = async (email, password) => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  };

  const getSummary = async (agent, targetId = staffProfileId) => {
    return agent.get(
      `/api/v1/staff/${targetId}/summary?weekStart=${selectedWeekStart}&source=rota`
    );
  };

  test('signed-out summary requests receive 401 and create no access event', async () => {
    const before = await query(
      `SELECT COUNT(*)::int AS count FROM audit_logs
       WHERE entity_id = $1 AND action = 'EMPLOYEE_SUMMARY_VIEWED'`,
      [staffProfileId]
    );
    const response = await request(app).get(
      `/api/v1/staff/${staffProfileId}/summary?weekStart=${selectedWeekStart}`
    );
    const after = await query(
      `SELECT COUNT(*)::int AS count FROM audit_logs
       WHERE entity_id = $1 AND action = 'EMPLOYEE_SUMMARY_VIEWED'`,
      [staffProfileId]
    );

    expect(response.status).toBe(401);
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  test('authenticated staff receive 403 and create a denied access event', async () => {
    const agent = await login(staffEmail, staffPassword);
    const response = await getSummary(agent);
    const event = await query(
      `
        SELECT action, entity_id, after_state
        FROM audit_logs
        WHERE actor_user_id = $1
          AND entity_id = $2
          AND action = 'EMPLOYEE_SUMMARY_ACCESS_DENIED'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [staffUserId, staffProfileId]
    );

    expect(response.status).toBe(403);
    expect(event.rows[0]).toEqual(
      expect.objectContaining({
        action: 'EMPLOYEE_SUMMARY_ACCESS_DENIED',
        entity_id: staffProfileId
      })
    );
    expect(event.rows[0].after_state).toEqual({ result: 'DENIED', source: 'ROTA' });
  });

  test('a manager receives only the approved employee fields with no-store headers', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(Object.keys(response.body.summary.employee).sort()).toEqual([
      'accountStatus',
      'contractedWeeklyHours',
      'department',
      'email',
      'employmentStartDate',
      'employmentStatus',
      'fullName',
      'id',
      'phone',
      'role'
    ]);
    expect(response.body.summary.employee).toEqual({
      accountStatus: 'ACTIVE',
      contractedWeeklyHours: 32,
      department: 'BAR',
      email: staffEmail,
      employmentStartDate: '2025-09-15',
      employmentStatus: 'ACTIVE',
      fullName: 'Aoife Brennan',
      id: staffProfileId,
      phone: '0857000002',
      role: 'STAFF'
    });

    const serialized = JSON.stringify(response.body).toLowerCase();
    [
      'password_hash',
      'reset_token',
      'passkey',
      'session',
      'nodychat',
      'conversationid',
      'conversation_id',
      'unread'
    ].forEach((forbiddenField) => {
      expect(serialized).not.toContain(forbiddenField);
    });
  });

  test('selected, current and four previous completed week hours use active assignments only', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent);
    const hours = response.body.summary.hours;

    expect(hours.selectedRotaWeek).toEqual(
      expect.objectContaining({
        activeAssignmentHours: 12,
        contractedWeeklyHours: 32,
        deletedOrCancelledAssignmentHours: 5,
        weekStart: selectedWeekStart
      })
    );
    expect(hours.selectedRotaWeek.contractComparison).toEqual({
      differenceHours: -20,
      status: 'UNDER'
    });
    expect(hours.currentCalendarWeek).toEqual(
      expect.objectContaining({
        activeAssignmentHours: 6,
        weekStart: currentWeekStart
      })
    );
    expect(hours.previousCompletedWeeks.map((week) => week.activeAssignmentHours)).toEqual([
      10,
      20,
      30,
      40
    ]);
    expect(hours.fourPreviousCompletedWeekAverage).toBe(25);
  });

  test('future assignments stop at 30 days and do not repeat the selected week', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent);
    const selected = response.body.summary.assignments.selectedWeek.shifts;
    const later = response.body.summary.assignments.laterUpcoming.shifts;
    const selectedIds = new Set(selected.map((shift) => shift.assignmentId));

    expect(selected).toHaveLength(2);
    expect(later.some((shift) => shift.shiftDate === addDays(currentDate, 30))).toBe(true);
    expect(later.some((shift) => shift.shiftDate === addDays(currentDate, 31))).toBe(false);
    expect(later.some((shift) => selectedIds.has(shift.assignmentId))).toBe(false);
  });

  test('returns all waiting requests and only the ten newest completed requests', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent);
    const { timeOff, swapRequests } = response.body.summary;

    expect(timeOff.waitingOrActive).toHaveLength(2);
    expect(timeOff.completed).toHaveLength(10);
    expect(timeOff.completed[0].id).toBe(completedLeaveIds[0]);
    expect(swapRequests.waitingOrActive).toHaveLength(2);
    expect(swapRequests.completed).toHaveLength(10);
    expect(swapRequests.completed[0].id).toBe(completedSwapIds[0]);
    expect(swapRequests.waitingOrActive[0]).toEqual(
      expect.objectContaining({
        department: 'BAR',
        otherEmployee: 'Orla Kelly'
      })
    );
  });

  test('shows retained deleted facts without inventing missing details', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent);
    const records = response.body.summary.deletedOrCancelledAssignments;
    const incomplete = records.find((record) => record.detailsRetained === false);

    expect(records.length).toBeGreaterThanOrEqual(3);
    expect(incomplete).toEqual(
      expect.objectContaining({
        department: null,
        endTime: null,
        shiftDate: null,
        startTime: null,
        status: 'DELETED'
      })
    );
  });

  test('retained inactive employees remain readable to a manager', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent, inactiveProfileId);

    expect(response.status).toBe(200);
    expect(response.body.summary.employee).toEqual(
      expect.objectContaining({
        accountStatus: 'INACTIVE',
        employmentStatus: 'INACTIVE',
        fullName: 'Seamus Doyle'
      })
    );
  });

  test('missing employees receive 404', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await getSummary(agent, crypto.randomUUID());

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('This employee record is no longer available.');
  });

  test('view and protected print requests create separate access events', async () => {
    const agent = await login(managerEmail, managerPassword);
    const viewResponse = await getSummary(agent);
    const printResponse = await agent
      .post(`/api/v1/staff/${staffProfileId}/summary/print-request`)
      .set(mutationHeader)
      .send({ source: 'rota' });
    const events = await query(
      `
        SELECT action, after_state
        FROM audit_logs
        WHERE actor_user_id = $1
          AND entity_id = $2
          AND action IN (
            'EMPLOYEE_SUMMARY_VIEWED',
            'EMPLOYEE_SUMMARY_PRINT_REQUESTED'
          )
        ORDER BY created_at DESC
      `,
      [managerUserId, staffProfileId]
    );

    expect(viewResponse.status).toBe(200);
    expect(printResponse.status).toBe(204);
    expect(events.rows.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'EMPLOYEE_SUMMARY_VIEWED',
        'EMPLOYEE_SUMMARY_PRINT_REQUESTED'
      ])
    );
    expect(events.rows.find((event) => {
      return event.action === 'EMPLOYEE_SUMMARY_PRINT_REQUESTED';
    }).after_state).toEqual({ result: 'SUCCESS', source: 'ROTA' });
  });

  test('Employee access pagination returns 25 newest records and keeps older pages reachable', async () => {
    const values = [];
    const placeholders = [];
    for (let index = 0; index < 30; index += 1) {
      const offset = values.length;
      values.push(
        crypto.randomUUID(),
        managerUserId,
        staffProfileId,
        JSON.stringify({ result: 'SUCCESS', source: 'STAFF' }),
        index
      );
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, 'EMPLOYEE_SUMMARY_VIEWED',
          'STAFF_PROFILE', $${offset + 3}, 'Viewed Employee Summary', NULL,
          $${offset + 4}::jsonb, NOW() - ($${offset + 5}::int * INTERVAL '1 second'))`
      );
    }
    await query(
      `
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, summary,
          before_state, after_state, created_at
        )
        VALUES ${placeholders.join(', ')}
      `,
      values
    );

    const agent = await login(managerEmail, managerPassword);
    const firstPage = await agent.get('/api/v1/audit-logs/employee-access?page=1');
    const secondPage = await agent.get('/api/v1/audit-logs/employee-access?page=2');

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.logs).toHaveLength(25);
    expect(firstPage.body.pagination).toEqual(
      expect.objectContaining({
        hasNext: true,
        hasPrevious: false,
        page: 1,
        pageSize: 25
      })
    );
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.logs.length).toBeGreaterThan(0);
    expect(secondPage.body.pagination.hasPrevious).toBe(true);
  });

  test('deliberate logout clears the session and blocks later summary requests', async () => {
    const agent = await login(managerEmail, managerPassword);
    expect((await getSummary(agent)).status).toBe(200);
    expect(
      (await agent.post('/api/v1/auth/logout').set(mutationHeader).send({})).status
    ).toBe(204);
    expect((await getSummary(agent)).status).toBe(401);
  });
});
