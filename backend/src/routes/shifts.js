const express = require('express');
const { requireRole } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildShiftListFilters,
  createShift,
  deleteShift,
  findShiftById,
  listShifts,
  updateShift,
  validateShiftInput
} = require('../services/shift-service');
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
    message: 'The shift request contains invalid fields.'
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
  requireRole('MANAGER'),
  asyncHandler(async (request, response) => {
    const { details, filters } = buildShiftListFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const shifts = await listShifts(filters);

    return response.status(200).json({
      shifts
    });
  })
);

router.post(
  '/',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { details, shiftInput } = validateShiftInput(request.body, true);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const shift = await createShift(shiftInput, request.authUser.id);

    return response.status(201).json({
      message: 'Shift created successfully.',
      shift
    });
  })
);

router.put(
  '/:shiftId',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.shiftId || ''))) {
      return sendValidationError(response, ['shiftId must be a valid UUID']);
    }

    const { details, shiftInput } = validateShiftInput(request.body, false);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const existingShift = await findShiftById(request.params.shiftId);

    if (!existingShift) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested shift could not be found.'
      });
    }

    try {
      const shift = await updateShift(
        existingShift,
        shiftInput,
        request.authUser.id
      );

      return response.status(200).json({
        message: 'Shift updated successfully.',
        shift
      });
    } catch (error) {
      if (error.code === 'SHIFT_LOCKED' || error.code === 'SHIFT_TIME_CONFLICT') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.delete(
  '/:shiftId',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.shiftId || ''))) {
      return sendValidationError(response, ['shiftId must be a valid UUID']);
    }

    const existingShift = await findShiftById(request.params.shiftId);

    if (!existingShift) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested shift could not be found.'
      });
    }

    try {
      await deleteShift(existingShift, request.authUser.id);
      return response.status(204).send();
    } catch (error) {
      if (error.code === 'SHIFT_LOCKED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

module.exports = router;
