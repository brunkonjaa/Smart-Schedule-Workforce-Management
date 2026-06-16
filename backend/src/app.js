const express = require('express');
const path = require('path');
const helmet = require('helmet');
const config = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const availabilityRoutes = require('./routes/availability');
const leaveRequestRoutes = require('./routes/leave-requests');
const shiftRoutes = require('./routes/shifts');

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/leave-requests', leaveRequestRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use(express.static(frontendPublicDirectory));

app.get('/health', async (request, response) => {
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

  response.status(500).json({
    error: 'Internal Server Error',
    message: 'The server could not complete this request.'
  });
});

module.exports = app;
