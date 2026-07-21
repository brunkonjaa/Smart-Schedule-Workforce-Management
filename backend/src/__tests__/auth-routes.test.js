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
  const changedPassword = 'SmartScheduleChanged123!';
  const testUserId = crypto.randomUUID();
  const testStaffProfileId = crypto.randomUUID();
  const passkeyId = crypto.randomUUID();
  const testEmail = `aidanorourke${Date.now()}fake@gmail.com`;
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };

  const getCookieMaxAge = (response) => {
    const sessionCookie = response.headers['set-cookie']?.find((cookie) => {
      return cookie.startsWith('smart_schedule.sid=');
    });

    const match = sessionCookie?.match(/Max-Age=(\d+)/i);
    if (match) {
      return Number(match[1]);
    }

    const expiresMatch = sessionCookie?.match(/Expires=([^;]+)/i);
    if (!expiresMatch) {
      return null;
    }

    const expiresAt = Date.parse(expiresMatch[1]);

    if (!Number.isFinite(expiresAt)) {
      return null;
    }

    return expiresAt;
  };

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
        VALUES ($1, $2, 'Aidan O''Rourke', 'FLOOR', 40.00, '0859999999', TRUE, NOW(), NOW())
      `,
      [testStaffProfileId, testUserId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM user_passkeys WHERE id = $1', [passkeyId]);
    await query('DELETE FROM staff_profiles WHERE id = $1', [testStaffProfileId]);
    await query('DELETE FROM users WHERE id = $1', [testUserId]);
    await closePool();
  });

  test('login creates a server-side session and returns the public user', async () => {
    const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: testPassword
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Login successful.',
      user: {
        email: testEmail,
        fullName: "Aidan O'Rourke",
        id: testUserId,
        mustChangePassword: false,
        primaryRole: 'FLOOR',
        role: 'MANAGER',
        staffProfileId: testStaffProfileId
      }
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('smart_schedule.sid=')])
    );
  });

  test('login rejects invalid credentials with a generic error', async () => {
    const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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
    const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .set('Content-Type', 'application/json')
      .send('[]');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      details: ['request body must be a JSON object'],
      error: 'Validation Failed',
      message: 'The auth request contains invalid fields.'
    });
  });

  test('auth me returns the logged-in user from the session', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: testPassword
    });

    expect(loginResponse.status).toBe(200);

    const meResponse = await agent.get('/api/v1/auth/me');

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({
      user: {
        email: testEmail,
        fullName: "Aidan O'Rourke",
        id: testUserId,
        mustChangePassword: false,
        primaryRole: 'FLOOR',
        role: 'MANAGER',
        staffProfileId: testStaffProfileId
      }
    });
  });

  test('manager can start passkey registration and receives a server challenge', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: testPassword
    });

    expect(loginResponse.status).toBe(200);

    const optionsResponse = await agent
      .post('/api/v1/auth/passkeys/registration/options')
      .set(mutationHeader)
      .send({});

    expect(optionsResponse.status).toBe(200);
    expect(optionsResponse.body.options).toEqual(
      expect.objectContaining({
        challenge: expect.any(String),
        rp: expect.objectContaining({ name: 'Smart Schedule' }),
        user: expect.objectContaining({ name: testEmail })
      })
    );
  });

  test('remember me issues a longer session cookie than the default login', async () => {
    const shortSessionResponse = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: testPassword
    });
    const rememberedSessionResponse = await request(app)
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .send({
        email: testEmail,
        password: testPassword,
        rememberMe: true
      });

    expect(shortSessionResponse.status).toBe(200);
    expect(rememberedSessionResponse.status).toBe(200);
    expect(getCookieMaxAge(rememberedSessionResponse)).toBeGreaterThan(
      getCookieMaxAge(shortSessionResponse)
    );
  });

  test('logout destroys the session', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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

  test('authenticated users can change their password', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: testPassword
    });

    expect(loginResponse.status).toBe(200);

    const changePasswordResponse = await agent
      .post('/api/v1/auth/change-password')
      .set(mutationHeader)
      .send({
        currentPassword: testPassword,
        newPassword: changedPassword
      });

    expect(changePasswordResponse.status).toBe(200);
    expect(changePasswordResponse.body).toEqual({
      message: 'Password changed successfully.',
      user: {
        email: testEmail,
        fullName: "Aidan O'Rourke",
        id: testUserId,
        mustChangePassword: false,
        primaryRole: 'FLOOR',
        role: 'MANAGER',
        staffProfileId: testStaffProfileId
      }
    });

    const oldPasswordLoginResponse = await request(app)
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .send({
        email: testEmail,
        password: testPassword
      });
    const newPasswordLoginResponse = await request(app)
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .send({
        email: testEmail,
        password: changedPassword
      });

    expect(oldPasswordLoginResponse.status).toBe(401);
    expect(newPasswordLoginResponse.status).toBe(200);
  });

  test('passkey challenges cannot be used from a different session', async () => {
    await query(
      `
        INSERT INTO user_passkeys (
          id, user_id, credential_id, public_key, counter, device_name, transports
        )
        VALUES ($1, $2, $3, $4, 0, 'Challenge test passkey', ARRAY[]::TEXT[])
      `,
      [passkeyId, testUserId, crypto.randomBytes(32), crypto.randomBytes(64)]
    );
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    expect((await firstAgent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: changedPassword
    })).body.mfaRequired).toBe(true);
    expect((await secondAgent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: changedPassword
    })).body.mfaRequired).toBe(true);

    const options = await firstAgent
      .post('/api/v1/auth/passkeys/login/options')
      .set(mutationHeader)
      .send({});
    expect(options.status).toBe(200);

    const crossSession = await secondAgent
      .post('/api/v1/auth/passkeys/login/verify')
      .set(mutationHeader)
      .send({ id: 'not-used' });
    expect(crossSession.status).toBe(401);
    expect(crossSession.body.message).toContain('expired');
  });

  test('expired passkey challenges fail before credential verification', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: changedPassword
    })).body.mfaRequired).toBe(true);
    expect((await agent
      .post('/api/v1/auth/passkeys/login/options')
      .set(mutationHeader)
      .send({})).status).toBe(200);

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (6 * 60 * 1000));
    try {
      const expired = await agent
        .post('/api/v1/auth/passkeys/login/verify')
        .set(mutationHeader)
        .send({ id: 'not-used' });
      expect(expired.status).toBe(401);
      expect(expired.body.message).toContain('expired');
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('a failed passkey attempt consumes its challenge so it cannot be reused', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: testEmail,
      password: changedPassword
    })).body.mfaRequired).toBe(true);
    expect((await agent
      .post('/api/v1/auth/passkeys/login/options')
      .set(mutationHeader)
      .send({})).status).toBe(200);

    const firstAttempt = await agent
      .post('/api/v1/auth/passkeys/login/verify')
      .set(mutationHeader)
      .send({ id: 'invalid-credential' });
    expect(firstAttempt.status).toBe(401);
    expect(firstAttempt.body.message).toContain('could not be verified');

    const reused = await agent
      .post('/api/v1/auth/passkeys/login/verify')
      .set(mutationHeader)
      .send({ id: 'invalid-credential' });
    expect(reused.status).toBe(401);
    expect(reused.body.message).toContain('expired');
  });
});
