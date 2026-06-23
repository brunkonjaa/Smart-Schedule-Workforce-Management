const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildAssignmentListFilters,
  createAssignment,
  listAssignments,
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

const assignmentConflictCodes = new Set([
  'ASSIGNMENT_AVAILABILITY_CONFLICT',
  'ASSIGNMENT_LEAVE_CONFLICT',
  'ASSIGNMENT_OVERLAP_CONFLICT',
  'ASSIGNMENT_ROLE_CONFLICT',
  'SHIFT_ALREADY_ASSIGNED',
  'SHIFT_NOT_OPEN',
  'STAFF_NOT_ACTIVE'
]);

router.get(
  '/',
  requireRole('MANAGER'),
  asyncHandler(async (request, response) => {
    const { details, filters } = buildAssignmentListFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const assignments = await listAssignments(filters);

    return response.status(200).json({
      assignments
    });
  })
);

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
      if (assignmentConflictCodes.has(error.code)) {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

module.exports = router;
