const express = require('express');
const { requireRole } = require('../middleware/auth');
const {
  listAuditLogs,
  listEmployeeAccessLogs
} = require('../services/audit-log-service');

const router = express.Router();

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

router.get(
  '/employee-access',
  requireRole('MANAGER'),
  asyncHandler(async (request, response) => {
    const rawPage = Number(request.query.page || 1);

    if (!Number.isInteger(rawPage) || rawPage < 1) {
      return response.status(400).json({
        details: ['page must be a whole number greater than 0'],
        error: 'Validation Failed',
        message: 'The Employee access request contains invalid fields.'
      });
    }

    const result = await listEmployeeAccessLogs({
      page: rawPage,
      pageSize: 25
    });

    if (rawPage > result.pagination.totalPages) {
      return response.status(400).json({
        details: ['page is beyond the available Employee access records'],
        error: 'Validation Failed',
        message: 'The Employee access request contains invalid fields.'
      });
    }

    return response.status(200).json(result);
  })
);

router.get(
  '/',
  requireRole('MANAGER'),
  asyncHandler(async (request, response) => {
    const rawLimit = Number(request.query.limit || 100);
    const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : null;

    if (!limit) {
      return response.status(400).json({
        details: ['limit must be a whole number between 1 and 200'],
        error: 'Validation Failed',
        message: 'The audit log request contains invalid fields.'
      });
    }

    const logs = await listAuditLogs({ limit });
    return response.status(200).json({ logs });
  })
);

module.exports = router;
