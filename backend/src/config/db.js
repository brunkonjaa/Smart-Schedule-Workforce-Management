const { Pool } = require('pg');
const config = require('./env');

const shouldUseSsl =
  config.databaseUrl &&
  !config.databaseUrl.includes('localhost') &&
  !config.databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
});

const query = (text, params) => {
  return pool.query(text, params);
};

const checkDatabaseConnection = async () => {
  await pool.query('SELECT 1');
};

module.exports = {
  checkDatabaseConnection,
  pool,
  query
};
