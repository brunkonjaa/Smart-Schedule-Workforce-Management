const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const config = require('./env');
const { pool } = require('./db');

const PgSessionStore = connectPgSimple(session);
const developmentFallbackSecret = 'smart-schedule-dev-session-secret';
const sessionCookieName = 'smart_schedule.sid';

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
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production'
  }
});

module.exports = {
  sessionCookieName,
  sessionMiddleware
};
