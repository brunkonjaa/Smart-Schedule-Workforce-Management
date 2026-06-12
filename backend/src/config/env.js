const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const envPath = fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath;

dotenv.config({
  path: envPath
});

const parseSessionIdleTimeoutMinutes = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 120;
  }

  return Math.floor(parsedValue);
};

const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  sessionIdleTimeoutMinutes: parseSessionIdleTimeoutMinutes(
    process.env.SESSION_IDLE_TIMEOUT_MINUTES
  ),
  sessionSecret: process.env.SESSION_SECRET || ''
};

module.exports = config;
