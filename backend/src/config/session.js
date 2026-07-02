const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const config = require('./env');
const { pool } = require('./db');

const PgSessionStore = connectPgSimple(session);
const developmentFallbackSecret = 'smart-schedule-dev-session-secret';
const sessionCookieName = 'smart_schedule.sid';
const baseSessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production'
};
const sessionCookieClearOptions = {
  httpOnly: baseSessionCookieOptions.httpOnly,
  sameSite: baseSessionCookieOptions.sameSite,
  secure: baseSessionCookieOptions.secure
};

const assertProductionSessionConfig = () => {
  if (config.nodeEnv !== 'production') {
    return;
  }

  const missingValues = config.productionSessionEnvNames.filter((name) => {
    return typeof process.env[name] !== 'string' || process.env[name].trim() === '';
  });

  if (missingValues.length > 0 || !config.sessionProductionConfigReady) {
    throw new Error(
      `Production session configuration is incomplete. Set: ${missingValues.join(', ')}.`
    );
  }
};

const resolveSessionSecret = () => {
  if (config.sessionSecret) {
    return config.sessionSecret;
  }

  if (config.nodeEnv !== 'production') {
    return developmentFallbackSecret;
  }

  throw new Error('SESSION_SECRET must be set when NODE_ENV is production.');
};

const resolveSessionPolicy = ({ rememberMe = false, role = 'STAFF' } = {}) => {
  const normalizedRole = role === 'MANAGER' ? 'MANAGER' : 'STAFF';
  const isRememberedSession = Boolean(rememberMe);
  let idleTimeoutMinutes = config.sessionStaffIdleTimeoutMinutes;

  if (normalizedRole === 'MANAGER') {
    idleTimeoutMinutes = isRememberedSession
      ? config.sessionRememberManagerIdleTimeoutMinutes
      : config.sessionManagerIdleTimeoutMinutes;
  } else if (isRememberedSession) {
    idleTimeoutMinutes = config.sessionRememberStaffIdleTimeoutMinutes;
  }

  const absoluteLifetimeHours = isRememberedSession
    ? config.sessionRememberAbsoluteLifetimeHours
    : config.sessionAbsoluteLifetimeHours;

  return {
    absoluteLifetimeMs: absoluteLifetimeHours * 60 * 60 * 1000,
    idleTimeoutMs: idleTimeoutMinutes * 60 * 1000,
    rememberMe: isRememberedSession,
    role: normalizedRole
  };
};

const applySessionPolicy = (request, policyInput) => {
  const policy = resolveSessionPolicy(policyInput);

  request.session.auth = {
    absoluteExpiresAt: new Date(Date.now() + policy.absoluteLifetimeMs).toISOString(),
    idleTimeoutMs: policy.idleTimeoutMs,
    rememberMe: policy.rememberMe,
    role: policy.role
  };
  request.session.cookie.maxAge = policy.idleTimeoutMs;

  return policy;
};

assertProductionSessionConfig();

const sessionMiddleware = session({
  store: new PgSessionStore({
    createTableIfMissing: true,
    pool,
    tableName: 'user_sessions'
  }),
  name: sessionCookieName,
  secret: resolveSessionSecret(),
  resave: false,
  rolling: true,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    ...baseSessionCookieOptions,
    maxAge: config.sessionManagerIdleTimeoutMinutes * 60 * 1000
  }
});

module.exports = {
  applySessionPolicy,
  baseSessionCookieOptions,
  resolveSessionPolicy,
  sessionCookieClearOptions,
  sessionCookieName,
  sessionMiddleware
};
