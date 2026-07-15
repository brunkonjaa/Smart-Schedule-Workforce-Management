const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  acceptSwapRequest,
  createSwapRequest,
  decideSwapRequest,
  listSwapRequests,
  validateSwapInput
} = require('../services/shift-swap-service');

const router = express.Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asyncHandler = (handler) => (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
const sendValidationError = (response, details) => response.status(400).json({ details, error: 'Validation Failed', message: 'The shift swap request contains invalid fields.' });

router.get('/', requireRole('STAFF', 'MANAGER'), asyncHandler(async (request, response) => {
  return response.status(200).json({ requests: await listSwapRequests(request.authUser) });
}));

router.post('/', requireRole('STAFF'), requireMutationProtection, asyncHandler(async (request, response) => {
  const { details, swapInput } = validateSwapInput(request.body);
  if (details.length) return sendValidationError(response, details);
  const result = await createSwapRequest({ requesterStaffProfileId: request.authUser.staffProfileId, swapInput });
  const messages = {
    ALREADY_REQUESTED: 'A swap request is already open for this shift.',
    FORBIDDEN: 'You can only request a swap for your own shift.',
    PAST_SHIFT: 'Only future shifts can be swapped.',
    SELF_TARGET: 'You cannot target yourself for a swap.',
    SHIFT_NOT_OPEN: 'This shift cannot be swapped now.',
    TARGET_INELIGIBLE: 'The selected staff member is not eligible for this shift.'
  };
  if (result.code) return response.status(result.code === 'FORBIDDEN' ? 403 : 409).json({ error: 'Swap Request Failed', message: messages[result.code] || 'The swap request could not be created.' });
  return response.status(201).json({ message: 'Shift swap request created.', request: result.swap });
}));

router.post('/:swapId/accept', requireRole('STAFF'), requireMutationProtection, asyncHandler(async (request, response) => {
  if (!uuidPattern.test(request.params.swapId)) return sendValidationError(response, ['swapId must be a valid UUID']);
  const result = await acceptSwapRequest({ swapId: request.params.swapId, staffProfileId: request.authUser.staffProfileId });
  if (result.code) return response.status(result.code === 'FORBIDDEN' ? 403 : 409).json({ error: 'Swap Request Failed', message: result.code === 'FORBIDDEN' ? 'You cannot accept this swap request.' : result.code === 'TARGET_INELIGIBLE' ? 'You are not eligible for this shift.' : 'This swap request is no longer available.' });
  return response.status(200).json({ message: 'Swap request accepted and sent to the manager.', request: result.swap });
}));

router.put('/:swapId/approve', requireRole('MANAGER'), requireMutationProtection, asyncHandler(async (request, response) => {
  return decideSwap(request, response, 'APPROVE');
}));

router.put('/:swapId/reject', requireRole('MANAGER'), requireMutationProtection, asyncHandler(async (request, response) => {
  return decideSwap(request, response, 'REJECT');
}));

async function decideSwap(request, response, decision) {
  if (!uuidPattern.test(request.params.swapId)) return sendValidationError(response, ['swapId must be a valid UUID']);
  const result = await decideSwapRequest({ decision, managerNote: String(request.body?.managerNote || '').trim(), managerUserId: request.authUser.id, swapId: request.params.swapId });
  if (result.code) return response.status(409).json({ error: 'Swap Request Failed', message: result.code === 'STAFF_NOT_ACCEPTED' ? 'A staff member must accept this swap before approval.' : 'This swap request is no longer available.' });
  return response.status(200).json({ message: decision === 'APPROVE' ? 'Shift swap approved.' : 'Shift swap rejected.', request: result.swap });
}

module.exports = router;
