const crypto = require('crypto');
const bcrypt = require('bcrypt');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { requireAuth, requireRole } = require('../middleware/auth');
const { closePool, query } = require('../config/db');
const { sessionCookieName } = require('../config/session');

jest.setTimeout(20000);

const buildTestApp = () => {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      name: sessionCookieName,
      secret: 'smart-schedule-auth-middleware-test-secret',
      resave: false,
      saveUninitialized: false
    })
  );

  app.post('/test/login', (request, response, next) => {
    request.session.user = {
      email: request.body.email,
      id: request.body.id,
      role: request.body.role,
      staffProfileId: request.body.staffProfileId
    };

    request.session.save((error) => {
      if (error) {
        next(error);
        return;
      }

      response.status(204).send();
    });
  });

  app.get('/test/protected', requireAuth, (request, response) => {
    response.status(200).json({
      user: request.authUser
    });
  });

  app.get('/test/manager-only', requireRole('MANAGER'), (request, response) => {
    response.status(200).json({
      user: request.authUser
    });
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(500).json({
      error: 'Internal Server Error'
    });
  });

  return app;
};

describe('auth middleware', () => {
  const app = buildTestApp();
  const activeUserId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const inactiveUserId = crypto.randomUUID();
  const activeStaffProfileId = crypto.randomUUID();
  const staffUserProfileId = crypto.randomUUID();
  const inactiveStaffProfileId = crypto.randomUUID();
  const passwordHashValue = 'SmartScheduleTest123!';
  const activeEmail = `middleware-active-${Date.now()}@example.com`;
  const staffEmail = `middleware-staff-${Date.now()}@example.com`;
  const inactiveEmail = `middleware-inactive-${Date.now()}@example.com`;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(passwordHashValue, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW())
      `,
      [activeUserId, activeEmail, passwordHash]
    );

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())
      `,
      [staffUserId, staffEmail, passwordHash]
    );

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())
      `,
      [inactiveUserId, inactiveEmail, passwordHash]
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
        VALUES ($1, $2, 'Middleware Staff User', 'BAR', 30.00, '0856666666', TRUE, NOW(), NOW())
      `,
      [staffUserProfileId, staffUserId]
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
        VALUES ($1, $2, 'Middleware Active User', 'FLOOR', 40.00, '0858888888', TRUE, NOW(), NOW())
      `,
      [activeStaffProfileId, activeUserId]
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
        VALUES ($1, $2, 'Middleware Inactive User', 'BAR', 20.00, '0857777777', TRUE, NOW(), NOW())
      `,
      [inactiveStaffProfileId, inactiveUserId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)', [
      activeStaffProfileId,
      staffUserProfileId,
      inactiveStaffProfileId
    ]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3)', [
      activeUserId,
      staffUserId,
      inactiveUserId
    ]);
    await closePool();
  });

  test('rejects requests with no authenticated session', async () => {
    const response = await request(app).get('/test/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Authentication Required',
      message: 'You must be logged in to access this route.'
    });
  });

  test('loads the authenticated user and exposes it on the request', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/test/login').send({
      email: activeEmail,
      id: activeUserId,
      role: 'MANAGER',
      staffProfileId: activeStaffProfileId
    });

    expect(loginResponse.status).toBe(204);

    const protectedResponse = await agent.get('/test/protected');

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body).toEqual({
      user: {
        email: activeEmail,
        fullName: 'Middleware Active User',
        id: activeUserId,
        mustChangePassword: false,
        primaryRole: 'FLOOR',
        role: 'MANAGER',
        staffProfileId: activeStaffProfileId
      }
    });
  });

  test('requireRole rejects unauthenticated requests', async () => {
    const response = await request(app).get('/test/manager-only');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Authentication Required',
      message: 'You must be logged in to access this route.'
    });
  });

  test('requireRole rejects authenticated users without the allowed role', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/test/login').send({
      email: staffEmail,
      id: staffUserId,
      role: 'STAFF',
      staffProfileId: staffUserProfileId
    });

    expect(loginResponse.status).toBe(204);

    const protectedResponse = await agent.get('/test/manager-only');

    expect(protectedResponse.status).toBe(403);
    expect(protectedResponse.body).toEqual({
      error: 'Forbidden',
      message: 'You do not have permission to access this route.'
    });
  });

  test('requireRole allows authenticated users with the allowed role', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/test/login').send({
      email: activeEmail,
      id: activeUserId,
      role: 'MANAGER',
      staffProfileId: activeStaffProfileId
    });

    expect(loginResponse.status).toBe(204);

    const protectedResponse = await agent.get('/test/manager-only');

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body).toEqual({
      user: {
        email: activeEmail,
        fullName: 'Middleware Active User',
        id: activeUserId,
        mustChangePassword: false,
        primaryRole: 'FLOOR',
        role: 'MANAGER',
        staffProfileId: activeStaffProfileId
      }
    });
  });

  test('invalidates the session when the stored user is no longer active', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/test/login').send({
      email: inactiveEmail,
      id: inactiveUserId,
      role: 'STAFF',
      staffProfileId: inactiveStaffProfileId
    });

    expect(loginResponse.status).toBe(204);

    await query(
      `
        UPDATE users
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [inactiveUserId]
    );

    const protectedResponse = await agent.get('/test/protected');

    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body).toEqual({
      error: 'Authentication Required',
      message: 'Your session is no longer valid.'
    });
    expect(protectedResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('smart_schedule.sid=;')])
    );

    const secondResponse = await agent.get('/test/protected');

    expect(secondResponse.status).toBe(401);
    expect(secondResponse.body).toEqual({
      error: 'Authentication Required',
      message: 'You must be logged in to access this route.'
    });
  });
});
