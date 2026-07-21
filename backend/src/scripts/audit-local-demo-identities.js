process.env.NODE_ENV = 'test';

const { closePool, isLocalDatabaseUrl, query } = require('../config/db');
const config = require('../config/env');
const { firstAdminEmail } = require('../services/admin-service');

const implementationLabelPattern = /\b(?:admin|assignment|evidence|manager|middleware|route|staff|test)\b/i;
const ownerAccountEmails = new Set([firstAdminEmail, 'brunkonjaa@gmail.com']);

const run = async () => {
  if (!isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Local identity audit refused a non-local database URL.');
  }

  const result = await query(
    `
      SELECT
        u.email,
        COALESCE(NULLIF(u.display_name, ''), NULLIF(sp.full_name, '')) AS person_name
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
    `
  );

  const fakeMarkedGmail = result.rows.filter((row) => /fake@gmail\.com$/i.test(row.email));
  const fixedOwnerAccounts = result.rows.filter((row) => ownerAccountEmails.has(row.email));
  const missingPersonName = result.rows.filter((row) => !row.person_name);
  const implementationLabels = result.rows.filter((row) => {
    return row.person_name && implementationLabelPattern.test(row.person_name);
  });

  console.log(`Local identities: ${result.rowCount}`);
  console.log(`Fake-marked Gmail addresses: ${fakeMarkedGmail.length}`);
  console.log(`Fixed owner addresses: ${fixedOwnerAccounts.length}`);
  console.log(`Missing person names: ${missingPersonName.length}`);
  console.log(`Implementation labels used as names: ${implementationLabels.length}`);

  if (
    fakeMarkedGmail.length + fixedOwnerAccounts.length !== result.rowCount
    || missingPersonName.length > 0
    || implementationLabels.length > 0
  ) {
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
