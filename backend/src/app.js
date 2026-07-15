const express = require('express');
const path = require('path');
const helmet = require('helmet');
const config = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');
const { sessionMiddleware } = require('./config/session');
const {
  apiRateLimiter,
  healthRateLimiter
} = require('./config/rate-limit');
const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const leaveRequestRoutes = require('./routes/leave-requests');
const shiftRoutes = require('./routes/shifts');
const assignmentRoutes = require('./routes/assignments');
const rotaRoutes = require('./routes/rota');
const shiftSwapRoutes = require('./routes/shift-swaps');
const auditLogRoutes = require('./routes/audit-logs');

const frontendPublicDirectory = path.resolve(__dirname, '../../frontend/public');
const frontendSourceDirectory = path.resolve(__dirname, '../../frontend/src');

const app = express();

app.disable('x-powered-by');

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        defaultSrc: ["'self'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"]
      }
    }
  })
);
app.use(sessionMiddleware);
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 25 }));
app.use('/src', express.static(frontendSourceDirectory));
app.use('/api/v1', apiRateLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/leave-requests', leaveRequestRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/rota', rotaRoutes);
app.use('/api/v1/shift-swaps', shiftSwapRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use(express.static(frontendPublicDirectory));

app.get('/health', healthRateLimiter, async (request, response) => {
  try {
    await checkDatabaseConnection();

    response.status(200).json({
      database: 'connected',
      status: 'ok'
    });
  } catch (error) {
    response.status(503).json({
      database: 'disconnected',
      status: 'error'
    });
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  console.error('[request-error]', {
    method: request.method,
    path: request.originalUrl,
    message: error.message,
    code: error.code,
    stack: error.stack
  });

  response.status(500).json({
    error: 'Internal Server Error',
    message: 'The server could not complete this request.'
  });
});

module.exports = app;
