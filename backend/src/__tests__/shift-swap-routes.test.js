const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');

jest.setTimeout(20000);

describe('shift swap routes', () => {
  const managerId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const requesterId = crypto.randomUUID();
  const requesterProfileId = crypto.randomUUID();
  const targetId = crypto.randomUUID();
  const targetProfileId = crypto.randomUUID();
  const shiftId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const managerEmail = `swap-manager-${Date.now()}@example.com`;
  const requesterEmail = `swap-requester-${Date.now()}@example.com`;
  const targetEmail = `swap-target-${Date.now()}@example.com`;
  const password = 'SwapPassword123!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };

  const mondayInFuture = () => {
    const date = new Date();
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 8);
    return date.toISOString().slice(0, 10);
  };

  const login = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password });
    return agent;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    const shiftDate = mondayInFuture();
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
              ($4, $5, $3, 'STAFF', TRUE, NOW(), NOW()),
              ($6, $7, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [managerId, managerEmail, passwordHash, requesterId, requesterEmail, targetId, targetEmail]
    );
    await query(
      `INSERT INTO staff_profiles (id, user_id, full_name, primary_role, contract_hours, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Swap Manager', 'FLOOR', 40, TRUE, NOW(), NOW()),
              ($3, $4, 'Swap Requester', 'BAR', 24, TRUE, NOW(), NOW()),
              ($5, $6, 'Swap Target', 'BAR', 24, TRUE, NOW(), NOW())`,
      [managerProfileId, managerId, requesterProfileId, requesterId, targetProfileId, targetId]
    );
    await query(
      `INSERT INTO shifts (id, shift_date, start_time, end_time, required_role, status, notes, created_at, updated_at)
       VALUES ($1, $2, '12:00', '20:00', 'BAR', 'OPEN', 'Swap route test', NOW(), NOW())`,
      [shiftId, shiftDate]
    );
    await query(
      `INSERT INTO shift_assignments (id, shift_id, staff_profile_id, assigned_by_user_id, assigned_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())`,
      [assignmentId, shiftId, requesterProfileId, managerId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM shift_swap_requests WHERE assignment_id = $1', [assignmentId]);
    await query('DELETE FROM shift_assignments WHERE id = $1', [assignmentId]);
    await query('DELETE FROM shifts WHERE id = $1', [shiftId]);
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)', [managerProfileId, requesterProfileId, targetProfileId]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3)', [managerId, requesterId, targetId]);
    await closePool();
  });

  test('allows the assigned staff member to request and the target to accept a swap', async () => {
    const requester = await login(requesterEmail);
    const createResponse = await requester
      .post('/api/v1/shift-swaps')
      .set(mutationHeader)
      .send({ assignmentId, targetStaffProfileId: targetProfileId, reason: 'Personal appointment' });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.request.status).toBe('PENDING');

    const target = await login(targetEmail);
    const targetList = await target.get('/api/v1/shift-swaps');
    expect(targetList.status).toBe(200);
    expect(targetList.body.requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createResponse.body.request.id })])
    );

    const acceptResponse = await target
      .post(`/api/v1/shift-swaps/${createResponse.body.request.id}/accept`)
      .set(mutationHeader)
      .send({});
    expect(acceptResponse.status).toBe(200);

    const manager = await login(managerEmail);
    const approveResponse = await manager
      .put(`/api/v1/shift-swaps/${createResponse.body.request.id}/approve`)
      .set(mutationHeader)
      .send({});
    expect(approveResponse.status).toBe(200);

    const assignment = await query('SELECT staff_profile_id FROM shift_assignments WHERE id = $1', [assignmentId]);
    expect(assignment.rows[0].staff_profile_id).toBe(targetProfileId);
  });
});
