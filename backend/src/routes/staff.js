const express = require('express');
const {
  requireAuth,
  requireRole,
  sendForbidden
} = require('../middleware/auth');
const { requireMutationProtection } = require('../middleware/request-security');
const {
  buildListFilters,
  createStaff,
  resetStaffPassword,
  updateStaff,
  validateStaffCreateInput,
  validateTemporaryPasswordInput,
  validateStaffUpdateInput,
  listStaff
} = require('../services/staff-service');
const { createSecurityEvent } = require('../services/security-event-service');
const {
  createEmployeeAccessEvent
} = require('../services/audit-log-service');
const {
  buildEmployeeSummaryFilters,
  findEmployeeSummaryProfile,
  getEmployeeSummary,
  normalizeSource
} = require('../services/employee-summary-service');

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

const logSecurityEventSafely = async (eventInput) => {
  try {
    await createSecurityEvent(eventInput);
  } catch (error) {
    // Security-event writes should not break the main request path.
  }
};

const validateStaffId = (staffId) => {
  return uuidPattern.test(String(staffId || ''));
};

const getRecordedSource = (source) => {
  return source === 'DIRECT' ? null : source;
};

const logDeniedSummaryAccessSafely = async (request) => {
  if (!validateStaffId(request.params.staffId)) {
    return;
  }

  try {
    const source = normalizeSource(request.query?.source || request.body?.source);
    await createEmployeeAccessEvent({
      action: 'EMPLOYEE_SUMMARY_ACCESS_DENIED',
      actorUserId: request.authUser.id,
      result: 'DENIED',
      source: source ? getRecordedSource(source) : null,
      targetStaffProfileId: request.params.staffId
    });
  } catch (error) {
    // Authorization must still return 403 if the append-only log is unavailable.
  }
};

const requireManagerForSummary = async (request, response) => {
  if (request.authUser.role === 'MANAGER') {
    return true;
  }

  await logDeniedSummaryAccessSafely(request);
  sendForbidden(response);
  return false;
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

router.get(
  '/:staffId/summary',
  requireAuth,
  asyncHandler(async (request, response) => {
    if (!(await requireManagerForSummary(request, response))) {
      return;
    }

    if (!validateStaffId(request.params.staffId)) {
      return sendValidationError(response, ['staffId must be a valid UUID']);
    }

    const { details, filters } = buildEmployeeSummaryFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const summary = await getEmployeeSummary(request.params.staffId, filters);

    if (!summary) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'This employee record is no longer available.'
      });
    }

    await createEmployeeAccessEvent({
      action: 'EMPLOYEE_SUMMARY_VIEWED',
      actorUserId: request.authUser.id,
      result: 'SUCCESS',
      source: getRecordedSource(filters.source),
      targetStaffProfileId: request.params.staffId
    });

    return response.status(200).json({ summary });
  })
);

router.post(
  '/:staffId/summary/print-request',
  requireAuth,
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!(await requireManagerForSummary(request, response))) {
      return;
    }

    if (!validateStaffId(request.params.staffId)) {
      return sendValidationError(response, ['staffId must be a valid UUID']);
    }

    const unexpectedFields = Object.keys(request.body || {}).filter((fieldName) => {
      return fieldName !== 'source';
    });
    const source = normalizeSource(request.body?.source);
    const details = [];

    if (unexpectedFields.length > 0) {
      details.push(`unsupported fields: ${unexpectedFields.join(', ')}`);
    }

    if (!source) {
      details.push('source must be a valid Smart Schedule page');
    }

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const employee = await findEmployeeSummaryProfile(request.params.staffId);

    if (!employee) {
      return response.status(404).json({
        error: 'Not Found',
        message: 'This employee record is no longer available.'
      });
    }

    await createEmployeeAccessEvent({
      action: 'EMPLOYEE_SUMMARY_PRINT_REQUESTED',
      actorUserId: request.authUser.id,
      result: 'SUCCESS',
      source: getRecordedSource(source),
      targetStaffProfileId: request.params.staffId
    });

    return response.status(204).send();
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

router.post(
  '/:staffId/reset-password',
  requireRole('MANAGER'),
  requireMutationProtection,
  asyncHandler(async (request, response) => {
    if (!validateStaffId(request.params.staffId)) {
      return sendValidationError(response, ['staffId must be a valid UUID']);
    }

    const { details, temporaryPassword } = validateTemporaryPasswordInput(
      request.body
    );

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const updatedStaff = await resetStaffPassword(
      request.params.staffId,
      temporaryPassword
    );

    if (!updatedStaff) {
      await logSecurityEventSafely({
        actorUserId: request.authUser.id,
        eventType: 'STAFF_PASSWORD_RESET',
        ipAddress: request.ip,
        metadata: {
          staffId: request.params.staffId
        },
        outcome: 'FAILURE'
      });

      return response.status(404).json({
        error: 'Not Found',
        message: 'The requested staff record could not be found.'
      });
    }

    await logSecurityEventSafely({
      actorUserId: request.authUser.id,
      eventType: 'STAFF_PASSWORD_RESET',
      ipAddress: request.ip,
      outcome: 'SUCCESS',
      staffProfileId: updatedStaff.id,
      targetUserId: updatedStaff.userId
    });

    return response.status(200).json({
      message: 'Temporary password reset successfully.',
      staff: updatedStaff
    });
  })
);

module.exports = router;
