const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

jest.setTimeout(20000);

describe('auth routes', () => {
  const testPassword = 'SmartScheduleTest123!';
  const testUserId = crypto.randomUUID();
  const testStaffProfileId = crypto.randomUUID();
  const testEmail = `auth-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW())
      `,
      [testUserId, testEmail, passwordHash]
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
        VALUES ($1, $2, 'Auth Test User', 'FLOOR', 40.00, '0859999999', TRUE, NOW(), NOW())
      `,
      [testStaffProfileId, testUserId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM staff_profiles WHERE id = $1', [testStaffProfileId]);
    await query('DELETE FROM users WHERE id = $1', [testUserId]);
    await closePool();
  });

  test('login creates a server-side session and returns the public user', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Login successful.',
      user: {
        email: testEmail,
        id: testUserId,
        role: 'MANAGER',
        staffProfileId: testStaffProfileId
      }
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('smart_schedule.sid=')])
    );
  });

  test('login rejects invalid credentials with a generic error', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: testEmail,
      password: 'wrong-password'
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Authentication Failed',
      message: 'Invalid email or password.'
    });
  });

  test('login validates required fields', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'bad-email'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'password is required',
        'email must be a valid email address'
      ])
    );
  });

  test('login rejects a non-object JSON payload', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('[]');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      details: ['request body must be a JSON object'],
      error: 'Validation Failed',
      message: 'The login request is missing required fields.'
    });
  });

  test('auth me returns the logged-in user from the session', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword
    });

    expect(loginResponse.status).toBe(200);

    const meResponse = await agent.get('/api/v1/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({
      user: {
        email: testEmail,
        id: testUserId,
        role: 'MANAGER',
        staffProfileId: testStaffProfileId
      }
    });
  });

  test('logout destroys the session', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').send({
      email: testEmail,
      password: testPassword
    });

    const logoutResponse = await agent
      .post('/api/v1/auth/logout')
      .set(mutationProtectionHeaderName, '1');

    expect(logoutResponse.status).toBe(204);

    const meResponse = await agent.get('/api/v1/auth/me');

    expect(meResponse.status).toBe(401);
    expect(meResponse.body).toEqual({
      error: 'Authentication Required',
      message: 'You must be logged in to access this route.'
    });
  });
});
