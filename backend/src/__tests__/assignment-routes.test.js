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

describe('assignment routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const managerEmail = `assignment-manager-${Date.now()}@example.com`;
  const staffEmail = `assignment-staff-${Date.now()}@example.com`;
  const managerPassword = 'AssignmentManager123!';
  const staffPassword = 'AssignmentStaff123!';
  const assignableShiftId = crypto.randomUUID();
  const duplicateShiftId = crypto.randomUUID();
  const nextWeekStart = getMondayOffset(2);
  const assignableShiftDate = getDateFromWeek(nextWeekStart, 4);
  const duplicateShiftDate = getDateFromWeek(nextWeekStart, 5);
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };

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
          ($1, $2, 'Assignment Manager', 'FLOOR', 40.00, '0855000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Assignment Staff', 'BAR', 28.00, '0855000002', TRUE, NOW(), NOW())
      `,
      [managerStaffProfileId, managerId, staffProfileId, staffUserId]
    );

    await query(
      `
        INSERT INTO shifts (
          id,
          shift_date,
          start_time,
          end_time,
          required_role,
          status,
          notes,
          created_at,
          updated_at
        )
        VALUES
          ($1, $2, '14:00', '22:00', 'BAR', 'OPEN', 'Assignment route test', NOW(), NOW()),
          ($3, $4, '09:00', '17:00', 'BAR', 'OPEN', 'Duplicate assignment route test', NOW(), NOW())
      `,
      [assignableShiftId, assignableShiftDate, duplicateShiftId, duplicateShiftDate]
    );

    await query(
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
      `,
      [duplicateShiftId, staffProfileId, managerId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2)',
      [assignableShiftId, duplicateShiftId]
    );
    await query(
      'DELETE FROM shifts WHERE id IN ($1, $2)',
      [assignableShiftId, duplicateShiftId]
    );
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

  test('rejects unauthenticated assignment requests', async () => {
    const response = await request(app)
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(401);
  });

  test('rejects staff users on manager-only assignment routes', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(403);
  });

  test('requires the mutation protection header on assignment creation', async () => {
    const agent = await loginAsManager();
    const response = await agent.post('/api/v1/assignments').send({
      shiftId: assignableShiftId,
      staffProfileId
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'This request is missing the required mutation protection header.'
    });
  });

  test('creates a shift assignment for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Shift assignment created successfully.');
    expect(response.body.assignment).toEqual(
      expect.objectContaining({
        assignedByUserId: managerId,
        endTime: '22:00:00',
        fullName: 'Assignment Staff',
        requiredRole: 'BAR',
        shiftDate: assignableShiftDate,
        shiftId: assignableShiftId,
        staffProfileId,
        startTime: '14:00:00'
      })
    );
  });

  test('rejects duplicate assignment for the same shift', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: duplicateShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This shift already has an assignment.'
    });
  });

  test('rejects invalid assignment payloads', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        notes: 'unexpected',
        shiftId: 'bad-shift',
        staffProfileId: 'bad-staff'
      });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported fields: notes',
        'shiftId must be a valid UUID',
        'staffProfileId must be a valid UUID'
      ])
    );
  });
});
