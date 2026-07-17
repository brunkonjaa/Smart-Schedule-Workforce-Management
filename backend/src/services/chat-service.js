const { query } = require('../config/db');

const maxMessageLength = 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeMessage = (value) => typeof value === 'string'
  ? value.replace(/\r\n/g, '\n').trim()
  : '';

const validateChatMessage = (payload) => {
  const message = normalizeMessage(payload?.message);
  const details = [];
  if (!message) details.push('message is required');
  else if (message.length > maxMessageLength) details.push(`message must be ${maxMessageLength} characters or fewer`);
  return { details, message };
};

const mapChatMessage = (record) => ({
  conversationId: record.conversation_id,
  createdAt: record.created_at,
  id: record.id,
  message: record.message,
  sender: {
    fullName: record.sender_full_name || record.sender_email,
    id: record.sender_user_id,
    role: record.sender_role
  }
});

const mapPerson = (record) => ({
  email: record.email,
  fullName: record.full_name || record.email,
  id: record.id,
  primaryRole: record.primary_role,
  role: record.role
});

const getWorkplaceConversation = async () => {
  const result = await query(`SELECT id, kind FROM chat_conversations WHERE kind = 'WORKPLACE' LIMIT 1`);
  return result.rows[0] || null;
};

const ensureWorkplaceParticipant = async (userId, conversationId) => {
  await query(
    `INSERT INTO chat_conversation_participants (conversation_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [conversationId, userId]
  );
};

const getConversationForUser = async (userId, conversationId) => {
  if (!uuidPattern.test(String(conversationId || ''))) return null;
  const result = await query(
    `SELECT conversations.id, conversations.kind
     FROM chat_conversations AS conversations
     INNER JOIN chat_conversation_participants AS participants
       ON participants.conversation_id = conversations.id
     WHERE conversations.id = $1 AND participants.user_id = $2`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
};

const listChatPeople = async (userId) => {
  const result = await query(
    `SELECT users.id, users.email, users.role, staff_profiles.full_name, staff_profiles.primary_role
     FROM users
     LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
     WHERE users.id <> $1
       AND users.is_active = TRUE
       AND (staff_profiles.user_id IS NULL OR staff_profiles.is_active = TRUE)
     ORDER BY COALESCE(staff_profiles.full_name, users.email) ASC`,
    [userId]
  );
  return result.rows.map(mapPerson);
};

const getDirectConversation = async (userId, otherUserId) => {
  if (!uuidPattern.test(String(otherUserId || '')) || String(userId) === String(otherUserId)) return null;
  const people = await query(
    `SELECT users.id, users.email, users.role, staff_profiles.full_name, staff_profiles.primary_role
     FROM users
     LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
     WHERE users.id = $1 AND users.is_active = TRUE
       AND (staff_profiles.user_id IS NULL OR staff_profiles.is_active = TRUE)`,
    [otherUserId]
  );
  if (!people.rows[0]) return null;

  const directKey = [String(userId), String(otherUserId)].sort().join(':');
  await query(
    `INSERT INTO chat_conversations (kind, direct_key)
     VALUES ('DIRECT', $1)
     ON CONFLICT (direct_key) WHERE kind = 'DIRECT' DO NOTHING`,
    [directKey]
  );
  const conversationResult = await query(
    `SELECT id, kind FROM chat_conversations WHERE direct_key = $1`,
    [directKey]
  );
  const conversation = conversationResult.rows[0];
  await query(
    `INSERT INTO chat_conversation_participants (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT DO NOTHING`,
    [conversation.id, userId, otherUserId]
  );
  return { ...conversation, other: mapPerson(people.rows[0]) };
};

const listChatConversations = async (userId) => {
  const result = await query(
    `SELECT
       conversations.id,
       conversations.kind,
       other_users.id AS other_id,
       other_users.email AS other_email,
       other_users.role AS other_role,
       other_profiles.full_name AS other_full_name,
       other_profiles.primary_role AS other_primary_role,
       latest.message AS latest_message,
       latest.created_at AS latest_created_at,
       COALESCE(unread.unread_count, 0)::INTEGER AS unread_count
     FROM chat_conversations AS conversations
     INNER JOIN chat_conversation_participants AS mine
       ON mine.conversation_id = conversations.id AND mine.user_id = $1
     LEFT JOIN LATERAL (
       SELECT participant.user_id
       FROM chat_conversation_participants AS participant
       WHERE participant.conversation_id = conversations.id AND participant.user_id <> $1
       LIMIT 1
     ) AS other_participant ON TRUE
     LEFT JOIN users AS other_users ON other_users.id = other_participant.user_id
     LEFT JOIN staff_profiles AS other_profiles ON other_profiles.user_id = other_users.id
     LEFT JOIN LATERAL (
       SELECT message, created_at
       FROM chat_messages
       WHERE conversation_id = conversations.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) AS latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(messages.id)::INTEGER AS unread_count
       FROM chat_messages AS messages
       LEFT JOIN chat_read_states AS reads
         ON reads.user_id = $1 AND reads.conversation_id = conversations.id
       LEFT JOIN chat_messages AS last_read ON last_read.id = reads.last_read_message_id
       WHERE messages.conversation_id = conversations.id
         AND messages.sender_user_id <> $1
         AND (last_read.id IS NULL OR (messages.created_at, messages.id) > (last_read.created_at, last_read.id))
     ) AS unread ON TRUE
     ORDER BY COALESCE(latest.created_at, conversations.created_at) DESC`,
    [userId]
  );
  return result.rows.map((record) => ({
    id: record.id,
    kind: record.kind,
    label: record.kind === 'WORKPLACE'
      ? 'Workplace room'
      : (record.other_full_name || record.other_email || 'Direct message'),
    other: record.other_id ? {
      email: record.other_email,
      fullName: record.other_full_name || record.other_email,
      id: record.other_id,
      primaryRole: record.other_primary_role,
      role: record.other_role
    } : null,
    latestMessage: record.latest_message || null,
    latestCreatedAt: record.latest_created_at || null,
    unreadCount: record.unread_count
  }));
};

const listChatMessages = async ({ conversationId, limit = 100 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const result = await query(
    `SELECT messages.conversation_id, messages.created_at, messages.id, messages.message,
       messages.sender_user_id, sender_users.email AS sender_email, sender_users.role AS sender_role,
       sender_profiles.full_name AS sender_full_name
     FROM chat_messages AS messages
     INNER JOIN users AS sender_users ON sender_users.id = messages.sender_user_id
     LEFT JOIN staff_profiles AS sender_profiles ON sender_profiles.user_id = sender_users.id
     WHERE messages.conversation_id = $1
     ORDER BY messages.created_at DESC, messages.id DESC
     LIMIT $2`,
    [conversationId, safeLimit]
  );
  return result.rows.reverse().map(mapChatMessage);
};

const getChatBootstrap = async (userId, requestedConversationId) => {
  const workplace = await getWorkplaceConversation();
  await ensureWorkplaceParticipant(userId, workplace.id);
  const conversation = requestedConversationId
    ? await getConversationForUser(userId, requestedConversationId)
    : workplace;
  const activeConversation = conversation || workplace;
  const [messages, conversations, people, unreadResult] = await Promise.all([
    listChatMessages({ conversationId: activeConversation.id }),
    listChatConversations(userId),
    listChatPeople(userId),
    query(
      `SELECT COUNT(messages.id)::INTEGER AS unread_count,
         (array_agg(messages.id ORDER BY messages.created_at, messages.id))[1] AS first_unread_message_id
       FROM chat_messages AS messages
       LEFT JOIN chat_read_states AS reads
         ON reads.user_id = $1 AND reads.conversation_id = $2
       LEFT JOIN chat_messages AS last_read ON last_read.id = reads.last_read_message_id
       WHERE messages.conversation_id = $2 AND messages.sender_user_id <> $1
         AND (last_read.id IS NULL OR (messages.created_at, messages.id) > (last_read.created_at, last_read.id))`,
      [userId, activeConversation.id]
    )
  ]);
  return {
    conversationId: activeConversation.id,
    conversations,
    firstUnreadMessageId: unreadResult.rows[0]?.first_unread_message_id || null,
    messages,
    people,
    unreadCount: Number(unreadResult.rows[0]?.unread_count || 0)
  };
};

const markChatMessagesRead = async (userId, messageId) => {
  if (!uuidPattern.test(String(messageId || ''))) return false;
  const result = await query(
    `INSERT INTO chat_read_states (user_id, conversation_id, last_read_message_id, updated_at)
     SELECT $1, messages.conversation_id, messages.id, NOW()
     FROM chat_messages AS messages
     INNER JOIN chat_conversation_participants AS participants
       ON participants.conversation_id = messages.conversation_id AND participants.user_id = $1
     WHERE messages.id = $2
     ON CONFLICT (user_id, conversation_id)
     DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, updated_at = NOW()
     RETURNING conversation_id`,
    [userId, messageId]
  );
  return result.rows[0] || false;
};

const createChatMessage = async (senderUserId, payload) => {
  const { details, message } = validateChatMessage(payload);
  if (details.length > 0) return { details, message: null };
  const workplace = await getWorkplaceConversation();
  await ensureWorkplaceParticipant(senderUserId, workplace.id);
  const conversation = payload?.conversationId
    ? await getConversationForUser(senderUserId, payload.conversationId)
    : workplace;
  if (!conversation) return { details: ['You cannot send messages to this conversation.'], message: null };
  const result = await query(
    `INSERT INTO chat_messages (conversation_id, message, sender_user_id)
     VALUES ($1, $2, $3)
     RETURNING conversation_id, id, message, created_at, sender_user_id`,
    [conversation.id, message, senderUserId]
  );
  const senderResult = await query(
    `SELECT users.email, users.role, staff_profiles.full_name
     FROM users LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
     WHERE users.id = $1`,
    [senderUserId]
  );
  return {
    details: [],
    message: mapChatMessage({ ...result.rows[0], sender_email: senderResult.rows[0]?.email, sender_full_name: senderResult.rows[0]?.full_name, sender_role: senderResult.rows[0]?.role })
  };
};

const getConversationParticipantIds = async (conversationId) => {
  const result = await query(
    `SELECT user_id FROM chat_conversation_participants WHERE conversation_id = $1`,
    [conversationId]
  );
  return result.rows.map((row) => row.user_id);
};

module.exports = {
  createChatMessage,
  getChatBootstrap,
  getConversationForUser,
  getConversationParticipantIds,
  getDirectConversation,
  listChatConversations,
  listChatMessages,
  listChatPeople,
  markChatMessagesRead,
  maxMessageLength,
  validateChatMessage
};
