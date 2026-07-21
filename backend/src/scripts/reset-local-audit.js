process.env.NODE_ENV = 'test';

const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, query } = require('../config/db');

const run = async () => {
  if (!isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Audit reset is restricted to a local PostgreSQL database.');
  }

  const result = await query('DELETE FROM audit_logs');
  console.log(`Local audit rows removed: ${result.rowCount}`);
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
