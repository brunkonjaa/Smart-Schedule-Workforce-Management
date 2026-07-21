const crypto = require('crypto');
const { spawnSync } = require('child_process');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const {
  assertPasswordIsSafe,
  createPasswordHash
} = require('../services/password-security-service');

jest.setTimeout(30000);

describe('peppered Argon2id password storage', () => {
  const legacyUserId = crypto.randomUUID();
  const unchangedUserId = crypto.randomUUID();
  const legacyProfileId = crypto.randomUUID();
  const unchangedProfileId = crypto.randomUUID();
  const legacyEmail = `seamusobrien${Date.now()}fake@gmail.com`;
  const unchangedEmail = `aislingnolan${Date.now()}fake@gmail.com`;
  const legacyPassword = 'Legacy Password 123!';
  const changedPassword = 'Changed Unicode passphrase 456!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };

  beforeAll(async () => {
    const legacyHash = await bcrypt.hash(legacyPassword, 10);
    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
               ($4, $5, $3, 'STAFF', TRUE, NOW(), NOW())
      `,
      [legacyUserId, legacyEmail, legacyHash, unchangedUserId, unchangedEmail]
    );
    await query(
      `
        INSERT INTO staff_profiles (
          id, user_id, full_name, primary_role, contract_hours,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, 'Seamus O''Brien', 'FLOOR', 40, TRUE, NOW(), NOW()),
               ($3, $4, 'Aisling Nolan', 'BAR', 20, TRUE, NOW(), NOW())
      `,
      [legacyProfileId, legacyUserId, unchangedProfileId, unchangedUserId]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2)', [
      legacyProfileId,
      unchangedProfileId
    ]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [legacyUserId, unchangedUserId]);
    await closePool();
  });

  test('successful legacy login silently upgrades bcrypt to the current peppered scheme', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: legacyEmail,
      password: legacyPassword
    });
    expect(response.status).toBe(200);

    const result = await query(
      `SELECT password_hash, password_scheme, password_pepper_version
       FROM users WHERE id = $1`,
      [legacyUserId]
    );
    expect(result.rows[0].password_scheme).toBe('ARGON2ID_PEPPERED');
    expect(result.rows[0].password_pepper_version).toBe(1);
    expect(result.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  test('incorrect legacy password does not change the stored bcrypt row', async () => {
    const before = await query(
      'SELECT password_hash, password_scheme FROM users WHERE id = $1',
      [unchangedUserId]
    );
    const response = await request(app).post('/api/v1/auth/login').send({
      email: unchangedEmail,
      password: 'Incorrect legacy password'
    });
    expect(response.status).toBe(401);

    const after = await query(
      'SELECT password_hash, password_scheme FROM users WHERE id = $1',
      [unchangedUserId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(after.rows[0].password_scheme).toBe('BCRYPT');
  });

  test('the same submitted password produces independent encoded hashes', async () => {
    const first = await createPasswordHash('One shared test passphrase 123!');
    const second = await createPasswordHash('One shared test passphrase 123!');
    expect(first.passwordHash).not.toBe(second.passwordHash);
    expect(first.passwordHash).toMatch(/^\$argon2id\$/);
    expect(second.passwordHash).toMatch(/^\$argon2id\$/);
  });

  test('password change uses Argon2id and invalidates another existing session', async () => {
    const firstAgent = request.agent(app);
    const secondAgent = request.agent(app);
    expect((await firstAgent.post('/api/v1/auth/login').send({
      email: legacyEmail,
      password: legacyPassword
    })).status).toBe(200);
    expect((await secondAgent.post('/api/v1/auth/login').send({
      email: legacyEmail,
      password: legacyPassword
    })).status).toBe(200);

    const changeResponse = await firstAgent
      .post('/api/v1/auth/change-password')
      .set(mutationHeader)
      .send({ currentPassword: legacyPassword, newPassword: changedPassword });
    expect(changeResponse.status).toBe(200);
    expect((await firstAgent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await secondAgent.get('/api/v1/auth/me')).status).toBe(401);

    const row = await query(
      'SELECT password_hash, password_scheme, password_pepper_version FROM users WHERE id = $1',
      [legacyUserId]
    );
    expect(row.rows[0].password_scheme).toBe('ARGON2ID_PEPPERED');
    expect(row.rows[0].password_pepper_version).toBe(1);
    expect(row.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  test('breached-password lookup sends only the five-character SHA-1 prefix', async () => {
    const candidate = 'Known breached test passphrase 123!';
    const sha1 = crypto.createHash('sha1').update(candidate).digest('hex').toUpperCase();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `${sha1.slice(5)}:42\r\n`
    });

    await expect(assertPasswordIsSafe(candidate)).rejects.toMatchObject({
      code: 'BREACHED_PASSWORD'
    });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`);
    expect(url).not.toContain(candidate);
    expect(url).not.toContain(sha1);
    expect(options.body).toBeUndefined();
  });

  test('password creation fails with a retry message when the breach service is unavailable', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(assertPasswordIsSafe('Unavailable service passphrase 123!')).rejects.toMatchObject({
      code: 'BREACHED_PASSWORD_CHECK_UNAVAILABLE',
      message: expect.stringContaining('temporarily unavailable')
    });
  });

  test('production startup fails when the current pepper is blank', () => {
    const result = spawnSync(
      process.execPath,
      ['-e', "require('./src/config/env')"],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PASSWORD_PEPPER_CURRENT_VERSION: '1',
          PASSWORD_PEPPER_V1: ''
        }
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Production password pepper configuration is incomplete');
  });
});
