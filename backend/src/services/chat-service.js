const { query } = require('../config/db');

const maxMessageLength = 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeMessage = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\r\n/g, '\n').trim();
};

const validateChatMessage = (payload) => {
  const message = normalizeMessage(payload?.message);
  const details = [];

  if (!message) {
    details.push('message is required');
  } else if (message.length > maxMessageLength) {
    details.push(`message must be ${maxMessageLength} characters or fewer`);
  }

  return { details, message };
};

const mapChatMessage = (record) => ({
  createdAt: record.created_at,
  id: record.id,
  message: record.message,
  sender: {
    fullName: record.sender_full_name || record.sender_email,
    id: record.sender_user_id,
    role: record.sender_role
  }
});

const listChatMessages = async ({ limit = 100 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const result = await query(
    `
      SELECT
        chat_messages.created_at,
        chat_messages.id,
        chat_messages.message,
        chat_messages.sender_user_id,
        sender_users.email AS sender_email,
        sender_users.role AS sender_role,
        sender_profiles.full_name AS sender_full_name
      FROM chat_messages
      INNER JOIN users AS sender_users ON sender_users.id = chat_messages.sender_user_id
      LEFT JOIN staff_profiles AS sender_profiles ON sender_profiles.user_id = sender_users.id
      ORDER BY chat_messages.created_at DESC, chat_messages.id DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows.reverse().map(mapChatMessage);
};

const getChatBootstrap = async (userId) => {
  const [messages, unreadResult] = await Promise.all([
    listChatMessages(),
    query(
      `
        SELECT
          COUNT(chat_messages.id)::INTEGER AS unread_count,
          (array_agg(chat_messages.id ORDER BY chat_messages.created_at, chat_messages.id))[1] AS first_unread_message_id
        FROM chat_messages
        LEFT JOIN chat_read_states
          ON chat_read_states.user_id = $1
        LEFT JOIN chat_messages AS last_read_message
          ON last_read_message.id = chat_read_states.last_read_message_id
        WHERE last_read_message.id IS NULL
          OR (chat_messages.created_at, chat_messages.id) >
             (last_read_message.created_at, last_read_message.id)
      `,
      [userId]
    )
  ]);

  return {
    firstUnreadMessageId: unreadResult.rows[0]?.first_unread_message_id || null,
    messages,
    unreadCount: Number(unreadResult.rows[0]?.unread_count || 0)
  };
};

const markChatMessagesRead = async (userId, messageId) => {
  if (!uuidPattern.test(String(messageId || ''))) {
    return false;
  }

  const result = await query(
    `
      INSERT INTO chat_read_states (user_id, last_read_message_id, updated_at)
      SELECT $1, chat_messages.id, NOW()
      FROM chat_messages
      WHERE chat_messages.id = $2
      ON CONFLICT (user_id)
      DO UPDATE SET
        last_read_message_id = EXCLUDED.last_read_message_id,
        updated_at = NOW()
      RETURNING user_id
    `,
    [userId, messageId]
  );

  return result.rowCount === 1;
};

const createChatMessage = async (senderUserId, payload) => {
  const { details, message } = validateChatMessage(payload);

  if (details.length > 0) {
    return { details, message: null };
  }

  const result = await query(
    `
      INSERT INTO chat_messages (message, sender_user_id)
      VALUES ($1, $2)
      RETURNING id, message, created_at, sender_user_id
    `,
    [message, senderUserId]
  );

  const senderResult = await query(
    `
      SELECT users.email, users.role, staff_profiles.full_name
      FROM users
      LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
      WHERE users.id = $1
    `,
    [senderUserId]
  );

  return {
    details: [],
    message: mapChatMessage({
      ...result.rows[0],
      sender_email: senderResult.rows[0]?.email,
      sender_full_name: senderResult.rows[0]?.full_name,
      sender_role: senderResult.rows[0]?.role
    })
  };
};

module.exports = {
  createChatMessage,
  getChatBootstrap,
  listChatMessages,
  markChatMessagesRead,
  maxMessageLength,
  validateChatMessage
};
