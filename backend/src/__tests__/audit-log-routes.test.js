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
  const managerEmail = `saoirseryan${Date.now()}fake@gmail.com`;
  const staffEmail = `eoinbyrne${Date.now()}fake@gmail.com`;
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
          ($1, $2, 'Saoirse Ryan', 'FLOOR', 40.00, '0854000011', TRUE, NOW(), NOW()),
          ($3, $4, 'Eoin Byrne', 'BAR', 28.00, '0854000012', TRUE, NOW(), NOW())
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
        actorName: 'Saoirse Ryan',
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
    expect(response.body.pagination).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: 1
      })
    );
  });

  test('returns 25 Rota activity records per page and keeps older records reachable', async () => {
    const agent = await login(managerEmail, managerPassword);
    const values = [];
    const placeholders = [];

    for (let index = 0; index < 30; index += 1) {
      const offset = values.length;
      values.push(
        crypto.randomUUID(),
        managerId,
        crypto.randomUUID(),
        `Paged audit record ${index + 1}`,
        JSON.stringify({
          fullName: 'Eoin Byrne',
          shiftDate: '2026-07-21',
          staffProfileId
        })
      );
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, 'ASSIGNMENT_CREATED', 'ASSIGNMENT', `
        + `$${offset + 3}, $${offset + 4}, NULL, $${offset + 5}::jsonb, NOW())`
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

    const firstPage = await agent.get('/api/v1/audit-logs?page=1');
    const secondPage = await agent.get('/api/v1/audit-logs?page=2');

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

  test.each([
    { field: 'limit', path: '/api/v1/audit-logs?limit=not-a-number' },
    { field: 'page', path: '/api/v1/audit-logs?page=0' }
  ])('rejects an invalid $field query', async ({ path }) => {
    const agent = await login(managerEmail, managerPassword);
    const response = await agent.get(path);

    expect(response.status).toBe(400);
  });
});
