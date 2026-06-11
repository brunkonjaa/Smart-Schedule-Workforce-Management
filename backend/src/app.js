const express = require('express');
const config = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');
const { sessionMiddleware } = require('./config/session');

const app = express();

if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(sessionMiddleware);
app.use(express.json());

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

module.exports = app;
