const express = require('express');
const { checkDatabaseConnection } = require('./config/db');

const app = express();

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
