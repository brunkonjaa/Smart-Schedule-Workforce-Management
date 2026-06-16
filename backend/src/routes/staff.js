const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildListFilters,
  createStaff,
  updateStaff,
  validateStaffCreateInput,
  validateStaffUpdateInput,
  listStaff
} = require('../services/staff-service');

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
    message: 'The staff request contains invalid fields.'
  });
};

const sendConflictError = (response, message) => {
  return response.status(409).json({
    error: 'Conflict',
    message
  });
};

const validateStaffId = (staffId) => {
  return uuidPattern.test(String(staffId || ''));
};

router.get(
  '/',
  requireRole('MANAGER'),
  asyncHandler(async (request, response) => {
    const { details, filters } = buildListFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const staff = await listStaff(filters);

    return response.status(200).json({
      staff
    });
  })
);

router.post(
  '/',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { details, staffInput } = validateStaffCreateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const createdStaff = await createStaff(staffInput);

      return response.status(201).json({
        message: 'Staff record created successfully.',
        staff: createdStaff
      });
    } catch (error) {
      if (error.code === '23505') {
        return sendConflictError(
          response,
          'A staff account with that email already exists.'
        );
      }

      throw error;
    }
  })
);

router.put(
  '/:staffId',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!validateStaffId(request.params.staffId)) {
      return sendValidationError(response, ['staffId must be a valid UUID']);
    }

    const { details, staffInput } = validateStaffUpdateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    try {
      const updatedStaff = await updateStaff(request.params.staffId, staffInput);

      if (!updatedStaff) {
        return response.status(404).json({
          error: 'Not Found',
          message: 'The requested staff record could not be found.'
        });
      }

      return response.status(200).json({
        message: 'Staff record updated successfully.',
        staff: updatedStaff
      });
    } catch (error) {
      if (error.code === '23505') {
        return sendConflictError(
          response,
          'A staff account with that email already exists.'
        );
      }

      throw error;
    }
  })
);

module.exports = router;
