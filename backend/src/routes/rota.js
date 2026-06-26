const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  buildRotaFilters,
  getRota
} = require('../services/rota-service');

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
    message: 'The rota request contains invalid fields.'
  });
};

router.get(
  '/',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { details, filters } = buildRotaFilters(request.query);

    if (details.length > 0) {
      return sendValidationError(response, details);
    }

    const rota = await getRota(request.authUser, filters);

    return response.status(200).json({
      rota
    });
  })
);

module.exports = router;
