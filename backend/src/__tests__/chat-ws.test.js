const crypto = require('crypto');
const http = require('http');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { WebSocket } = require('ws');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const { setupChatWebSocket } = require('../services/chat-ws');
const { consumePasswordReset } = require('../services/password-reset-service');

jest.setTimeout(20000);

const waitForOpen = (socket) => {
  return new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
};

const waitForMessage = (socket, expectedType) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${expectedType}`)), 5000);
    const onMessage = (rawMessage) => {
      const payload = JSON.parse(rawMessage.toString());
      if (payload.type !== expectedType) {
        return;
      }
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(payload);
    };
    socket.on('message', onMessage);
  });
};

const waitForRejectedUpgrade = (socket) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for rejected upgrade')), 5000);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.once('error', finish);
    socket.once('unexpected-response', finish);
    socket.once('open', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket upgrade was unexpectedly accepted'));
    });
  });
};

const waitForClose = (socket) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for socket close')), 5000);
    socket.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
};

describe('NodyChat WebSocket authentication and lifetime checks', () => {
  const userId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const suffix = Date.now();
  const email = `roisinnolan${suffix}fake@gmail.com`;
  const password = 'NodyChatSocket123!';
  const sockets = new Set();
  let server;
  let webSocketServer;
  let origin;
  let webSocketUrl;
  let cookie;

  const createSocket = (headers = {}) => {
    const socket = new WebSocket(webSocketUrl, { headers });
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    return socket;
  };

  const loginForCookie = async (loginPassword = password) => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .send({ email, password: loginPassword });
    expect(loginResponse.status).toBe(200);
    return loginResponse.headers['set-cookie'][0].split(';')[0];
  };

  const openAuthenticatedSocket = async (sessionCookie = cookie) => {
    const socket = createSocket({ Cookie: sessionCookie, Origin: origin });
    const historyPromise = waitForMessage(socket, 'history');
    await waitForOpen(socket);
    await historyPromise;
    return socket;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [userId, email, passwordHash]
    );
    await query(
      `INSERT INTO staff_profiles (id, user_id, full_name, primary_role, contract_hours, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Roisin Nolan', 'FLOOR', 24, TRUE, NOW(), NOW())`,
      [profileId, userId]
    );

    server = http.createServer(app);
    webSocketServer = setupChatWebSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${address.port}`;
    webSocketUrl = `ws://127.0.0.1:${address.port}/ws/chat`;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1')
      .send({ email, password });
    expect(loginResponse.status).toBe(200);
    cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
  });

  afterEach(async () => {
    await query('UPDATE users SET is_active = TRUE WHERE id = $1', [userId]);
    sockets.forEach((socket) => socket.terminate());
    sockets.clear();
  });

  afterAll(async () => {
    webSocketServer.clients.forEach((socket) => socket.terminate());
    await new Promise((resolve) => webSocketServer.close(resolve));
    await new Promise((resolve) => server.close(resolve));
    await query('DELETE FROM chat_read_states WHERE user_id = $1', [userId]);
    await query('DELETE FROM chat_conversation_participants WHERE user_id = $1', [userId]);
    await query('DELETE FROM chat_messages WHERE sender_user_id = $1', [userId]);
    await query("DELETE FROM user_sessions WHERE sess::jsonb #>> '{user,id}' = $1", [userId]);
    await query('DELETE FROM staff_profiles WHERE id = $1', [profileId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);
    await closePool();
  });

  test('rejects a cross-origin WebSocket upgrade', async () => {
    const socket = createSocket({ Cookie: cookie, Origin: 'https://example.invalid' });
    await waitForRejectedUpgrade(socket);
  });

  test('rejects a same-origin upgrade without an authenticated session', async () => {
    const socket = createSocket({ Origin: origin });
    await waitForRejectedUpgrade(socket);
  });

  test('loads chat history for an authenticated same-origin connection', async () => {
    const socket = createSocket({ Cookie: cookie, Origin: origin });
    const historyPromise = waitForMessage(socket, 'history');
    await waitForOpen(socket);
    const history = await historyPromise;

    expect(history.conversations).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'WORKPLACE' })])
    );
  });

  test('closes an existing connection after the account is deactivated', async () => {
    const socket = createSocket({ Cookie: cookie, Origin: origin });
    const historyPromise = waitForMessage(socket, 'history');
    await waitForOpen(socket);
    await historyPromise;

    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [userId]);
    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    const closed = await closePromise;

    expect(closed.code).toBe(1008);
    expect(closed.reason).toBe('Session is no longer valid.');
  });

  test.each([
    ['invalid JSON', '{'],
    ['missing event type', JSON.stringify({ message: 'No event type' })],
    ['unsupported event type', JSON.stringify({ type: 'unsupported-test-action' })],
    ['empty message', JSON.stringify({ message: '', type: 'message' })]
  ])('rejects %s without saving a message', async (label, payload) => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const errorPromise = waitForMessage(socket, 'error');
    socket.send(payload);
    const error = await errorPromise;

    expect(error.message).toEqual(expect.any(String));
  });

  test('rejects binary chat data with an explicit text-frame error', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const errorPromise = waitForMessage(socket, 'error');
    socket.send(Buffer.from(JSON.stringify({ message: 'binary', type: 'message' })), {
      binary: true
    });

    await expect(errorPromise).resolves.toEqual(expect.objectContaining({
      message: 'Chat messages must use text frames.'
    }));
  });

  test('closes an oversized WebSocket frame with code 1009', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const closePromise = waitForClose(socket);
    socket.send('x'.repeat((16 * 1024) + 1));

    await expect(closePromise).resolves.toEqual(expect.objectContaining({ code: 1009 }));
  });

  test('keeps HTML and script-like message content as plain message text', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const content = '<script>window.phase2Injected = true</script><b>not markup</b>';
    const messagePromise = waitForMessage(socket, 'message');
    socket.send(JSON.stringify({ message: content, type: 'message' }));
    const saved = await messagePromise;

    expect(saved.message.message).toBe(content);
  });

  test('closes an active socket after logout destroys its session', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', currentCookie)
      .set(mutationProtectionHeaderName, '1');
    expect(logout.status).toBe(204);

    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    await expect(closePromise).resolves.toEqual(expect.objectContaining({
      code: expect.any(Number)
    }));
  });

  test('closes an active socket after session revocation', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    await query(
      'UPDATE users SET session_version = session_version + 1 WHERE id = $1',
      [userId]
    );

    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    await expect(closePromise).resolves.toEqual(expect.objectContaining({ code: 1008 }));
  });

  test('closes an active socket after absolute session expiry', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    await query(
      `UPDATE user_sessions
       SET sess = jsonb_set(
         sess::jsonb,
         '{auth,absoluteExpiresAt}',
         to_jsonb($2::text)
       )::json
       WHERE sess::jsonb #>> '{user,id}' = $1`,
      [userId, new Date(Date.now() - 1000).toISOString()]
    );

    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    await expect(closePromise).resolves.toEqual(expect.objectContaining({ code: 1008 }));
  });

  test('closes an active socket after idle expiry removes the stored session', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    await query(
      `UPDATE user_sessions SET expire = NOW() - INTERVAL '1 second'
       WHERE sess::jsonb #>> '{user,id}' = $1`,
      [userId]
    );

    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    await expect(closePromise).resolves.toEqual(expect.objectContaining({
      code: expect.any(Number)
    }));
  });

  test('closes an active socket after a password-security reset', async () => {
    const currentCookie = await loginForCookie();
    const socket = await openAuthenticatedSocket(currentCookie);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await query(
      `INSERT INTO password_reset_requests (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '20 minutes')`,
      [userId, tokenHash]
    );
    await expect(consumePasswordReset({
      newPassword: 'NodyChat reset password 456!',
      token: rawToken
    })).resolves.toEqual(expect.objectContaining({ valid: true }));

    const closePromise = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'unsupported-test-action' }));
    await expect(closePromise).resolves.toEqual(expect.objectContaining({ code: 1008 }));
  });
});
