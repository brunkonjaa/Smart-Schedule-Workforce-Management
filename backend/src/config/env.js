const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const localTestEnvPath = path.resolve(__dirname, '../../local-evidence.env');
const envPath = process.env.NODE_ENV === 'test' && fs.existsSync(localTestEnvPath)
  ? localTestEnvPath
  : fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath;

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

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
};

const hasExplicitEnvValue = (name) => {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== '';
};

const legacySessionIdleTimeoutMinutes = parseSessionIdleTimeoutMinutes(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES
);
const productionSessionEnvNames = [
  'SESSION_SECRET',
  'SESSION_MANAGER_IDLE_TIMEOUT_MINUTES',
  'SESSION_STAFF_IDLE_TIMEOUT_MINUTES',
  'SESSION_REMEMBER_MANAGER_IDLE_TIMEOUT_MINUTES',
  'SESSION_REMEMBER_STAFF_IDLE_TIMEOUT_MINUTES',
  'SESSION_ABSOLUTE_LIFETIME_HOURS',
  'SESSION_REMEMBER_ABSOLUTE_LIFETIME_HOURS'
];

const config = {
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || '',
  brevoFromName: process.env.BREVO_FROM_NAME || 'Smart Schedule',
  databaseUrl: process.env.DATABASE_URL || '',
  firstManagerBootstrapToken: process.env.FIRST_MANAGER_BOOTSTRAP_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  passwordResetExpiryMinutes: parsePositiveInteger(
    process.env.PASSWORD_RESET_EXPIRY_MINUTES,
    30
  ),
  productionSessionEnvNames,
  sessionAbsoluteLifetimeHours: parsePositiveInteger(
    process.env.SESSION_ABSOLUTE_LIFETIME_HOURS,
    24 * 7
  ),
  sessionManagerIdleTimeoutMinutes: parsePositiveInteger(
    process.env.SESSION_MANAGER_IDLE_TIMEOUT_MINUTES,
    Math.min(legacySessionIdleTimeoutMinutes, 120)
  ),
  sessionRememberAbsoluteLifetimeHours: parsePositiveInteger(
    process.env.SESSION_REMEMBER_ABSOLUTE_LIFETIME_HOURS,
    24 * 30
  ),
  sessionRememberManagerIdleTimeoutMinutes: parsePositiveInteger(
    process.env.SESSION_REMEMBER_MANAGER_IDLE_TIMEOUT_MINUTES,
    12 * 60
  ),
  sessionRememberStaffIdleTimeoutMinutes: parsePositiveInteger(
    process.env.SESSION_REMEMBER_STAFF_IDLE_TIMEOUT_MINUTES,
    72 * 60
  ),
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionStaffIdleTimeoutMinutes: parsePositiveInteger(
    process.env.SESSION_STAFF_IDLE_TIMEOUT_MINUTES,
    Math.max(legacySessionIdleTimeoutMinutes, 8 * 60)
  ),
  sessionProductionConfigReady: productionSessionEnvNames.every(hasExplicitEnvValue)
};

module.exports = config;
