const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const migrationsDirectory = path.resolve(__dirname, '../../../database/migrations');
const migrationTableName = 'schema_migrations';
const migrationFilePattern = /^\d+_.+\.sql$/;

const ensureMigrationDirectoryExists = () => {
  if (!fs.existsSync(migrationsDirectory)) {
    fs.mkdirSync(migrationsDirectory, { recursive: true });
  }
};

const getMigrationFiles = () => {
  ensureMigrationDirectoryExists();

  const files = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.sql')
    .map((entry) => entry.name)
    .sort((left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    );

  const invalidFiles = files.filter((fileName) => !migrationFilePattern.test(fileName));

  if (invalidFiles.length > 0) {
    throw new Error(
      `Invalid migration filenames: ${invalidFiles.join(
        ', '
      )}. Use names like 001_create_users.sql.`
    );
  }

  const seenPrefixes = new Set();

  files.forEach((fileName) => {
    const prefix = fileName.split('_')[0];

    if (seenPrefixes.has(prefix)) {
      throw new Error(`Duplicate migration prefix found: ${prefix}`);
    }

    seenPrefixes.add(prefix);
  });

  return files;
};

const readMigrationFile = (fileName) => {
  const filePath = path.join(migrationsDirectory, fileName);
  const fileContents = fs.readFileSync(filePath, 'utf8').trim();

  if (!fileContents) {
    throw new Error(`Migration file "${fileName}" is empty.`);
  }

  return fileContents;
};

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationTableName} (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getAppliedMigrationNames = async (client) => {
  const result = await client.query(`
    SELECT filename
    FROM ${migrationTableName}
    ORDER BY filename ASC
  `);

  return result.rows.map((row) => row.filename);
};

const getMigrationStatus = async () => {
  const files = getMigrationFiles();
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);

    const appliedMigrations = await getAppliedMigrationNames(client);
    const appliedSet = new Set(appliedMigrations);

    return files.map((fileName) => ({
      fileName,
      status: appliedSet.has(fileName) ? 'APPLIED' : 'PENDING'
    }));
  } finally {
    client.release();
  }
};

const runPendingMigrations = async () => {
  const files = getMigrationFiles();
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);

    const appliedMigrations = await getAppliedMigrationNames(client);
    const appliedSet = new Set(appliedMigrations);
    const pendingMigrations = files.filter((fileName) => !appliedSet.has(fileName));
    const appliedThisRun = [];

    for (const fileName of pendingMigrations) {
      const sql = readMigrationFile(fileName);

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query(`INSERT INTO ${migrationTableName} (filename) VALUES ($1)`, [fileName]);
        await client.query('COMMIT');
        appliedThisRun.push(fileName);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed for "${fileName}": ${error.message}`);
      }
    }

    return {
      appliedThisRun,
      appliedTotal: appliedMigrations.length + appliedThisRun.length,
      pendingCount: pendingMigrations.length,
      totalCount: files.length
    };
  } finally {
    client.release();
  }
};

module.exports = {
  getMigrationStatus,
  migrationTableName,
  migrationsDirectory,
  runPendingMigrations
};
