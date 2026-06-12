const express = require('express');
const helmet = require('helmet');
const config = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');
const { sessionMiddleware } = require('./config/session');
const authRoutes = require('./routes/auth');

const app = express();

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(sessionMiddleware);
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

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
