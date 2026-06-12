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
  stripConnectionStringSslSettings
};
