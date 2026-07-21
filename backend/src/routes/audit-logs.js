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
    const rawPage = Number(request.query.page || 1);
    const rawPageSize = request.query.limit === undefined
      ? 25
      : Number(request.query.limit);

    if (!Number.isInteger(rawPage) || rawPage < 1) {
      return response.status(400).json({
        details: ['page must be a whole number greater than 0'],
        error: 'Validation Failed',
        message: 'The Rota activity request contains invalid fields.'
      });
    }

    if (!Number.isInteger(rawPageSize) || rawPageSize < 1 || rawPageSize > 200) {
      return response.status(400).json({
        details: ['limit must be a whole number between 1 and 200'],
        error: 'Validation Failed',
        message: 'The audit log request contains invalid fields.'
      });
    }

    const result = await listAuditLogs({
      page: rawPage,
      pageSize: rawPageSize
    });

    if (rawPage > result.pagination.totalPages) {
      return response.status(400).json({
        details: ['page is beyond the available Rota activity records'],
        error: 'Validation Failed',
        message: 'The Rota activity request contains invalid fields.'
      });
    }

    return response.status(200).json(result);
  })
);

module.exports = router;
