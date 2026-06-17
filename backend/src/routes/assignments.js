const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  createAssignment,
  validateAssignmentInput
} = require('../services/assignment-service');

const router = express.Router();

const asyncHandler = (handler) => {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};

const sendValidationError = (response, details) => {
  return response.status(400).json({
    details,
    error: 'Validation Failed',
    message: 'The assignment request contains invalid fields.'
  });
};

const sendConflictError = (response, message) => {
  return response.status(409).json({
    error: 'Conflict',
    message
  });
};

router.post(
  '/',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { assignmentInput, details } = validateAssignmentInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const { assignment, missingResource } = await createAssignment(
        assignmentInput,
        request.authUser.id
      );

      if (missingResource) {
        return response.status(404).json({
          error: 'Not Found',
          message:
            missingResource === 'shift'
              ? 'The requested shift could not be found.'
              : 'The requested staff record could not be found.'
        });
      }

      return response.status(201).json({
        assignment,
        message: 'Shift assignment created successfully.'
      });
    } catch (error) {
      if (error.code === 'SHIFT_ALREADY_ASSIGNED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

module.exports = router;
