const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const app = require('../app');
const {
  buildHelmetOptions,
  buildWebSocketOrigin,
  configureTrustProxy
} = require('../config/http-security');
const { buildSessionCookieOptions } = require('../config/session');
const { requestErrorHandler } = require('../middleware/error-handler');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

describe('HTTP security configuration', () => {
  test('health identifies the exact Render release without exposing arbitrary values', async () => {
    const previousCommit = process.env.RENDER_GIT_COMMIT;
    process.env.RENDER_GIT_COMMIT = '0123456789abcdef0123456789abcdef01234567';

    try {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        database: 'connected',
        releaseCommit: '0123456789abcdef0123456789abcdef01234567',
        status: 'ok'
      });
    } finally {
      if (previousCommit === undefined) {
        delete process.env.RENDER_GIT_COMMIT;
      } else {
        process.env.RENDER_GIT_COMMIT = previousCommit;
      }
    }
  });

  test('serves the intended browser security headers without broad CSP sources', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains; preload'
    );
    expect(response.headers['x-powered-by']).toBeUndefined();

    const policy = response.headers['content-security-policy'];
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).not.toContain('*');
    expect(policy).not.toContain("'unsafe-inline'");
  });

  test('uses the exact hosted WebSocket origin and one trusted proxy hop', () => {
    const hostedUrl = 'https://smart-schedule-workforce-management.onrender.com';
    const options = buildHelmetOptions(hostedUrl);

    expect(buildWebSocketOrigin(hostedUrl)).toBe(
      'wss://smart-schedule-workforce-management.onrender.com'
    );
    expect(options.contentSecurityPolicy.directives.connectSrc).toEqual([
      "'self'",
      'wss://smart-schedule-workforce-management.onrender.com'
    ]);

    const proxyApp = express();
    configureTrustProxy(proxyApp, 'production');
    expect(proxyApp.get('trust proxy')).toBe(1);
  });

  test('production session cookies use Secure, HttpOnly and SameSite=Lax', () => {
    expect(buildSessionCookieOptions('production')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true
    });
  });

  test('rejects JSON bodies above 32 KB and form bodies above 10 KB', async () => {
    const oversizedJson = await request(app)
      .post('/api/v1/auth/login')
      .set(mutationProtectionHeaderName, '1')
      .send({
        email: 'oversized@example.test',
        password: 'x'.repeat(33 * 1024)
      });
    const oversizedForm = await request(app)
      .post('/api/v1/auth/login')
      .set(mutationProtectionHeaderName, '1')
      .type('form')
      .send({
        email: 'oversized@example.test',
        password: 'x'.repeat(11 * 1024)
      });

    [oversizedJson, oversizedForm].forEach((response) => {
      expect(response.status).toBe(413);
      expect(response.body).toEqual({
        error: 'Payload Too Large',
        message: 'The request body is larger than the server limit.'
      });
    });
  });

  test('requires mutation protection on login and every declared mutating route', async () => {
    const missingHeader = await request(app).post('/api/v1/auth/login').send({
      email: 'missing-header@example.test',
      password: 'not-used'
    });
    expect(missingHeader.status).toBe(403);

    const routesDirectory = path.resolve(__dirname, '../routes');
    const routeFiles = fs.readdirSync(routesDirectory)
      .filter((fileName) => fileName.endsWith('.js'));
    const missingProtection = [];
    let routeCount = 0;

    routeFiles.forEach((fileName) => {
      const source = fs.readFileSync(path.join(routesDirectory, fileName), 'utf8');
      const routePattern = /router\.(post|put|patch|delete)\(([\s\S]*?)asyncHandler/g;
      let match;

      while ((match = routePattern.exec(source)) !== null) {
        routeCount += 1;
        if (!match[2].includes('requireMutationProtection')) {
          const routePath = match[2].match(/['"]([^'"]+)['"]/)?.[1] || 'unknown route';
          missingProtection.push(`${fileName}: ${match[1].toUpperCase()} ${routePath}`);
        }
      }
    });

    expect(routeCount).toBeGreaterThan(20);
    expect(missingProtection).toEqual([]);
  });

  test('malformed JSON and server errors do not expose internal details', async () => {
    const malformedJson = await request(app)
      .post('/api/v1/auth/login')
      .set(mutationProtectionHeaderName, '1')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(malformedJson.status).toBe(400);
    expect(JSON.stringify(malformedJson.body)).not.toMatch(
      /stack|SELECT|C:\\|DATABASE_URL|SESSION_SECRET/i
    );

    const internalError = new Error(
      'connect ECONNREFUSED database.internal:5432 at C:\\private\\db.js using SESSION_SECRET'
    );
    const fakeRequest = {
      method: 'POST',
      originalUrl: '/api/v1/staff'
    };
    const fakeResponse = {
      headersSent: false,
      json: jest.fn(),
      status: jest.fn()
    };
    fakeResponse.status.mockReturnValue(fakeResponse);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      requestErrorHandler(internalError, fakeRequest, fakeResponse, jest.fn());
      expect(fakeResponse.status).toHaveBeenCalledWith(500);
      expect(fakeResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'The server could not complete this request.'
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[request-error]',
        expect.objectContaining({ message: internalError.message })
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
