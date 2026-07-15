const express = require('express');
const { requireRole } = require('../middleware/auth');
const { listAuditLogs } = require('../services/audit-log-service');

const router = express.Router();

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

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
