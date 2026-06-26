const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildAssignmentListFilters,
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment,
  validateAssignmentInput,
  validateAssignmentUpdateInput
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
  'ASSIGNMENT_LOCKED',
  'ASSIGNMENT_LEAVE_CONFLICT',
  'ASSIGNMENT_OVERLAP_CONFLICT',
  'ASSIGNMENT_ROLE_CONFLICT',
  'SHIFT_ALREADY_ASSIGNED',
  'SHIFT_NOT_OPEN',
  'STAFF_NOT_ACTIVE'
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateAssignmentId = (assignmentId) => {
  return uuidPattern.test(String(assignmentId || ''));
};

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

router.put(
  '/:assignmentId',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!validateAssignmentId(request.params.assignmentId)) {
      return sendValidationError(response, ['assignmentId must be a valid UUID']);
    }

    const { assignmentInput, details } = validateAssignmentUpdateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const { assignment, missingResource } = await updateAssignment(
        request.params.assignmentId,
        assignmentInput,
        request.authUser.id
      );

      if (missingResource) {
        return response.status(404).json({
          error: 'Not Found',
          message:
            missingResource === 'assignment'
              ? 'The requested assignment could not be found.'
              : 'The requested staff record could not be found.'
        });
      }

      return response.status(200).json({
        assignment,
        message: 'Shift assignment updated successfully.'
      });
    } catch (error) {
      if (assignmentConflictCodes.has(error.code)) {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.delete(
  '/:assignmentId',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!validateAssignmentId(request.params.assignmentId)) {
      return sendValidationError(response, ['assignmentId must be a valid UUID']);
    }

    try {
      const deleted = await deleteAssignment(request.params.assignmentId);

      if (!deleted) {
        return response.status(404).json({
          error: 'Not Found',
          message: 'The requested assignment could not be found.'
        });
      }

      return response.status(204).send();
    } catch (error) {
      if (assignmentConflictCodes.has(error.code)) {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
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
