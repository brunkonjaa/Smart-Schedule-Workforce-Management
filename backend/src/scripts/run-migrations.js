const { closePool } = require('../config/db');
const { getMigrationStatus, runPendingMigrations } = require('../database/migrations');

const command = process.argv[2] || 'up';

const printStatus = async () => {
  const statuses = await getMigrationStatus();

  if (statuses.length === 0) {
    console.log('No migration files found in database/migrations.');
    return;
  }

  statuses.forEach(({ fileName, status }) => {
    console.log(`${status.padEnd(7)} ${fileName}`);
  });
};

const run = async () => {
  try {
    if (command === 'status') {
      await printStatus();
      return;
    }

    if (command !== 'up') {
      throw new Error(`Unknown migration command "${command}". Use "up" or "status".`);
    }

    const result = await runPendingMigrations();

    if (result.totalCount === 0) {
      console.log('No migration files found in database/migrations.');
      return;
    }

    if (result.appliedThisRun.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    result.appliedThisRun.forEach((fileName) => {
      console.log(`Applied ${fileName}`);
    });
  } finally {
    await closePool();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
