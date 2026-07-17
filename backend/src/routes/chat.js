const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  createChatMessage,
  listChatMessages,
  validateChatMessage
} = require('../services/chat-service');

const router = express.Router();

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

router.get('/messages', requireAuth, asyncHandler(async (request, response) => {
  response.status(200).json({ messages: await listChatMessages() });
}));

router.post('/messages', requireAuth, requireMutationProtection, asyncHandler(async (request, response) => {
  const { details } = validateChatMessage(request.body);
  if (details.length > 0) {
    return response.status(400).json({
      details,
      error: 'Validation Failed',
      message: 'The chat message contains invalid fields.'
    });
  }

  const result = await createChatMessage(request.authUser.id, request.body);
  return response.status(201).json({ message: result.message });
}));

module.exports = router;
