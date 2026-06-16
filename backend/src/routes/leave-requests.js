const express = require('express');
const { requireAuth, requireRole, sendForbidden } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildLeaveRequestListFilters,
  createLeaveRequest,
  decideLeaveRequest,
  findLeaveRequestById,
  listLeaveRequests,
  validateLeaveCreateInput,
  validateLeaveDecisionInput,
  withdrawLeaveRequest
} = require('../services/leave-request-service');

const router = express.Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asyncHandler = (handler) => {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};

const sendValidationError = (response, details) => {
  return response.status(400).json({
    details,
    error: 'Validation Failed',
    message: 'The leave request contains invalid fields.'
  });
};

const sendConflictError = (response, message) => {
  return response.status(409).json({
    error: 'Conflict',
    message
  });
};

router.get(
  '/',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { details, filters } = buildLeaveRequestListFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    if (
      request.authUser.role === 'STAFF' &&
      filters.staffProfileId &&
      filters.staffProfileId !== request.authUser.staffProfileId
    ) {
      return sendForbidden(response);
    }

    const leaveRequests = await listLeaveRequests(request.authUser, filters);

    return response.status(200).json({
      leaveRequests
    });
  })
);

router.post(
  '/',
  requireRole('STAFF'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { details, leaveInput } = validateLeaveCreateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    if (!request.authUser.staffProfileId) {
      return sendForbidden(response);
    }

    try {
      const leaveRequest = await createLeaveRequest(
        request.authUser.staffProfileId,
        leaveInput
      );

      return response.status(201).json({
        leaveRequest,
        message: 'Leave request created successfully.'
      });
    } catch (error) {
      if (error.code === 'LEAVE_OVERLAP_CONFLICT') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.put(
  '/:leaveRequestId/approve',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.leaveRequestId || ''))) {
      return sendValidationError(response, ['leaveRequestId must be a valid UUID']);
    }

    const { decisionInput, details } = validateLeaveDecisionInput(request.body || {}, false);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const existingLeaveRequest = await findLeaveRequestById(request.params.leaveRequestId);

    if (!existingLeaveRequest) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested leave request could not be found.'
      });
    }

    try {
      const leaveRequest = await decideLeaveRequest(
        existingLeaveRequest,
        'APPROVED',
        request.authUser.id,
        decisionInput
      );

      return response.status(200).json({
        leaveRequest,
        message: 'Leave request approved successfully.'
      });
    } catch (error) {
      if (error.code === 'LEAVE_ALREADY_DECIDED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.put(
  '/:leaveRequestId/reject',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.leaveRequestId || ''))) {
      return sendValidationError(response, ['leaveRequestId must be a valid UUID']);
    }

    const { decisionInput, details } = validateLeaveDecisionInput(request.body || {}, false);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const existingLeaveRequest = await findLeaveRequestById(request.params.leaveRequestId);

    if (!existingLeaveRequest) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested leave request could not be found.'
      });
    }

    try {
      const leaveRequest = await decideLeaveRequest(
        existingLeaveRequest,
        'REJECTED',
        request.authUser.id,
        decisionInput
      );

      return response.status(200).json({
        leaveRequest,
        message: 'Leave request rejected successfully.'
      });
    } catch (error) {
      if (error.code === 'LEAVE_ALREADY_DECIDED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.delete(
  '/:leaveRequestId',
  requireRole('STAFF'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.leaveRequestId || ''))) {
      return sendValidationError(response, ['leaveRequestId must be a valid UUID']);
    }

    const existingLeaveRequest = await findLeaveRequestById(request.params.leaveRequestId);

    if (!existingLeaveRequest) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested leave request could not be found.'
      });
    }

    if (existingLeaveRequest.staffProfileId !== request.authUser.staffProfileId) {
      return sendForbidden(response);
    }

    try {
      await withdrawLeaveRequest(existingLeaveRequest);
      return response.status(204).send();
    } catch (error) {
      if (error.code === 'LEAVE_ALREADY_DECIDED' || error.code === 'LEAVE_LOCKED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

module.exports = router;
