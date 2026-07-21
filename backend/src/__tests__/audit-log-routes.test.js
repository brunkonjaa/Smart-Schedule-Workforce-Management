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
    const response = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({ email, password });
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

  test('first, middle, final and beyond-final pages have explicit outcomes', async () => {
    const agent = await login(managerEmail, managerPassword);
    const first = await agent.get('/api/v1/audit-logs?page=1&limit=10');
    expect(first.status).toBe(200);
    const totalPages = first.body.pagination.totalPages;
    const middlePage = Math.max(1, Math.ceil(totalPages / 2));

    const middle = await agent.get(`/api/v1/audit-logs?page=${middlePage}&limit=10`);
    const final = await agent.get(`/api/v1/audit-logs?page=${totalPages}&limit=10`);
    const beyond = await agent.get(`/api/v1/audit-logs?page=${totalPages + 1}&limit=10`);

    expect(middle.status).toBe(200);
    expect(middle.body.pagination.page).toBe(middlePage);
    expect(final.status).toBe(200);
    expect(final.body.pagination).toEqual(expect.objectContaining({
      hasNext: false,
      page: totalPages
    }));
    expect(beyond.status).toBe(400);
    expect(beyond.body.details).toContain('page is beyond the available Rota activity records');
  });

  test('equal timestamps keep a stable descending UUID order', async () => {
    const lowerId = '00000000-0000-4000-8000-000000000001';
    const higherId = '00000000-0000-4000-8000-000000000002';
    const timestamp = '2099-01-01T12:00:00.000Z';
    await query(
      `INSERT INTO audit_logs (
         id, actor_user_id, action, entity_type, entity_id, summary,
         before_state, after_state, created_at
       ) VALUES
         ($1, $3, 'SHIFT_CREATED', 'SHIFT', $4, 'Stable lower', NULL, NULL, $5),
         ($2, $3, 'SHIFT_CREATED', 'SHIFT', $6, 'Stable higher', NULL, NULL, $5)`,
      [lowerId, higherId, managerId, crypto.randomUUID(), timestamp, crypto.randomUUID()]
    );

    const agent = await login(managerEmail, managerPassword);
    const response = await agent.get('/api/v1/audit-logs?limit=200');
    const stableIds = response.body.logs
      .filter((record) => [lowerId, higherId].includes(record.id))
      .map((record) => record.id);
    expect(stableIds).toEqual([higherId, lowerId]);
  });

  test('normal application routes do not expose audit update or delete operations', async () => {
    const agent = await login(managerEmail, managerPassword);
    const auditId = crypto.randomUUID();
    expect((await agent.put(`/api/v1/audit-logs/${auditId}`).send({})).status).toBe(404);
    expect((await agent.delete(`/api/v1/audit-logs/${auditId}`)).status).toBe(404);
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
