const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

jest.setTimeout(20000);

const getMondayOffset = (offsetWeeks) => {
  const currentDate = new Date();
  const weekday = currentDate.getUTCDay() || 7;
  currentDate.setUTCDate(currentDate.getUTCDate() - (weekday - 1) + (offsetWeeks * 7));
  return currentDate.toISOString().slice(0, 10);
};

const getDateFromWeek = (weekStart, dayOffset) => {
  const currentDate = new Date(`${weekStart}T00:00:00Z`);
  currentDate.setUTCDate(currentDate.getUTCDate() + dayOffset);
  return currentDate.toISOString().slice(0, 10);
};

describe('shift routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const managerEmail = `shift-manager-${Date.now()}@example.com`;
  const staffEmail = `shift-staff-${Date.now()}@example.com`;
  const managerPassword = 'ShiftManager123!';
  const staffPassword = 'ShiftStaff123!';
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };
  const nextWeekStart = getMondayOffset(1);
  const nextShiftDate = getDateFromWeek(nextWeekStart, 4);

  beforeAll(async () => {
    const managerPasswordHash = await bcrypt.hash(managerPassword, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW())
      `,
      [managerId, managerEmail, managerPasswordHash, staffUserId, staffEmail, staffPasswordHash]
    );

    await query(
      `
        INSERT INTO staff_profiles (
          id,
          user_id,
          full_name,
          primary_role,
          contract_hours,
          phone_number,
          is_active,
          created_at,
          updated_at
        )
        VALUES
          ($1, $2, 'Shift Manager', 'FLOOR', 40.00, '0854000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Shift Staff', 'BAR', 28.00, '0854000002', TRUE, NOW(), NOW())
      `,
      [managerStaffProfileId, managerId, staffProfileId, staffUserId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM audit_logs WHERE actor_user_id IN ($1, $2)',
      [managerId, staffUserId]
    );
    await query('DELETE FROM shifts WHERE shift_date >= $1', [nextWeekStart]);
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2)',
      [managerStaffProfileId, staffProfileId]
    );
    await query('DELETE FROM users WHERE id IN ($1, $2)', [managerId, staffUserId]);
    await closePool();
  });

  const loginAsManager = async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').send({
      email: managerEmail,
      password: managerPassword
    });

    expect(response.status).toBe(200);
    return agent;
  };

  const loginAsStaff = async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').send({
      email: staffEmail,
      password: staffPassword
    });

    expect(response.status).toBe(200);
    return agent;
  };

  test('rejects unauthenticated shift list requests', async () => {
    const response = await request(app).get(`/api/v1/shifts?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(401);
  });

  test('rejects staff users on manager-only shift routes', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get(`/api/v1/shifts?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(403);
  });

  test('creates a shift for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/shifts')
      .set(mutationHeader)
      .send({
        endTime: '22:00',
        notes: 'Busy Friday service',
        requiredRole: 'BAR',
        shiftDate: nextShiftDate,
        startTime: '14:00',
        status: 'OPEN'
      });

    expect(response.status).toBe(201);
    expect(response.body.shift).toEqual(
      expect.objectContaining({
        requiredRole: 'BAR',
        shiftDate: nextShiftDate,
        status: 'OPEN'
      })
    );

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'SHIFT_CREATED'
        LIMIT 1
      `,
      [response.body.shift.id]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'SHIFT_CREATED',
        actor_user_id: managerId,
        before_state: null,
        entity_id: response.body.shift.id,
        entity_type: 'SHIFT'
      })
    );
    expect(auditLog.rows[0].after_state.requiredRole).toBe('BAR');
  });

  test('rejects invalid shift payloads for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/shifts')
      .set(mutationHeader)
      .send({
        endTime: '08:00',
        notes: '',
        requiredRole: 'HOST',
        shiftDate: 'bad-date',
        startTime: '09:00'
      });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'shiftDate must be a valid YYYY-MM-DD date',
        'requiredRole must be one of: FLOOR, BAR, KITCHEN, OTHER'
      ])
    );
  });

  test('lists shifts for managers by selected week', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(`/api/v1/shifts?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(200);
    expect(response.body.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requiredRole: 'BAR',
          shiftDate: nextShiftDate
        })
      ])
    );
  });

  test('updates shifts for managers', async () => {
    const createdShift = await query(
      `
        SELECT id
        FROM shifts
        WHERE shift_date = $1
          AND start_time = '14:00'
        LIMIT 1
      `,
      [nextShiftDate]
    );

    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/shifts/${createdShift.rows[0].id}`)
      .set(mutationHeader)
      .send({
        notes: 'Busy Friday service updated',
        status: 'DRAFT'
      });

    expect(response.status).toBe(200);
    expect(response.body.shift).toEqual(
      expect.objectContaining({
        notes: 'Busy Friday service updated',
        status: 'DRAFT'
      })
    );

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'SHIFT_UPDATED'
        LIMIT 1
      `,
      [createdShift.rows[0].id]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'SHIFT_UPDATED',
        actor_user_id: managerId,
        entity_id: createdShift.rows[0].id,
        entity_type: 'SHIFT'
      })
    );
    expect(auditLog.rows[0].before_state.status).toBe('OPEN');
    expect(auditLog.rows[0].after_state.status).toBe('DRAFT');
  });

  test('deletes shifts for managers', async () => {
    const createdShift = await query(
      `
        SELECT id
        FROM shifts
        WHERE shift_date = $1
          AND start_time = '14:00'
        LIMIT 1
      `,
      [nextShiftDate]
    );

    const agent = await loginAsManager();
    const response = await agent
      .delete(`/api/v1/shifts/${createdShift.rows[0].id}`)
      .set(mutationHeader);

    expect(response.status).toBe(204);

    const deletedShift = await query('SELECT id FROM shifts WHERE id = $1', [
      createdShift.rows[0].id
    ]);
    expect(deletedShift.rowCount).toBe(0);

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'SHIFT_DELETED'
        LIMIT 1
      `,
      [createdShift.rows[0].id]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'SHIFT_DELETED',
        actor_user_id: managerId,
        after_state: null,
        entity_id: createdShift.rows[0].id,
        entity_type: 'SHIFT'
      })
    );
    expect(auditLog.rows[0].before_state.status).toBe('DRAFT');
  });

  test('returns 404 for missing shift updates', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/shifts/${crypto.randomUUID()}`)
      .set(mutationHeader)
      .send({
        status: 'OPEN'
      });

    expect(response.status).toBe(404);
  });
});
