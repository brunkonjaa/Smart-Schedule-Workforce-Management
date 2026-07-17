const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const { mutationProtectionHeaderName } = require('../middleware/request-security');
const { markChatMessagesRead } = require('../services/chat-service');

jest.setTimeout(20000);

describe('NodyChat routes and read states', () => {
  const firstUserId = crypto.randomUUID();
  const firstProfileId = crypto.randomUUID();
  const secondUserId = crypto.randomUUID();
  const secondProfileId = crypto.randomUUID();
  const outsiderUserId = crypto.randomUUID();
  const outsiderProfileId = crypto.randomUUID();
  const suffix = Date.now();
  const firstEmail = `chat-first-${suffix}@example.com`;
  const secondEmail = `chat-second-${suffix}@example.com`;
  const outsiderEmail = `chat-outsider-${suffix}@example.com`;
  const password = 'NodyChatPassword123!';
  const mutationHeader = { [mutationProtectionHeaderName]: '1' };
  let directConversationId;

  const login = async (email) => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
              ($4, $5, $3, 'STAFF', TRUE, NOW(), NOW()),
              ($6, $7, $3, 'STAFF', TRUE, NOW(), NOW())`,
      [firstUserId, firstEmail, passwordHash, secondUserId, secondEmail, outsiderUserId, outsiderEmail]
    );
    await query(
      `INSERT INTO staff_profiles (id, user_id, full_name, primary_role, contract_hours, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Chat Manager', 'FLOOR', 40, TRUE, NOW(), NOW()),
              ($3, $4, 'Chat Bar Staff', 'BAR', 24, TRUE, NOW(), NOW()),
              ($5, $6, 'Chat Outsider', 'KITCHEN', 24, TRUE, NOW(), NOW())`,
      [firstProfileId, firstUserId, secondProfileId, secondUserId, outsiderProfileId, outsiderUserId]
    );
  });

  afterAll(async () => {
    if (directConversationId) {
      await query('DELETE FROM chat_conversations WHERE id = $1', [directConversationId]);
    }
    await query('DELETE FROM chat_read_states WHERE user_id IN ($1, $2, $3)', [firstUserId, secondUserId, outsiderUserId]);
    await query('DELETE FROM chat_conversation_participants WHERE user_id IN ($1, $2, $3)', [firstUserId, secondUserId, outsiderUserId]);
    await query('DELETE FROM chat_messages WHERE sender_user_id IN ($1, $2, $3)', [firstUserId, secondUserId, outsiderUserId]);
    await query('DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)', [firstProfileId, secondProfileId, outsiderProfileId]);
    await query('DELETE FROM users WHERE id IN ($1, $2, $3)', [firstUserId, secondUserId, outsiderUserId]);
    await closePool();
  });

  test('joins current users to the workplace conversation during bootstrap', async () => {
    const first = await login(firstEmail);
    const response = await first.get('/api/v1/chat/messages');

    expect(response.status).toBe(200);
    expect(response.body.conversations).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'WORKPLACE' })])
    );
    const membership = await query(
      `SELECT 1 FROM chat_conversation_participants AS participants
       INNER JOIN chat_conversations AS conversations ON conversations.id = participants.conversation_id
       WHERE participants.user_id = $1 AND conversations.kind = 'WORKPLACE'`,
      [firstUserId]
    );
    expect(membership.rowCount).toBe(1);
  });

  test('creates one reusable direct conversation for the two participants', async () => {
    const first = await login(firstEmail);
    const createResponse = await first
      .post('/api/v1/chat/conversations')
      .set(mutationHeader)
      .send({ userId: secondUserId });

    expect(createResponse.status).toBe(201);
    directConversationId = createResponse.body.conversation.id;
    expect(createResponse.body.conversation).toEqual(expect.objectContaining({ kind: 'DIRECT' }));

    const second = await login(secondEmail);
    const reverseResponse = await second
      .post('/api/v1/chat/conversations')
      .set(mutationHeader)
      .send({ userId: firstUserId });
    expect(reverseResponse.status).toBe(201);
    expect(reverseResponse.body.conversation.id).toBe(directConversationId);
  });

  test('tracks an unread direct message and clears it only for a participant', async () => {
    const first = await login(firstEmail);
    const sendResponse = await first
      .post('/api/v1/chat/messages')
      .set(mutationHeader)
      .send({ conversationId: directConversationId, message: 'Can you cover the late bar close?' });

    expect(sendResponse.status).toBe(201);
    const messageId = sendResponse.body.message.id;

    const second = await login(secondEmail);
    const unreadResponse = await second.get(`/api/v1/chat/messages?conversationId=${directConversationId}`);
    expect(unreadResponse.status).toBe(200);
    expect(unreadResponse.body.unreadCount).toBe(1);
    expect(unreadResponse.body.firstUnreadMessageId).toBe(messageId);

    expect(await markChatMessagesRead(outsiderUserId, messageId)).toBe(false);
    const outsiderReadState = await query(
      'SELECT 1 FROM chat_read_states WHERE user_id = $1 AND conversation_id = $2',
      [outsiderUserId, directConversationId]
    );
    expect(outsiderReadState.rowCount).toBe(0);

    expect(await markChatMessagesRead(secondUserId, messageId)).toEqual(
      expect.objectContaining({ conversation_id: directConversationId })
    );
    const readResponse = await second.get(`/api/v1/chat/messages?conversationId=${directConversationId}`);
    expect(readResponse.body.unreadCount).toBe(0);
    expect(readResponse.body.firstUnreadMessageId).toBeNull();
  });

  test('blocks a non-participant from sending to or opening a direct conversation', async () => {
    const outsider = await login(outsiderEmail);
    const sendResponse = await outsider
      .post('/api/v1/chat/messages')
      .set(mutationHeader)
      .send({ conversationId: directConversationId, message: 'This must not be stored.' });

    expect(sendResponse.status).toBe(403);
    expect(sendResponse.body.error).toBe('Forbidden');

    const bootstrapResponse = await outsider.get(`/api/v1/chat/messages?conversationId=${directConversationId}`);
    expect(bootstrapResponse.status).toBe(200);
    expect(bootstrapResponse.body.conversationId).not.toBe(directConversationId);
    expect(bootstrapResponse.body.conversations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: directConversationId })])
    );

    const forbiddenMessage = await query(
      `SELECT 1 FROM chat_messages WHERE conversation_id = $1 AND sender_user_id = $2`,
      [directConversationId, outsiderUserId]
    );
    expect(forbiddenMessage.rowCount).toBe(0);
  });

  test('rejects direct conversations with the same user', async () => {
    const first = await login(firstEmail);
    const response = await first
      .post('/api/v1/chat/conversations')
      .set(mutationHeader)
      .send({ userId: firstUserId });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Failed');
  });
});
