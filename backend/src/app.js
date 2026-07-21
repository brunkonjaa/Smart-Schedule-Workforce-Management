const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config/env');
const { checkDatabaseConnection } = require('./config/db');
const { getReleaseCommit } = require('./config/release');
const {
  buildHelmetOptions,
  configureTrustProxy
} = require('./config/http-security');
const { sessionMiddleware } = require('./config/session');
const {
  apiRateLimiter,
  healthRateLimiter
} = require('./config/rate-limit');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const staffRoutes = require('./routes/staff');
const leaveRequestRoutes = require('./routes/leave-requests');
const shiftRoutes = require('./routes/shifts');
const assignmentRoutes = require('./routes/assignments');
const rotaRoutes = require('./routes/rota');
const shiftSwapRoutes = require('./routes/shift-swaps');
const auditLogRoutes = require('./routes/audit-logs');
const chatRoutes = require('./routes/chat');
const { requestErrorHandler } = require('./middleware/error-handler');

const frontendPublicDirectory = path.resolve(__dirname, '../../frontend/public');
const frontendSourceDirectory = path.resolve(__dirname, '../../frontend/src');
const assetsDirectory = path.resolve(__dirname, '../../assets');

const app = express();

app.disable('x-powered-by');
configureTrustProxy(app, config.nodeEnv);
app.use(helmet(buildHelmetOptions(config.appBaseUrl)));
app.use(compression());
app.use(sessionMiddleware);
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 25 }));
app.use('/src', express.static(frontendSourceDirectory));
app.use('/assets', express.static(assetsDirectory));
app.use('/api/v1', apiRateLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/leave-requests', leaveRequestRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/rota', rotaRoutes);
app.use('/api/v1/shift-swaps', shiftSwapRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use(express.static(frontendPublicDirectory));

app.get('/health', healthRateLimiter, async (request, response) => {
  const releaseCommit = getReleaseCommit();

  try {
    await checkDatabaseConnection();

    response.status(200).json({
      database: 'connected',
      releaseCommit,
      status: 'ok'
    });
  } catch (error) {
    response.status(503).json({
      database: 'disconnected',
      releaseCommit,
      status: 'error'
    });
  }
});

app.use(requestErrorHandler);

module.exports = app;
