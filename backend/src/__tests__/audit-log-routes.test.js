const bcrypt = require('bcrypt');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');

jest.setTimeout(20000);

describe('audit log routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const shiftId = crypto.randomUUID();
  const managerEmail = `audit-manager-${Date.now()}@example.com`;
  const staffEmail = `audit-staff-${Date.now()}@example.com`;
  const managerPassword = 'AuditManager123!';
  const staffPassword = 'AuditStaff123!';

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
          id, user_id, full_name, primary_role, contract_hours, phone_number,
          is_active, created_at, updated_at
        )
        VALUES
          ($1, $2, 'Audit Manager', 'FLOOR', 40.00, '0854000011', TRUE, NOW(), NOW()),
          ($3, $4, 'Audit Staff', 'BAR', 28.00, '0854000012', TRUE, NOW(), NOW())
      `,
      [managerStaffProfileId, managerId, staffProfileId, staffUserId]
    );

    await query(
      `
        INSERT INTO audit_logs (
          id, actor_user_id, action, entity_type, entity_id, summary,
          before_state, after_state, created_at
        )
        VALUES ($1, $2, 'SHIFT_CREATED', 'SHIFT', $3, 'Created test audit shift', $4::jsonb, $5::jsonb, NOW())
      `,
      [
        crypto.randomUUID(),
        managerId,
        shiftId,
        null,
        JSON.stringify({ status: 'OPEN', requiredRole: 'BAR' })
      ]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM audit_logs WHERE actor_user_id IN ($1, $2)', [managerId, staffUserId]);
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2)', [managerStaffProfileId, staffProfileId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [managerId, staffUserId]);
    await closePool();
  });

  const login = async (email, password) => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  };

  test('requires an authenticated manager', async () => {
    const response = await request(app).get('/api/v1/audit-logs');

    expect(response.status).toBe(401);
  });

  test('rejects staff users', async () => {
    const agent = await login(staffEmail, staffPassword);
    const response = await agent.get('/api/v1/audit-logs');

    expect(response.status).toBe(403);
  });

  test('returns audit records to managers with before and after state', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await agent.get('/api/v1/audit-logs?limit=1');

    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(1);
    expect(response.body.logs[0]).toEqual(
      expect.objectContaining({
        action: 'SHIFT_CREATED',
        actorEmail: managerEmail,
        actorName: 'Audit Manager',
        beforeState: null,
        entityId: shiftId,
        entityType: 'SHIFT',
        summary: 'Created test audit shift'
      })
    );
    expect(response.body.logs[0].afterState).toEqual({
      status: 'OPEN',
      requiredRole: 'BAR'
    });
  });

  test('rejects an invalid limit', async () => {
    const agent = await login(managerEmail, managerPassword);
    const response = await agent.get('/api/v1/audit-logs?limit=not-a-number');

    expect(response.status).toBe(400);
  });
});
