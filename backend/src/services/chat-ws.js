const { WebSocket, WebSocketServer } = require('ws');
const { sessionMiddleware } = require('../config/session');
const { findUserById } = require('./auth-service');
const {
  createChatMessage,
  getChatBootstrap,
  getConversationForUser,
  getConversationParticipantIds,
  markChatMessagesRead,
  validateChatMessage
} = require('./chat-service');

const heartbeatIntervalMs = 30000;

const createSessionResponse = () => ({
  _header: false,
  getHeader: () => undefined,
  _implicitHeader: () => undefined,
  removeHeader: () => undefined,
  setHeader: () => undefined,
  statusCode: 200,
  write: () => true,
  writeHead: () => undefined,
  end: () => undefined
});

const parseSession = (request) => {
  return new Promise((resolve, reject) => {
    sessionMiddleware(request, createSessionResponse(), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(request.session);
    });
  });
};

const sendJson = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const setupChatWebSocket = (server) => {
  const webSocketServer = new WebSocketServer({
    maxPayload: 16 * 1024,
    noServer: true
  });

  server.on('upgrade', async (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/ws/chat') {
      socket.destroy();
      return;
    }

    const origin = request.headers.origin;
    const host = request.headers.host;
    if (!origin || (origin !== `https://${host}` && origin !== `http://${host}`)) {
      socket.destroy();
      return;
    }

    try {
      const session = await parseSession(request);
      const userId = session?.user?.id;
      const user = userId ? await findUserById(userId) : null;

      if (!user || !user.isActive || user.staffProfileIsActive === false) {
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        webSocketServer.emit('connection', client, request, user);
      });
    } catch (error) {
      console.error('[chat-websocket-auth-error]', error.message);
      socket.destroy();
    }
  });

  webSocketServer.on('connection', async (socket, request, user) => {
    socket.isAlive = true;
    socket.lastMessageAt = 0;
    socket.user = user;
    socket.conversationId = null;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    try {
      const bootstrap = await getChatBootstrap(user.id);
      socket.conversationId = bootstrap.conversationId;
      sendJson(socket, { ...bootstrap, type: 'history' });
    } catch (error) {
      sendJson(socket, { message: 'Chat history could not be loaded.', type: 'error' });
    }

    socket.on('message', async (rawMessage) => {
      let payload;

      try {
        payload = JSON.parse(rawMessage.toString());
      } catch (error) {
        sendJson(socket, { message: 'Chat message must be valid JSON.', type: 'error' });
        return;
      }

      if (payload?.type === 'read') {
        const saved = await markChatMessagesRead(user.id, payload.messageId);
        if (saved) {
          sendJson(socket, { messageId: payload.messageId, type: 'read-confirmed' });
        }
        return;
      }

      if (payload?.type === 'open-conversation') {
        const conversation = await getConversationForUser(user.id, payload.conversationId);
        if (!conversation) {
          sendJson(socket, { message: 'You cannot open this conversation.', type: 'error' });
          return;
        }
        const bootstrap = await getChatBootstrap(user.id, conversation.id);
        socket.conversationId = bootstrap.conversationId;
        sendJson(socket, { ...bootstrap, type: 'history' });
        return;
      }

      if (payload?.type !== 'message') {
        sendJson(socket, { message: 'Unsupported chat action.', type: 'error' });
        return;
      }

      if (Date.now() - socket.lastMessageAt < 350) {
        sendJson(socket, { message: 'Please wait before sending another message.', type: 'error' });
        return;
      }
      socket.lastMessageAt = Date.now();

      const { details } = validateChatMessage(payload);
      if (details.length > 0) {
        sendJson(socket, { details, message: details[0], type: 'error' });
        return;
      }

      try {
        const result = await createChatMessage(user.id, {
          ...payload,
          conversationId: socket.conversationId
        });
        if (!result.message) {
          sendJson(socket, { details: result.details, message: result.details[0] || 'The message could not be saved.', type: 'error' });
          return;
        }
        const messagePayload = JSON.stringify({ message: result.message, type: 'message' });
        const participantIds = await getConversationParticipantIds(result.message.conversationId);
        webSocketServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && participantIds.includes(client.user?.id)) {
            client.send(messagePayload);
          }
        });
      } catch (error) {
        sendJson(socket, { message: 'The message could not be saved.', type: 'error' });
      }
    });

    socket.on('error', () => undefined);
  });

  const heartbeat = setInterval(() => {
    webSocketServer.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, heartbeatIntervalMs);

  webSocketServer.on('close', () => clearInterval(heartbeat));
  return webSocketServer;
};

module.exports = { setupChatWebSocket };
