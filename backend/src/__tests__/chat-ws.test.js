const crypto = require('crypto');
const http = require('http');
const bcrypt = require('bcrypt');
const request = require('supertest');
const { WebSocket } = require('ws');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { setupChatWebSocket } = require('../services/chat-ws');

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
  const email = `chat-ws-${suffix}@example.com`;
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

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [userId, email, passwordHash]
    );
    await query(
      `INSERT INTO staff_profiles (id, user_id, full_name, primary_role, contract_hours, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Chat WebSocket Staff', 'FLOOR', 24, TRUE, NOW(), NOW())`,
      [profileId, userId]
    );

    server = http.createServer(app);
    webSocketServer = setupChatWebSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    origin = `http://127.0.0.1:${address.port}`;
    webSocketUrl = `ws://127.0.0.1:${address.port}/ws/chat`;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
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
});
