const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');

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

describe('shift recommendation routes', () => {
  const nextWeekStart = getMondayOffset(7);
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const inactiveUserId = crypto.randomUUID();
  const inactiveStaffProfileId = crypto.randomUUID();
  const wrongRoleUserId = crypto.randomUUID();
  const wrongRoleStaffProfileId = crypto.randomUUID();
  const managerEmail = `recommendation-route-manager-${Date.now()}@example.com`;
  const staffEmail = `recommendation-route-staff-${Date.now()}@example.com`;
  const inactiveEmail = `recommendation-route-inactive-${Date.now()}@example.com`;
  const wrongRoleEmail = `recommendation-route-wrong-${Date.now()}@example.com`;
  const managerPassword = 'RecommendationManager123!';
  const staffPassword = 'RecommendationStaff123!';
  const openShiftId = crypto.randomUUID();
  const assignedShiftId = crypto.randomUUID();
  const closedShiftId = crypto.randomUUID();
  const noEligibleShiftId = crypto.randomUUID();
  const openShiftDate = getDateFromWeek(nextWeekStart, 1);
  const assignedShiftDate = getDateFromWeek(nextWeekStart, 2);
  const closedShiftDate = getDateFromWeek(nextWeekStart, 3);
  const noEligibleShiftDate = getDateFromWeek(nextWeekStart, 4);

  beforeAll(async () => {
    const managerPasswordHash = await bcrypt.hash(managerPassword, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW()),
          ($7, $8, 'hash', 'STAFF', FALSE, NOW(), NOW()),
          ($9, $10, 'hash', 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        managerId,
        managerEmail,
        managerPasswordHash,
        staffUserId,
        staffEmail,
        staffPasswordHash,
        inactiveUserId,
        inactiveEmail,
        wrongRoleUserId,
        wrongRoleEmail
      ]
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
          ($1, $2, 'Recommendation Route Manager', 'FLOOR', 40.00, '0857200001', TRUE, NOW(), NOW()),
          ($3, $4, 'Recommendation Route Staff', 'BAR', 24.00, '0857200002', TRUE, NOW(), NOW()),
          ($5, $6, 'Recommendation Route Inactive', 'BAR', 24.00, '0857200003', TRUE, NOW(), NOW()),
          ($7, $8, 'Recommendation Route Wrong Role', 'FLOOR', 24.00, '0857200004', TRUE, NOW(), NOW())
      `,
      [
        managerStaffProfileId,
        managerId,
        staffProfileId,
        staffUserId,
        inactiveStaffProfileId,
        inactiveUserId,
        wrongRoleStaffProfileId,
        wrongRoleUserId
      ]
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
          ($1, $2, '14:00', '22:00', 'BAR', 'OPEN', 'Recommendation route open shift', NOW(), NOW()),
          ($3, $4, '12:00', '20:00', 'BAR', 'OPEN', 'Recommendation route assigned shift', NOW(), NOW()),
          ($5, $6, '12:00', '20:00', 'BAR', 'DRAFT', 'Recommendation route closed shift', NOW(), NOW()),
          ($7, $8, '12:00', '20:00', 'KITCHEN', 'OPEN', 'Recommendation route no eligible shift', NOW(), NOW())
      `,
      [
        openShiftId,
        openShiftDate,
        assignedShiftId,
        assignedShiftDate,
        closedShiftId,
        closedShiftDate,
        noEligibleShiftId,
        noEligibleShiftDate
      ]
    );

    await query(
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
        VALUES
          ($1, $2, 2, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($1, $2, 3, '10:00', '22:00', 'AVAILABLE', NOW(), NOW())
      `,
      [staffProfileId, nextWeekStart]
    );

    await query(
      `
        INSERT INTO shift_assignments (
          id,
          shift_id,
          staff_profile_id,
          assigned_by_user_id,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `,
      [crypto.randomUUID(), assignedShiftId, staffProfileId, managerId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM audit_logs WHERE actor_user_id = $1',
      [managerId]
    );
    await query(
      'DELETE FROM shift_assignments WHERE shift_id = $1',
      [assignedShiftId]
    );
    await query(
      'DELETE FROM availability_entries WHERE staff_profile_id = $1',
      [staffProfileId]
    );
    await query(
      'DELETE FROM shifts WHERE id IN ($1, $2, $3, $4)',
      [openShiftId, assignedShiftId, closedShiftId, noEligibleShiftId]
    );
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2, $3, $4)',
      [
        managerStaffProfileId,
        staffProfileId,
        inactiveStaffProfileId,
        wrongRoleStaffProfileId
      ]
    );
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3, $4)',
      [managerId, staffUserId, inactiveUserId, wrongRoleUserId]
    );
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

  test('rejects unauthenticated recommendation requests', async () => {
    const response = await request(app).get(
      `/api/v1/shifts/${openShiftId}/recommendations`
    );

    expect(response.status).toBe(401);
  });

  test('rejects staff users on recommendation requests', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get(
      `/api/v1/shifts/${openShiftId}/recommendations`
    );

    expect(response.status).toBe(403);
  });

  test('returns ranked recommendations for an open shift', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/shifts/${openShiftId}/recommendations`
    );

    expect(response.status).toBe(200);
    expect(response.body.shift).toEqual(
      expect.objectContaining({
        date: openShiftDate,
        endTime: '22:00',
        id: openShiftId,
        requiredRole: 'BAR',
        startTime: '14:00'
      })
    );
    expect(response.body.recommendations).toEqual([
      expect.objectContaining({
        contractHours: 24,
        currentWeeklyHours: 8,
        name: 'Recommendation Route Staff',
        projectedWeeklyHours: 16,
        score: 125,
        staffId: staffProfileId
      })
    ]);
    expect(response.body.recommendations[0].email).toBeUndefined();
    expect(response.body.recommendations[0].userId).toBeUndefined();
    expect(response.body.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Recommendation Route Inactive',
          reason: expect.objectContaining({
            code: 'STAFF_NOT_ACTIVE'
          })
        }),
        expect.objectContaining({
          name: 'Recommendation Route Wrong Role',
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_ROLE_CONFLICT'
          })
        })
      ])
    );

    const assignmentCount = await query(
      'SELECT COUNT(*)::int AS total FROM shift_assignments WHERE shift_id = $1',
      [openShiftId]
    );
    expect(assignmentCount.rows[0].total).toBe(0);
  });

  test('returns 404 for unknown shifts', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/shifts/${crypto.randomUUID()}/recommendations`
    );

    expect(response.status).toBe(404);
  });

  test('rejects non-open shifts', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/shifts/${closedShiftId}/recommendations`
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'Only open shifts can be recommended.'
    });
  });

  test('rejects shifts that already have an assignment', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/shifts/${assignedShiftId}/recommendations`
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This shift already has an assignment.'
    });
  });

  test('returns an empty eligible list when no staff can take the shift', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/shifts/${noEligibleShiftId}/recommendations`
    );

    expect(response.status).toBe(200);
    expect(response.body.recommendations).toEqual([]);
    expect(response.body.excluded.length).toBeGreaterThan(0);
  });
});
