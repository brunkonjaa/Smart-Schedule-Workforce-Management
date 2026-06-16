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

describe('availability routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const otherStaffUserId = crypto.randomUUID();
  const otherStaffProfileId = crypto.randomUUID();
  const futureAvailabilityId = crypto.randomUUID();
  const pastAvailabilityId = crypto.randomUUID();
  const otherAvailabilityId = crypto.randomUUID();
  const managerEmail = `availability-manager-${Date.now()}@example.com`;
  const staffEmail = `availability-staff-${Date.now()}@example.com`;
  const otherStaffEmail = `availability-other-${Date.now()}@example.com`;
  const managerPassword = 'AvailabilityManager123!';
  const staffPassword = 'AvailabilityStaff123!';
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };
  const currentWeekStart = getMondayOffset(0);
  const nextWeekStart = getMondayOffset(1);
  const secondNextWeekStart = getMondayOffset(2);
  const previousWeekStart = getMondayOffset(-1);

  beforeAll(async () => {
    const managerPasswordHash = await bcrypt.hash(managerPassword, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW()),
          ($7, $8, $6, 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        managerId,
        managerEmail,
        managerPasswordHash,
        staffUserId,
        staffEmail,
        staffPasswordHash,
        otherStaffUserId,
        otherStaffEmail
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
          ($1, $2, 'Availability Manager', 'FLOOR', 40.00, '0852000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Availability Staff', 'BAR', 28.00, '0852000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Availability Other', 'KITCHEN', 30.00, '0852000003', TRUE, NOW(), NOW())
      `,
      [
        managerStaffProfileId,
        managerId,
        staffProfileId,
        staffUserId,
        otherStaffProfileId,
        otherStaffUserId
      ]
    );

    await query(
      `
        INSERT INTO availability_entries (
          id,
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
          ($1, $2, $3, 1, '09:00', '17:00', 'AVAILABLE', NOW(), NOW()),
          ($4, $2, $5, 2, '08:00', '12:00', 'UNAVAILABLE', NOW(), NOW()),
          ($6, $7, $3, 1, '10:00', '18:00', 'AVAILABLE', NOW(), NOW())
      `,
      [
        futureAvailabilityId,
        staffProfileId,
        nextWeekStart,
        pastAvailabilityId,
        previousWeekStart,
        otherAvailabilityId,
        otherStaffProfileId
      ]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM availability_entries WHERE staff_profile_id IN ($1, $2)',
      [staffProfileId, otherStaffProfileId]
    );
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)',
      [managerStaffProfileId, staffProfileId, otherStaffProfileId]
    );
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3)',
      [managerId, staffUserId, otherStaffUserId]
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

  test('rejects unauthenticated availability list requests', async () => {
    const response = await request(app).get(
      `/api/v1/availability?weekStart=${nextWeekStart}`
    );

    expect(response.status).toBe(401);
  });

  test('lists only own availability for staff users', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get(`/api/v1/availability?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(200);
    expect(response.body.availability).toEqual([
      expect.objectContaining({
        id: futureAvailabilityId,
        staffProfileId,
        status: 'AVAILABLE',
        weekStart: nextWeekStart
      })
    ]);
  });

  test('lists all availability for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(`/api/v1/availability?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(200);
    expect(response.body.availability).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: futureAvailabilityId,
          fullName: 'Availability Staff'
        }),
        expect.objectContaining({
          id: otherAvailabilityId,
          fullName: 'Availability Other'
        })
      ])
    );
  });

  test('rejects staff access to another staff profile availability', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get(
      `/api/v1/availability?weekStart=${nextWeekStart}&staffProfileId=${otherStaffProfileId}`
    );

    expect(response.status).toBe(403);
  });

  test('rejects manager creation on staff-only availability routes', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/availability')
      .set(mutationHeader)
      .send({
        entries: [
          {
            dayOfWeek: 1,
            endTime: '14:00',
            startTime: '10:00',
            status: 'AVAILABLE'
          }
        ],
        weekStart: secondNextWeekStart
      });

    expect(response.status).toBe(403);
  });

  test('creates availability entries for staff users', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/availability')
      .set(mutationHeader)
      .send({
        entries: [
          {
            dayOfWeek: 3,
            endTime: '12:00',
            startTime: '08:00',
            status: 'AVAILABLE'
          },
          {
            dayOfWeek: 3,
            endTime: '18:00',
            startTime: '14:00',
            status: 'UNAVAILABLE'
          }
        ],
        weekStart: secondNextWeekStart
      });

    expect(response.status).toBe(201);
    expect(response.body.availability).toHaveLength(2);
  });

  test('rejects overlapping availability creation against existing entries', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/availability')
      .set(mutationHeader)
      .send({
        entries: [
          {
            dayOfWeek: 1,
            endTime: '11:00',
            startTime: '10:30',
            status: 'AVAILABLE'
          }
        ],
        weekStart: nextWeekStart
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'One or more availability windows overlap an existing entry for that week.'
    );
  });

  test('rejects editing another staff user availability entry', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .put(`/api/v1/availability/${otherAvailabilityId}`)
      .set(mutationHeader)
      .send({
        status: 'UNAVAILABLE'
      });

    expect(response.status).toBe(403);
  });

  test('rejects editing past availability entries', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .put(`/api/v1/availability/${pastAvailabilityId}`)
      .set(mutationHeader)
      .send({
        status: 'AVAILABLE'
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Only current or future availability entries can be changed.'
    );
  });

  test('deletes own future availability entries', async () => {
    const createdEntry = await query(
      `
        SELECT id
        FROM availability_entries
        WHERE staff_profile_id = $1
          AND week_start = $2
          AND day_of_week = 3
          AND start_time = '08:00'
        LIMIT 1
      `,
      [staffProfileId, secondNextWeekStart]
    );

    const agent = await loginAsStaff();
    const response = await agent
      .delete(`/api/v1/availability/${createdEntry.rows[0].id}`)
      .set(mutationHeader);

    expect(response.status).toBe(204);
  });
});
