const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

jest.setTimeout(20000);

const getDateOffset = (offsetDays) => {
  const currentDate = new Date();
  currentDate.setUTCDate(currentDate.getUTCDate() + offsetDays);
  return currentDate.toISOString().slice(0, 10);
};

describe('leave request routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const otherStaffUserId = crypto.randomUUID();
  const otherStaffProfileId = crypto.randomUUID();
  const pendingLeaveId = crypto.randomUUID();
  const approvedLeaveId = crypto.randomUUID();
  const managerEmail = `leave-manager-${Date.now()}@example.com`;
  const staffEmail = `leave-staff-${Date.now()}@example.com`;
  const otherStaffEmail = `leave-other-${Date.now()}@example.com`;
  const managerPassword = 'LeaveManager123!';
  const staffPassword = 'LeaveStaff123!';
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
          ($1, $2, 'Leave Manager', 'FLOOR', 40.00, '0853000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Leave Staff', 'BAR', 28.00, '0853000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Leave Other', 'KITCHEN', 30.00, '0853000003', TRUE, NOW(), NOW())
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
        INSERT INTO leave_requests (
          id,
          staff_profile_id,
          start_date,
          end_date,
          reason,
          status,
          decided_by_user_id,
          decided_at,
          created_at,
          updated_at
        )
        VALUES
          ($1, $2, $3, $4, 'Family event', 'PENDING', NULL, NULL, NOW(), NOW()),
          ($5, $6, $7, $8, 'Approved leave', 'APPROVED', $9, NOW(), NOW(), NOW())
      `,
      [
        pendingLeaveId,
        staffProfileId,
        getDateOffset(10),
        getDateOffset(12),
        approvedLeaveId,
        otherStaffProfileId,
        getDateOffset(14),
        getDateOffset(15),
        managerId
      ]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM leave_requests WHERE staff_profile_id IN ($1, $2)',
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

  test('rejects unauthenticated leave list requests', async () => {
    const response = await request(app).get('/api/v1/leave-requests');

    expect(response.status).toBe(401);
  });

  test('lists only own leave requests for staff users', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get('/api/v1/leave-requests');

    expect(response.status).toBe(200);
    expect(response.body.leaveRequests).toEqual([
      expect.objectContaining({
        id: pendingLeaveId,
        staffProfileId
      })
    ]);
  });

  test('lists all leave requests for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent.get('/api/v1/leave-requests?status=ALL');

    expect(response.status).toBe(200);
    expect(response.body.leaveRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pendingLeaveId,
          fullName: 'Leave Staff'
        }),
        expect.objectContaining({
          id: approvedLeaveId,
          fullName: 'Leave Other'
        })
      ])
    );
  });

  test('creates a leave request for staff users', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/leave-requests')
      .set(mutationHeader)
      .send({
        endDate: getDateOffset(22),
        reason: 'Annual leave',
        startDate: getDateOffset(20)
      });

    expect(response.status).toBe(201);
    expect(response.body.leaveRequest).toEqual(
      expect.objectContaining({
        reason: 'Annual leave',
        staffProfileId,
        status: 'PENDING'
      })
    );
  });

  test('withdraws own pending leave requests for staff users', async () => {
    const createdLeaveRequest = await query(
      `
        INSERT INTO leave_requests (
          id,
          staff_profile_id,
          start_date,
          end_date,
          reason,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'Withdraw test', 'PENDING', NOW(), NOW())
        RETURNING id
      `,
      [crypto.randomUUID(), staffProfileId, getDateOffset(24), getDateOffset(25)]
    );

    const agent = await loginAsStaff();
    const response = await agent
      .delete(`/api/v1/leave-requests/${createdLeaveRequest.rows[0].id}`)
      .set(mutationHeader);

    expect(response.status).toBe(204);

    const deletedLeaveRequest = await query(
      'SELECT id FROM leave_requests WHERE id = $1',
      [createdLeaveRequest.rows[0].id]
    );
    expect(deletedLeaveRequest.rowCount).toBe(0);
  });

  test('rejects overlapping leave requests for staff users', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/leave-requests')
      .set(mutationHeader)
      .send({
        endDate: getDateOffset(11),
        reason: 'Duplicate leave',
        startDate: getDateOffset(10)
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'This leave request overlaps an existing pending or approved request.'
    );
  });

  test('prevents staff users from approving leave requests', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .put(`/api/v1/leave-requests/${pendingLeaveId}/approve`)
      .set(mutationHeader)
      .send({});

    expect(response.status).toBe(403);
  });

  test('approves pending leave requests for managers', async () => {
    const createdLeaveRequest = await query(
      `
        SELECT id
        FROM leave_requests
        WHERE staff_profile_id = $1
          AND reason = 'Annual leave'
        LIMIT 1
      `,
      [staffProfileId]
    );

    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/leave-requests/${createdLeaveRequest.rows[0].id}/approve`)
      .set(mutationHeader)
      .send({
        managerComment: 'Approved and noted.'
      });

    expect(response.status).toBe(200);
    expect(response.body.leaveRequest.status).toBe('APPROVED');
    expect(response.body.leaveRequest.managerComment).toBe('Approved and noted.');
  });

  test('rejects deciding already-approved leave requests', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/leave-requests/${approvedLeaveId}/reject`)
      .set(mutationHeader)
      .send({
        managerComment: 'Already closed'
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Only pending leave requests can be decided.'
    );
  });
});
