const { Pool } = require('pg');
const config = require('./env');

const sslQueryParameters = ['sslcert', 'sslkey', 'sslmode', 'sslrootcert'];

const isLocalDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) {
    return true;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    return ['127.0.0.1', 'localhost'].includes(parsedUrl.hostname);
  } catch (error) {
    return (
      databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
    );
  }
};

const stripConnectionStringSslSettings = (databaseUrl) => {
  if (!databaseUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(databaseUrl);

    sslQueryParameters.forEach((parameter) => {
      parsedUrl.searchParams.delete(parameter);
    });

    return parsedUrl.toString();
  } catch (error) {
    return databaseUrl;
  }
};

const buildPoolConfig = (databaseUrl) => {
  const shouldUseSsl = !isLocalDatabaseUrl(databaseUrl);
  const poolConfig = {
    connectionString: shouldUseSsl
      ? stripConnectionStringSslSettings(databaseUrl)
      : databaseUrl
  };

  if (!shouldUseSsl) {
    return poolConfig;
  }

  return {
    ...poolConfig,
    enableChannelBinding: true,
    ssl: {
      rejectUnauthorized: true
    }
  };
};

const pool = new Pool(buildPoolConfig(config.databaseUrl));

const query = (text, params) => {
  return pool.query(text, params);
};

const allowedIsolationLevels = new Set([
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE'
]);

const withTransaction = async (handler, options = {}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (options.isolationLevel) {
      const isolationLevel = String(options.isolationLevel).trim().toUpperCase();

      if (!allowedIsolationLevels.has(isolationLevel)) {
        throw new Error(`Unsupported transaction isolation level "${options.isolationLevel}".`);
      }

      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    }

    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Keep the original error because it is the actual failure.
    }

    throw error;
  } finally {
    client.release();
  }
};

const checkDatabaseConnection = async () => {
  await pool.query('SELECT 1');
};

const closePool = async () => {
  await pool.end();
};

module.exports = {
  buildPoolConfig,
  checkDatabaseConnection,
  closePool,
  isLocalDatabaseUrl,
  pool,
  query,
  stripConnectionStringSslSettings,
  withTransaction
};
