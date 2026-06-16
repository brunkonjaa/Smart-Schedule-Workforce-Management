const express = require('express');
const { requireAuth, requireRole, sendForbidden } = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildAvailabilityListFilters,
  createAvailabilityEntries,
  deleteAvailabilityEntry,
  findAvailabilityById,
  listAvailability,
  updateAvailabilityEntry,
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput
} = require('../services/availability-service');

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
    message: 'The availability request contains invalid fields.'
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
    const { details, filters } = buildAvailabilityListFilters(request.query);

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

    const availability = await listAvailability(request.authUser, filters);

    return response.status(200).json({
      availability
    });
  })
);

router.post(
  '/',
  requireRole('STAFF'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    const { availabilityInput, details } = validateAvailabilityCreateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    if (!request.authUser.staffProfileId) {
      return sendForbidden(response);
    }

    try {
      const availability = await createAvailabilityEntries(
        request.authUser.staffProfileId,
        availabilityInput
      );

      return response.status(201).json({
        availability,
        message: 'Availability entries created successfully.'
      });
    } catch (error) {
      if (error.code === 'AVAILABILITY_OVERLAP_CONFLICT') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.put(
  '/:availabilityId',
  requireRole('STAFF'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.availabilityId || ''))) {
      return sendValidationError(response, ['availabilityId must be a valid UUID']);
    }

    const { availabilityInput, details } = validateAvailabilityUpdateInput(request.body);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const existingEntry = await findAvailabilityById(request.params.availabilityId);

    if (!existingEntry) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested availability entry could not be found.'
      });
    }

    if (existingEntry.staffProfileId !== request.authUser.staffProfileId) {
      return sendForbidden(response);
    }

    try {
      const availability = await updateAvailabilityEntry(existingEntry, availabilityInput);

      return response.status(200).json({
        availability,
        message: 'Availability entry updated successfully.'
      });
    } catch (error) {
      if (
        error.code === 'AVAILABILITY_OVERLAP_CONFLICT' ||
        error.code === 'AVAILABILITY_LOCKED' ||
        error.code === 'AVAILABILITY_TIME_CONFLICT'
      ) {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

router.delete(
  '/:availabilityId',
  requireRole('STAFF'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!uuidPattern.test(String(request.params.availabilityId || ''))) {
      return sendValidationError(response, ['availabilityId must be a valid UUID']);
    }

    const existingEntry = await findAvailabilityById(request.params.availabilityId);

    if (!existingEntry) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested availability entry could not be found.'
      });
    }

    if (existingEntry.staffProfileId !== request.authUser.staffProfileId) {
      return sendForbidden(response);
    }

    try {
      await deleteAvailabilityEntry(existingEntry);
      return response.status(204).send();
    } catch (error) {
      if (error.code === 'AVAILABILITY_LOCKED') {
        return sendConflictError(response, error.message);
      }

      throw error;
    }
  })
);

module.exports = router;
