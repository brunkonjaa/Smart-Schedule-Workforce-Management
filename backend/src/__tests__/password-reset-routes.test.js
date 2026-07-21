const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');

jest.setTimeout(20000);

describe('password reset routes', () => {
  const managerId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const staffId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const managerEmail = `orlamccarthy${Date.now()}fake@gmail.com`;
  const staffEmail = `cillianbyrne${Date.now()}fake@gmail.com`;
  const oldPassword = 'ResetOldPassword123!';
  const newPassword = 'ResetNewPassword123!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };

  const login = async (email, password) => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password });
    return agent;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(oldPassword, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
              ($4, $5, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [managerId, managerEmail, passwordHash, staffId, staffEmail]
    );
    await query(
      `INSERT INTO staff_profiles (id, user_id, full_name, primary_role, contract_hours, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Orla McCarthy', 'FLOOR', 40, TRUE, NOW(), NOW()),
              ($3, $4, 'Cillian Byrne', 'BAR', 24, TRUE, NOW(), NOW())`,
      [managerProfileId, managerId, staffProfileId, staffId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM password_reset_requests WHERE user_id IN ($1, $2)', [managerId, staffId]);
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2)', [managerProfileId, staffProfileId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [managerId, staffId]);
    await closePool();
  });

  test('creates a generic reset request and exposes it only to managers', async () => {
    const response = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .set(mutationHeader)
      .send({ email: staffEmail });

    expect(response.status).toBe(202);
    expect(response.body.message).toContain('If an active account matches');

    const manager = await login(managerEmail, oldPassword);
    const managerResponse = await manager.get('/api/v1/auth/password-reset/requests');
    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: staffEmail, fullName: 'Cillian Byrne' })])
    );

    const staff = await login(staffEmail, oldPassword);
    const staffResponse = await staff.get('/api/v1/auth/password-reset/requests');
    expect(staffResponse.status).toBe(403);
  });

  test('accepts one valid reset token and rejects it when reused', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await query(
      `INSERT INTO password_reset_requests (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '20 minutes')`,
      [staffId, tokenHash]
    );

    const firstResponse = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .set(mutationHeader)
      .send({ newPassword, token: rawToken });
    expect(firstResponse.status).toBe(200);

    const secondResponse = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .set(mutationHeader)
      .send({ newPassword: 'AnotherPassword123!', token: rawToken });
    expect(secondResponse.status).toBe(400);

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: staffEmail,
      password: newPassword
    });
    expect(loginResponse.status).toBe(200);

    const storedPassword = await query(
      `SELECT password_hash, password_scheme, password_pepper_version
       FROM users WHERE id = $1`,
      [staffId]
    );
    expect(storedPassword.rows[0]).toEqual(expect.objectContaining({
      password_pepper_version: 1,
      password_scheme: 'ARGON2ID_PEPPERED'
    }));
    expect(storedPassword.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });
});
