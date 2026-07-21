const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  createChatMessage,
  getChatBootstrap,
  getDirectConversation,
  listChatPeople,
  validateChatMessage
} = require('../services/chat-service');

const router = express.Router();

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

router.get('/messages', requireRole('STAFF', 'MANAGER'), asyncHandler(async (request, response) => {
  const bootstrap = await getChatBootstrap(request.authUser.id, request.query.conversationId);
  response.status(200).json(bootstrap);
}));

router.get('/people', requireRole('STAFF', 'MANAGER'), asyncHandler(async (request, response) => {
  response.status(200).json({ people: await listChatPeople(request.authUser.id) });
}));

router.post('/conversations', requireRole('STAFF', 'MANAGER'), requireMutationProtection, asyncHandler(async (request, response) => {
  const conversation = await getDirectConversation(request.authUser.id, request.body?.userId);
  if (!conversation) {
    return response.status(400).json({
      error: 'Validation Failed',
      message: 'The selected staff member cannot receive a direct message.'
    });
  }
  return response.status(201).json({ conversation });
}));

router.post('/messages', requireRole('STAFF', 'MANAGER'), requireMutationProtection, asyncHandler(async (request, response) => {
  const { details } = validateChatMessage(request.body);
  if (details.length > 0) {
    return response.status(400).json({
      details,
      error: 'Validation Failed',
      message: 'The chat message contains invalid fields.'
    });
  }

  const result = await createChatMessage(request.authUser.id, request.body);
  if (!result.message) {
    return response.status(403).json({
      details: result.details,
      error: 'Forbidden',
      message: result.details[0] || 'You cannot send messages to this conversation.'
    });
  }
  return response.status(201).json({ message: result.message });
}));

module.exports = router;
