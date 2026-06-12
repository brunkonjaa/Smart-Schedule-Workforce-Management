const { rateLimit } = require('express-rate-limit');

const buildLoginRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    limit: options.limit || 5,
    legacyHeaders: false,
    standardHeaders: true,
    skipSuccessfulRequests: true,
    message: {
      error: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.'
    }
  });
};

const loginRateLimiter = buildLoginRateLimiter();

module.exports = {
  buildLoginRateLimiter,
  loginRateLimiter
};
