process.env.NODE_ENV = 'test';

const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, query } = require('../config/db');

const run = async () => {
  if (!isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Audit storage measurement is restricted to a local PostgreSQL database.');
  }

  const result = await query(
    `SELECT COUNT(*)::INTEGER AS row_count,
            pg_total_relation_size('audit_logs')::BIGINT AS total_bytes
     FROM audit_logs`
  );
  const actions = await query(
    `SELECT action, COUNT(*)::INTEGER AS row_count
     FROM audit_logs
     GROUP BY action
     ORDER BY action`
  );
  console.log(`Local audit rows: ${result.rows[0].row_count}`);
  console.log(`Local audit table and indexes: ${result.rows[0].total_bytes} bytes`);
  for (const row of actions.rows) {
    console.log(`${row.action}: ${row.row_count}`);
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
