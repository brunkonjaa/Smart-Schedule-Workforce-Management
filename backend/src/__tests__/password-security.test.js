const crypto = require('crypto');
const { spawnSync } = require('child_process');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const config = require('../config/env');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const {
  assertPasswordIsSafe,
  createPasswordHash,
  getBreachedPasswordCount,
  validatePassword,
  verifyPassword
} = require('../services/password-security-service');

jest.setTimeout(30000);

describe('peppered Argon2id password storage', () => {
  const legacyUserId = crypto.randomUUID();
  const unchangedUserId = crypto.randomUUID();
  const rotationUserId = crypto.randomUUID();
  const failureUserId = crypto.randomUUID();
  const legacyProfileId = crypto.randomUUID();
  const unchangedProfileId = crypto.randomUUID();
  const rotationProfileId = crypto.randomUUID();
  const failureProfileId = crypto.randomUUID();
  const legacyEmail = `seamusobrien${Date.now()}fake@gmail.com`;
  const unchangedEmail = `aislingnolan${Date.now()}fake@gmail.com`;
  const rotationEmail = `pepperrotation${Date.now()}fake@gmail.com`;
  const failureEmail = `bcryptrollback${Date.now()}fake@gmail.com`;
  const legacyPassword = 'Legacy Password 123!';
  const changedPassword = 'Changed Unicode passphrase 456!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };

  beforeAll(async () => {
    const legacyHash = await bcrypt.hash(legacyPassword, 10);
    const rotationHash = await createPasswordHash(legacyPassword, 1);
    await query(
      `
        INSERT INTO users (
          id, email, password_hash, password_scheme, password_pepper_version,
          role, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'BCRYPT', NULL, 'MANAGER', TRUE, NOW(), NOW()),
               ($4, $5, $3, 'BCRYPT', NULL, 'STAFF', TRUE, NOW(), NOW()),
               ($6, $7, $8, 'ARGON2ID_PEPPERED', 1, 'STAFF', TRUE, NOW(), NOW()),
               ($9, $10, $3, 'BCRYPT', NULL, 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        legacyUserId,
        legacyEmail,
        legacyHash,
        unchangedUserId,
        unchangedEmail,
        rotationUserId,
        rotationEmail,
        rotationHash.passwordHash,
        failureUserId,
        failureEmail
      ]
    );
    await query(
      `
        INSERT INTO staff_profiles (
          id, user_id, full_name, primary_role, contract_hours,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, 'Seamus O''Brien', 'FLOOR', 40, TRUE, NOW(), NOW()),
               ($3, $4, 'Aisling Nolan', 'BAR', 20, TRUE, NOW(), NOW()),
               ($5, $6, 'Pepper Rotation', 'BAR', 20, TRUE, NOW(), NOW()),
               ($7, $8, 'Bcrypt Rollback', 'BAR', 20, TRUE, NOW(), NOW())
      `,
      [
        legacyProfileId,
        legacyUserId,
        unchangedProfileId,
        unchangedUserId,
        rotationProfileId,
        rotationUserId,
        failureProfileId,
        failureUserId
      ]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2, $3, $4)', [
      legacyProfileId,
      unchangedProfileId,
      rotationProfileId,
      failureProfileId
    ]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3, $4)', [
      legacyUserId,
      unchangedUserId,
      rotationUserId,
      failureUserId
    ]);
    await closePool();
  });

  test('successful legacy login silently upgrades bcrypt to the current peppered scheme', async () => {
    const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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
    const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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

  test('pepper v1 hashes verify and successful login rotates them to v2', async () => {
    const originalCurrentVersion = config.passwordPepperCurrentVersion;
    process.env.PASSWORD_PEPPER_V2 = crypto.randomBytes(32).toString('base64url');
    config.passwordPepperCurrentVersion = 2;

    try {
      const before = await query(
        'SELECT password_hash FROM users WHERE id = $1',
        [rotationUserId]
      );
      await expect(verifyPassword({
        password: legacyPassword,
        passwordHash: before.rows[0].password_hash,
        passwordPepperVersion: 1,
        passwordScheme: 'ARGON2ID_PEPPERED'
      })).resolves.toBe(true);

      const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
        email: rotationEmail,
        password: legacyPassword
      });
      expect(response.status).toBe(200);

      const after = await query(
        `SELECT password_hash, password_scheme, password_pepper_version
         FROM users WHERE id = $1`,
        [rotationUserId]
      );
      expect(after.rows[0].password_scheme).toBe('ARGON2ID_PEPPERED');
      expect(after.rows[0].password_pepper_version).toBe(2);
      expect(after.rows[0].password_hash).not.toBe(before.rows[0].password_hash);
    } finally {
      config.passwordPepperCurrentVersion = originalCurrentVersion;
      delete process.env.PASSWORD_PEPPER_V2;
    }
  });

  test('removing the previous pepper produces a controlled verification failure', async () => {
    const currentPepper = process.env.PASSWORD_PEPPER_V1;
    const passwordRecord = await createPasswordHash('Previous pepper test 123!', 1);
    delete process.env.PASSWORD_PEPPER_V1;

    try {
      await expect(verifyPassword({
        password: 'Previous pepper test 123!',
        passwordHash: passwordRecord.passwordHash,
        passwordPepperVersion: 1,
        passwordScheme: 'ARGON2ID_PEPPERED'
      })).rejects.toMatchObject({ code: 'PASSWORD_PEPPER_UNAVAILABLE' });
    } finally {
      process.env.PASSWORD_PEPPER_V1 = currentPepper;
    }
  });

  test('database failure after bcrypt verification rolls back without corrupting the hash', async () => {
    const before = await query(
      'SELECT password_hash, password_scheme, password_pepper_version FROM users WHERE id = $1',
      [failureUserId]
    );
    const triggerName = 'phase2_fail_password_upgrade';
    const functionName = 'phase2_fail_password_upgrade_fn';

    await query(`
      CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'phase 2 forced password update failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await query(`
      CREATE TRIGGER ${triggerName}
      BEFORE UPDATE ON users
      FOR EACH ROW
      WHEN (OLD.id = '${failureUserId}'::uuid)
      EXECUTE FUNCTION ${functionName}()
    `);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
        email: failureEmail,
        password: legacyPassword
      });
      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
      await query(`DROP TRIGGER IF EXISTS ${triggerName} ON users`);
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    const after = await query(
      'SELECT password_hash, password_scheme, password_pepper_version FROM users WHERE id = $1',
      [failureUserId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
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
    expect((await firstAgent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: legacyEmail,
      password: legacyPassword
    })).status).toBe(200);
    expect((await secondAgent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
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

  test('password validation covers missing, short and overlong input', () => {
    expect(validatePassword(undefined)).toEqual(['password is required']);
    expect(validatePassword('too short')).toEqual([
      'password must be at least 15 characters long'
    ]);
    expect(validatePassword('x'.repeat(129))).toEqual([
      'password must be 128 characters or fewer'
    ]);
    expect(validatePassword('Long enough password 123!')).toEqual([]);
  });

  test('a non-matching breach range returns zero', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '00000000000000000000000000000000000:7\r\n'
    });

    await expect(getBreachedPasswordCount('Not in this range 123!')).resolves.toBe(0);
  });

  test('a malformed breach count is treated as zero', async () => {
    const candidate = 'Malformed breach count 123!';
    const sha1 = crypto.createHash('sha1').update(candidate).digest('hex').toUpperCase();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `${sha1.slice(5)}:not-a-number\r\n`
    });

    await expect(getBreachedPasswordCount(candidate)).resolves.toBe(0);
  });

  test('a non-success breach-service response produces the controlled unavailable error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(getBreachedPasswordCount('Breach service 503 test 123!'))
      .rejects.toMatchObject({ code: 'BREACHED_PASSWORD_CHECK_UNAVAILABLE' });
  });

  test('unsupported schemes and malformed Argon2 hashes fail without authenticating', async () => {
    await expect(verifyPassword({
      password: 'Unsupported scheme password 123!',
      passwordHash: 'unused',
      passwordPepperVersion: 1,
      passwordScheme: 'UNKNOWN'
    })).resolves.toBe(false);
    await expect(verifyPassword({
      password: 'Malformed hash password 123!',
      passwordHash: 'not-an-argon-hash',
      passwordPepperVersion: 1,
      passwordScheme: 'ARGON2ID_PEPPERED'
    })).resolves.toBe(false);
  });

  test('legacy bcrypt remains the default verification scheme', async () => {
    const passwordHash = await bcrypt.hash('Default bcrypt scheme 123!', 10);
    await expect(verifyPassword({
      password: 'Default bcrypt scheme 123!',
      passwordHash
    })).resolves.toBe(true);
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
