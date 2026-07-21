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

const parseBoolean = (value, fallbackValue = false) => {
  if (typeof value !== 'string') {
    return fallbackValue;
  }

  if (value.trim().toLowerCase() === 'true') {
    return true;
  }

  if (value.trim().toLowerCase() === 'false') {
    return false;
  }

  return fallbackValue;
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
  'SESSION_ADMIN_IDLE_TIMEOUT_MINUTES',
  'SESSION_ADMIN_ABSOLUTE_LIFETIME_HOURS',
  'SESSION_REMEMBER_MANAGER_IDLE_TIMEOUT_MINUTES',
  'SESSION_REMEMBER_STAFF_IDLE_TIMEOUT_MINUTES',
  'SESSION_ABSOLUTE_LIFETIME_HOURS',
  'SESSION_REMEMBER_ABSOLUTE_LIFETIME_HOURS'
];

const passwordPepperCurrentVersion = parsePositiveInteger(
  process.env.PASSWORD_PEPPER_CURRENT_VERSION,
  1
);
const getPasswordPepper = (version) => {
  if (!Number.isInteger(version) || version <= 0) {
    return '';
  }

  const value = process.env[`PASSWORD_PEPPER_V${version}`];
  return typeof value === 'string' ? value.trim() : '';
};
const passwordPepperConfigurationReady = Boolean(
  hasExplicitEnvValue('PASSWORD_PEPPER_CURRENT_VERSION') &&
  getPasswordPepper(passwordPepperCurrentVersion)
);

const config = {
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || '',
  brevoFromName: process.env.BREVO_FROM_NAME || 'Smart Schedule',
  databaseUrl: process.env.DATABASE_URL || '',
  adminInvitationExpiryMinutes: parsePositiveInteger(
    process.env.ADMIN_INVITATION_EXPIRY_MINUTES,
    60
  ),
  firstAdminBootstrapToken: process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN || '',
  firstManagerBootstrapToken: process.env.FIRST_MANAGER_BOOTSTRAP_TOKEN || '',
  getPasswordPepper,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  passwordResetExpiryMinutes: parsePositiveInteger(
    process.env.PASSWORD_RESET_EXPIRY_MINUTES,
    30
  ),
  productionSessionEnvNames,
  passwordPepperConfigurationReady,
  passwordPepperCurrentVersion,
  sessionAdminAbsoluteLifetimeHours: parsePositiveInteger(
    process.env.SESSION_ADMIN_ABSOLUTE_LIFETIME_HOURS,
    8
  ),
  sessionAdminIdleTimeoutMinutes: parsePositiveInteger(
    process.env.SESSION_ADMIN_IDLE_TIMEOUT_MINUTES,
    30
  ),
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
  sessionProductionConfigReady: productionSessionEnvNames.every(hasExplicitEnvValue),
  submissionReviewAccountsEnabled: parseBoolean(
    process.env.SUBMISSION_REVIEW_ACCOUNTS_ENABLED,
    false
  )
};

if (config.nodeEnv === 'production' && !passwordPepperConfigurationReady) {
  throw new Error(
    `Production password pepper configuration is incomplete. Set PASSWORD_PEPPER_CURRENT_VERSION and PASSWORD_PEPPER_V${passwordPepperCurrentVersion}.`
  );
}

module.exports = config;
