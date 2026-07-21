const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const {
  acceptAdminInvitation,
  firstAdminEmail,
  hashSingleUseToken,
  revokeUserSessions,
  setAdminAccountActive
} = require('../services/admin-service');
const { createPasswordHash } = require('../services/password-security-service');
const { createSecurityEvent } = require('../services/security-event-service');

jest.setTimeout(30000);

describe('administrator and submission-review routes', () => {
  const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const reviewerId = crypto.randomUUID();
  const secondReviewerId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const staffId = crypto.randomUUID();
  const managerProfileId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const concurrentAdminId = crypto.randomUUID();
  const reviewerEmail = `niamhosullivan${runId}fake@gmail.com`;
  const secondReviewerEmail = `eimearmurphy${runId}fake@gmail.com`;
  const managerEmail = `maeveryan${runId}fake@gmail.com`;
  const staffEmail = `aoifebrennan${runId}fake@gmail.com`;
  const invitedEmail = `declanoconnor${runId}fake@gmail.com`;
  const acceptedEmail = `orlabyrne${runId}fake@gmail.com`;
  const expiredEmail = `siobhankelly${runId}fake@gmail.com`;
  const createdReviewerEmail = `roisinwalsh${runId}fake@gmail.com`;
  const concurrentInvitationEmail = `concurrentinvite${runId}fake@gmail.com`;
  const concurrentAdminEmail = `concurrentadmin${runId}fake@gmail.com`;
  const reviewerPassword = 'Reviewer route passphrase 123!';
  const secondReviewerPassword = 'Second reviewer passphrase 123!';
  const managerPassword = 'Manager route passphrase 123!';
  const staffPassword = 'Staff route passphrase 123!';
  const firstAdminPassword = 'First admin passphrase 123!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };
  let firstAdminId;
  let passkeyId;

  const insertUser = async ({
    displayName = null,
    email,
    id,
    isSubmissionReviewer = false,
    password,
    role
  }) => {
    const passwordRecord = await createPasswordHash(password);
    await query(
      `
        INSERT INTO users (
          id, email, display_name, password_hash, password_scheme,
          password_pepper_version, role, is_active, is_submission_reviewer,
          must_change_password, password_changed_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, FALSE, NOW(), NOW(), NOW())
      `,
      [
        id,
        email,
        displayName,
        passwordRecord.passwordHash,
        passwordRecord.passwordScheme,
        passwordRecord.passwordPepperVersion,
        role,
        isSubmissionReviewer
      ]
    );
  };

  const login = async (email, password) => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  };

  const loginReviewer = () => login(reviewerEmail, reviewerPassword);

  const reauthenticate = async (agent, password = reviewerPassword) => {
    const response = await agent
      .post('/api/v1/admin/reauthenticate')
      .set(mutationHeader)
      .send({ password });
    expect(response.status).toBe(204);
  };

  beforeAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [firstAdminEmail]);
    await insertUser({
      displayName: "Niamh O'Sullivan",
      email: reviewerEmail,
      id: reviewerId,
      isSubmissionReviewer: true,
      password: reviewerPassword,
      role: 'ADMIN'
    });
    await insertUser({
      displayName: 'Eimear Murphy',
      email: secondReviewerEmail,
      id: secondReviewerId,
      isSubmissionReviewer: true,
      password: secondReviewerPassword,
      role: 'ADMIN'
    });
    await insertUser({
      email: managerEmail,
      id: managerId,
      password: managerPassword,
      role: 'MANAGER'
    });
    await insertUser({
      email: staffEmail,
      id: staffId,
      password: staffPassword,
      role: 'STAFF'
    });
    await query(
      `
        INSERT INTO staff_profiles (
          id, user_id, full_name, primary_role, contract_hours,
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, 'Maeve Ryan', 'FLOOR', 40, TRUE, NOW(), NOW()),
               ($3, $4, 'Aoife Brennan', 'BAR', 20, TRUE, NOW(), NOW())
      `,
      [managerProfileId, managerId, staffProfileId, staffId]
    );
  });

  afterAll(async () => {
    await query(
      `DELETE FROM admin_invitations
       WHERE invited_by_admin_user_id IN ($1, $2)
          OR invited_email IN ($3, $4, $5, $6)`,
      [reviewerId, secondReviewerId, invitedEmail, acceptedEmail, expiredEmail, concurrentInvitationEmail]
    );
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2)', [
      managerProfileId,
      staffProfileId
    ]);
    await query(
      `DELETE FROM users
       WHERE id IN ($1, $2, $3, $4, $5)
          OR email IN ($6, $7, $8, $9, $10, $11, $12)`,
      [
        reviewerId,
        secondReviewerId,
        managerId,
        staffId,
        concurrentAdminId,
        firstAdminEmail,
        invitedEmail,
        acceptedEmail,
        expiredEmail,
        createdReviewerEmail,
        concurrentAdminEmail,
        concurrentInvitationEmail
      ]
    );
    await closePool();
  });

  test('migration 024 permits Admin without a staff profile and keeps its new defaults', async () => {
    const result = await query(
      `
        SELECT role, display_name, password_scheme, password_pepper_version,
               session_version, is_submission_reviewer
        FROM users WHERE id = $1
      `,
      [reviewerId]
    );
    expect(result.rows[0]).toEqual(expect.objectContaining({
      display_name: "Niamh O'Sullivan",
      is_submission_reviewer: true,
      password_pepper_version: 1,
      password_scheme: 'ARGON2ID_PEPPERED',
      role: 'ADMIN',
      session_version: 1
    }));
    expect((await query('SELECT id FROM staff_profiles WHERE user_id = $1', [reviewerId])).rowCount).toBe(0);
  });

  test('first-Admin bootstrap creates the fixed identity once and then closes', async () => {
    const firstResponse = await request(app)
      .post('/api/v1/auth/bootstrap/first-admin')
      .set(mutationHeader)
      .send({
        bootstrapToken: process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN,
        password: firstAdminPassword
      });
    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.user).toEqual(expect.objectContaining({
      displayName: 'Bruno Suric',
      email: firstAdminEmail,
      isSubmissionReviewer: false,
      role: 'ADMIN',
      staffProfileId: null
    }));
    firstAdminId = firstResponse.body.user.id;

    const secondResponse = await request(app)
      .post('/api/v1/auth/bootstrap/first-admin')
      .set(mutationHeader)
      .send({
        bootstrapToken: process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN,
        password: firstAdminPassword
      });
    expect(secondResponse.status).toBe(409);
    const status = await request(app).get('/api/v1/auth/bootstrap/admin/status');
    expect(status.body.bootstrap.bootstrapAllowed).toBe(false);
  });

  test('Staff and Manager receive 403 from Admin routes', async () => {
    const manager = await login(managerEmail, managerPassword);
    const staff = await login(staffEmail, staffPassword);
    expect((await manager.get('/api/v1/admin/accounts')).status).toBe(403);
    expect((await staff.get('/api/v1/admin/accounts')).status).toBe(403);
  });

  test('Admin does not inherit Manager rota, staff, or operational Audit Log access', async () => {
    const reviewer = await loginReviewer();
    expect((await reviewer.get('/api/v1/rota')).status).toBe(403);
    expect((await reviewer.get('/api/v1/staff')).status).toBe(403);
    expect((await reviewer.get(`/api/v1/staff/${staffProfileId}/summary`)).status).toBe(403);
    expect((await reviewer.get('/api/v1/audit-logs')).status).toBe(403);
  });

  test('normal Admin is blocked from the workspace until a passkey exists', async () => {
    const normalAdmin = await login(firstAdminEmail, firstAdminPassword);
    const response = await normalAdmin.get('/api/v1/admin/accounts');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_PASSKEY_REQUIRED');
  });

  test('only the submission reviewer can use the Admin workspace without a passkey', async () => {
    const reviewer = await loginReviewer();
    const response = await reviewer.get('/api/v1/admin/accounts');
    expect(response.status).toBe(200);
    expect(response.body.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: reviewerId, isSubmissionReviewer: true })
      ])
    );
  });

  test('normal invitation stores only a hash and exposes pending state', async () => {
    const reviewer = await loginReviewer();
    await reauthenticate(reviewer);
    const response = await reviewer
      .post('/api/v1/admin/invitations')
      .set(mutationHeader)
      .send({ displayName: "Declan O'Connor", email: invitedEmail });
    expect(response.status).toBe(201);
    expect(response.body.invitation.status).toBe('PENDING');

    const result = await query(
      'SELECT token_hash FROM admin_invitations WHERE invited_email = $1',
      [invitedEmail]
    );
    expect(result.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(response.body)).not.toContain(result.rows[0].token_hash);
  });

  test('invitation token expires and cannot be reused after it is consumed', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiredToken = crypto.randomBytes(32).toString('hex');
    await query(
      `
        INSERT INTO admin_invitations (
          invited_email, display_name, token_hash,
          invited_by_admin_user_id, expires_at, created_at
        )
        VALUES ($1, 'Orla Byrne', $2, $3, NOW() + INTERVAL '20 minutes', NOW()),
               ($4, 'Siobhan Kelly', $5, $3, NOW() - INTERVAL '1 second', NOW() - INTERVAL '2 minutes')
      `,
      [
        acceptedEmail,
        hashSingleUseToken(rawToken),
        reviewerId,
        expiredEmail,
        hashSingleUseToken(expiredToken)
      ]
    );
    const first = await request(app)
      .post('/api/v1/auth/admin-invitations/accept')
      .set(mutationHeader)
      .send({ password: 'Accepted admin passphrase 123!', token: rawToken });
    expect(first.status).toBe(200);
    expect(first.body.passkeySetupRequired).toBe(true);

    const reused = await request(app)
      .post('/api/v1/auth/admin-invitations/accept')
      .set(mutationHeader)
      .send({ password: 'Accepted admin passphrase 123!', token: rawToken });
    expect(reused.status).toBe(400);
    const expired = await request(app)
      .post('/api/v1/auth/admin-invitations/accept')
      .set(mutationHeader)
      .send({ password: 'Expired admin passphrase 123!', token: expiredToken });
    expect(expired.status).toBe(400);

    const stored = await query(
      `SELECT used_at, token_hash FROM admin_invitations WHERE invited_email = $1`,
      [acceptedEmail]
    );
    expect(stored.rows[0].used_at).not.toBeNull();
    expect(stored.rows[0].token_hash).toBe(hashSingleUseToken(rawToken));
    expect(stored.rows[0].token_hash).not.toBe(rawToken);
  });

  test('migration 025 prevents an invitation from being used and cancelled', async () => {
    await expect(query(
      `
        INSERT INTO admin_invitations (
          invited_email, display_name, token_hash,
          invited_by_admin_user_id, expires_at, used_at, cancelled_at
        )
        VALUES ($1, 'Colm O''Neill', $2, $3, NOW() + INTERVAL '20 minutes', NOW(), NOW())
      `,
      [
        `colmoneill${runId}fake@gmail.com`,
        hashSingleUseToken(crypto.randomBytes(32).toString('hex')),
        reviewerId
      ]
    )).rejects.toMatchObject({ code: '23514' });
  });

  test('reviewer creation is account-specific and uses the same Argon2id storage', async () => {
    const reviewer = await loginReviewer();
    await reauthenticate(reviewer);
    const response = await reviewer
      .post('/api/v1/admin/submission-reviewers')
      .set(mutationHeader)
      .send({
        displayName: 'Roisin Walsh',
        email: createdReviewerEmail,
        password: 'Created reviewer passphrase 123!'
      });
    expect(response.status).toBe(201);
    expect(response.body.user).toEqual(expect.objectContaining({
      isSubmissionReviewer: true,
      mustChangePassword: false,
      role: 'ADMIN'
    }));

    const row = await query(
      `SELECT password_hash, password_scheme, password_pepper_version,
              must_change_password, is_submission_reviewer
       FROM users WHERE email = $1`,
      [createdReviewerEmail]
    );
    expect(row.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(row.rows[0].password_scheme).toBe('ARGON2ID_PEPPERED');
    expect(row.rows[0].password_pepper_version).toBe(1);
    expect(row.rows[0].must_change_password).toBe(false);
    expect(row.rows[0].is_submission_reviewer).toBe(true);
  });

  test('the final active non-review Admin cannot be disabled or demoted', async () => {
    const reviewer = await loginReviewer();
    await reauthenticate(reviewer);
    const disable = await reviewer
      .post(`/api/v1/admin/accounts/${firstAdminId}/disable`)
      .set(mutationHeader)
      .send({});
    expect(disable.status).toBe(409);

    const demote = await reviewer
      .post(`/api/v1/admin/accounts/${firstAdminId}/role`)
      .set(mutationHeader)
      .send({ role: 'MANAGER' });
    expect(demote.status).toBe(409);
  });

  test('active-status and role changes invalidate the target sessions', async () => {
    const targetReviewer = await login(secondReviewerEmail, secondReviewerPassword);
    const reviewer = await loginReviewer();
    await reauthenticate(reviewer);
    const disabled = await reviewer
      .post(`/api/v1/admin/accounts/${secondReviewerId}/disable`)
      .set(mutationHeader)
      .send({});
    expect(disabled.status).toBe(200);
    expect((await targetReviewer.get('/api/v1/auth/me')).status).toBe(401);

    const manager = await login(managerEmail, managerPassword);
    const roleChanged = await reviewer
      .post(`/api/v1/admin/accounts/${managerId}/role`)
      .set(mutationHeader)
      .send({ role: 'ADMIN' });
    expect(roleChanged.status).toBe(200);
    expect((await manager.get('/api/v1/auth/me')).status).toBe(401);
    await query(
      `UPDATE users SET role = 'MANAGER', session_version = session_version + 1 WHERE id = $1`,
      [managerId]
    );
  });

  test('session and passkey revocation invalidate the target session', async () => {
    const reviewer = await loginReviewer();
    await reauthenticate(reviewer);
    const enabled = await reviewer
      .post(`/api/v1/admin/accounts/${secondReviewerId}/enable`)
      .set(mutationHeader)
      .send({});
    expect(enabled.status).toBe(200);

    const targetReviewer = await login(secondReviewerEmail, secondReviewerPassword);
    passkeyId = crypto.randomUUID();
    await query(
      `
        INSERT INTO user_passkeys (
          id, user_id, credential_id, public_key, counter, device_name, transports
        )
        VALUES ($1, $2, $3, $4, 0, 'Test passkey', ARRAY[]::TEXT[])
      `,
      [passkeyId, secondReviewerId, crypto.randomBytes(32), crypto.randomBytes(64)]
    );

    const laterLogin = await request(app).post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: secondReviewerEmail,
      password: secondReviewerPassword
    });
    expect(laterLogin.status).toBe(200);
    expect(laterLogin.body.mfaRequired).toBe(true);

    const revokedPasskey = await reviewer
      .post(`/api/v1/admin/accounts/${secondReviewerId}/passkeys/${passkeyId}/revoke`)
      .set(mutationHeader)
      .send({});
    expect(revokedPasskey.status).toBe(200);
    expect((await targetReviewer.get('/api/v1/auth/me')).status).toBe(401);

    const freshTarget = await login(secondReviewerEmail, secondReviewerPassword);
    const revokedSessions = await reviewer
      .post(`/api/v1/admin/accounts/${secondReviewerId}/revoke-sessions`)
      .set(mutationHeader)
      .send({});
    expect(revokedSessions.status).toBe(200);
    expect((await freshTarget.get('/api/v1/auth/me')).status).toBe(401);
  });

  test('security-event metadata removes password, token, pepper, and session fields', async () => {
    await createSecurityEvent({
      actorUserId: reviewerId,
      eventType: 'SECURITY_METADATA_REDACTION_TEST',
      metadata: {
        password: 'value-not-to-store',
        nested: { invitationToken: 'value-not-to-store', safeReason: 'TEST' },
        pepperVersion: 1,
        sessionId: 'value-not-to-store'
      },
      outcome: 'SUCCESS',
      targetUserId: reviewerId
    });
    const result = await query(
      `SELECT metadata FROM security_events
       WHERE event_type = 'SECURITY_METADATA_REDACTION_TEST'
       ORDER BY created_at DESC LIMIT 1`
    );
    expect(result.rows[0].metadata).toEqual({ nested: { safeReason: 'TEST' } });
  });

  test('two simultaneous attempts can consume one Admin invitation only once', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await query(
      `
        INSERT INTO admin_invitations (
          invited_email, display_name, token_hash,
          invited_by_admin_user_id, expires_at, created_at
        )
        VALUES ($1, 'Concurrent Invite', $2, $3, NOW() + INTERVAL '20 minutes', NOW())
      `,
      [concurrentInvitationEmail, hashSingleUseToken(rawToken), reviewerId]
    );

    const results = await Promise.all([
      acceptAdminInvitation({ password: 'Concurrent invitation passphrase 123!', token: rawToken }),
      acceptAdminInvitation({ password: 'Concurrent invitation passphrase 123!', token: rawToken })
    ]);

    expect(results.filter((result) => result.valid)).toHaveLength(1);
    expect(results.filter((result) => !result.valid)).toHaveLength(1);
    expect((await query('SELECT id FROM users WHERE email = $1', [concurrentInvitationEmail])).rowCount).toBe(1);
  });

  test('simultaneous Admin disables leave one active non-review Admin', async () => {
    await insertUser({
      displayName: 'Concurrent Admin',
      email: concurrentAdminEmail,
      id: concurrentAdminId,
      password: 'Concurrent admin passphrase 123!',
      role: 'ADMIN'
    });

    const results = await Promise.allSettled([
      setAdminAccountActive({
        actorUserId: reviewerId,
        isActive: false,
        targetUserId: firstAdminId
      }),
      setAdminAccountActive({
        actorUserId: reviewerId,
        isActive: false,
        targetUserId: concurrentAdminId
      })
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected').reason.code).toBe('FINAL_ADMIN_REQUIRED');
    const activeCount = await query(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE role = 'ADMIN' AND is_active = TRUE AND is_submission_reviewer = FALSE`
    );
    expect(activeCount.rows[0].count).toBe(1);
  });

  test('Admin session reset rolls back if its required security event cannot be written', async () => {
    const before = await query('SELECT session_version FROM users WHERE id = $1', [staffId]);
    const triggerName = 'phase2_fail_admin_security_event';
    const functionName = 'phase2_fail_admin_security_event_fn';

    await query(`
      CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        IF NEW.event_type = 'SESSIONS_REVOKED' AND NEW.target_user_id = '${staffId}'::uuid THEN
          RAISE EXCEPTION 'phase 2 forced security-event failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await query(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON security_events
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `);

    try {
      await expect(revokeUserSessions({
        actorUserId: reviewerId,
        targetUserId: staffId
      })).rejects.toThrow('phase 2 forced security-event failure');
    } finally {
      await query(`DROP TRIGGER IF EXISTS ${triggerName} ON security_events`);
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }

    const after = await query('SELECT session_version FROM users WHERE id = $1', [staffId]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
