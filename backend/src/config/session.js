const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const config = require('./env');
const { pool } = require('./db');

const PgSessionStore = connectPgSimple(session);
const developmentFallbackSecret = 'smart-schedule-dev-session-secret';
const sessionCookieName = 'smart_schedule.sid';
const sessionIdleTimeoutMs = config.sessionIdleTimeoutMinutes * 60 * 1000;
const sessionCookieOptions = {
  httpOnly: true,
  maxAge: sessionIdleTimeoutMs,
  sameSite: 'lax',
  secure: config.nodeEnv === 'production'
};
const sessionCookieClearOptions = {
  httpOnly: sessionCookieOptions.httpOnly,
  sameSite: sessionCookieOptions.sameSite,
  secure: sessionCookieOptions.secure
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
  cookie: sessionCookieOptions
});

module.exports = {
  sessionCookieClearOptions,
  sessionIdleTimeoutMs,
  sessionCookieOptions,
  sessionCookieName,
  sessionMiddleware
};
