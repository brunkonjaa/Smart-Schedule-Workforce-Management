const { rateLimit } = require('express-rate-limit');

const buildRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    limit: options.limit || 100,
    legacyHeaders: false,
    message: options.message,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    standardHeaders: true,
    validate: {
      xForwardedForHeader: false
    }
  });
};

const buildLoginRateLimiter = (options = {}) => {
  return buildRateLimiter({
    limit: options.limit || 5,
    message: {
      error: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.'
    },
    skipSuccessfulRequests: true,
    windowMs: options.windowMs || 15 * 60 * 1000
  });
};

const buildApiRateLimiter = (options = {}) => {
  return buildRateLimiter({
    limit: options.limit || 120,
    message: {
      error: 'Too Many Requests',
      message: 'Too many API requests. Please slow down and try again soon.'
    },
    windowMs: options.windowMs || 15 * 60 * 1000
  });
};

const buildHealthRateLimiter = (options = {}) => {
  return buildRateLimiter({
    limit: options.limit || 30,
    message: {
      error: 'Too Many Requests',
      message: 'Too many health checks. Please try again later.'
    },
    windowMs: options.windowMs || 60 * 1000
  });
};

const apiRateLimiter = buildApiRateLimiter();
const healthRateLimiter = buildHealthRateLimiter();
const loginRateLimiter = buildLoginRateLimiter();

module.exports = {
  apiRateLimiter,
  buildApiRateLimiter,
  buildHealthRateLimiter,
  buildLoginRateLimiter,
  healthRateLimiter,
  loginRateLimiter
};
