const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');
const defaultLocalEnvPath = path.join(backendRoot, 'local-evidence.env');
const exampleLocalEnvPath = path.join(backendRoot, 'local-evidence.env.example');

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('--')) || 'check';
const envFileArg = args.find((arg) => arg.startsWith('--env-file='));
const envFilePath = envFileArg
  ? path.resolve(process.cwd(), envFileArg.split('=').slice(1).join('='))
  : defaultLocalEnvPath;

if (fs.existsSync(envFilePath)) {
  dotenv.config({
    override: true,
    path: envFilePath
  });
}

const config = require('../config/env');
const {
  closePool,
  isLocalDatabaseUrl,
  query,
  withTransaction
} = require('../config/db');
const { getMigrationStatus, runPendingMigrations } = require('../database/migrations');

const evidenceDomain = 'gmail.com';
const legacyEvidenceDomain = 'evidence.smart-schedule.test';
const interimEvidenceDomain = 'qa.smart-schedule.test';
const evidenceManagerEmail = `maeveoconnorfake@${evidenceDomain}`;
const evidenceManagerPassword = process.env.LOCAL_EVIDENCE_MANAGER_PASSWORD ||
  crypto.randomBytes(32).toString('base64url');
const evidenceStaffPassword = process.env.LOCAL_EVIDENCE_STAFF_PASSWORD ||
  crypto.randomBytes(32).toString('base64url');
const evidenceWeekStart = '2026-07-13';
const evidenceTargetShiftDate = '2026-07-15';
const evidenceTargetShiftTime = {
  endTime: '21:00',
  startTime: '15:00'
};
const seededShiftNotes = [
  'Wednesday evening bar shift',
  'Monday bar opening',
  'Monday bar preparation',
  'Thursday bar preparation',
  'Friday daytime bar shift',
  'Wednesday late bar cover',
  'Wednesday daytime bar shift',
  'Tuesday bar opening'
];

const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);

const parseDatabaseTarget = () => {
  if (!config.databaseUrl) {
    return {
      database: '',
      host: '',
      local: false,
      present: false
    };
  }

  try {
    const parsedUrl = new URL(config.databaseUrl);

    return {
      database: parsedUrl.pathname.replace(/^\//, ''),
      host: parsedUrl.hostname,
      local: localHostnames.has(parsedUrl.hostname),
      present: true
    };
  } catch (error) {
    return {
      database: '',
      host: '',
      local: isLocalDatabaseUrl(config.databaseUrl),
      present: true
    };
  }
};

const assertLocalDatabase = () => {
  const target = parseDatabaseTarget();

  if (!target.present) {
    throw new Error(
      `DATABASE_URL is missing. Copy ${path.relative(backendRoot, exampleLocalEnvPath)} to local-evidence.env and add the local database connection details.`
    );
  }

  if (!target.local || !isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error(
      `Refusing to run local evidence command against non-local database host "${target.host || 'unknown'}". Use backend/local-evidence.env with localhost first.`
    );
  }

  return target;
};

const printTarget = (target) => {
  console.log(`Local evidence env file: ${fs.existsSync(envFilePath) ? envFilePath : 'not found'}`);
  console.log(`Database host: ${target.host || 'unknown'}`);
  console.log(`Database name: ${target.database || 'unknown'}`);
};

const checkConnection = async () => {
  const result = await query('SELECT current_database() AS database, current_user AS user_name');
  const row = result.rows[0];

  console.log(`Connected as ${row.user_name} to ${row.database}`);
};

const printMigrationSummary = async () => {
  const statuses = await getMigrationStatus();
  const pending = statuses.filter((status) => status.status !== 'APPLIED');

  console.log(`Migrations applied: ${statuses.length - pending.length}/${statuses.length}`);

  if (pending.length > 0) {
    console.log(`Pending migrations: ${pending.map((status) => status.fileName).join(', ')}`);
  }
};

const assertMigrationsApplied = async () => {
  const statuses = await getMigrationStatus();
  const pending = statuses.filter((status) => status.status !== 'APPLIED');

  if (pending.length > 0) {
    throw new Error(
      `Local database has pending migrations. Run npm run local:evidence:migrate first. Pending: ${pending.map((status) => status.fileName).join(', ')}`
    );
  }
};

const runMigrations = async () => {
  const result = await runPendingMigrations();

  if (result.totalCount === 0) {
    console.log('No migration files found.');
    return;
  }

  if (result.appliedThisRun.length === 0) {
    console.log('No pending migrations. Database is up to date.');
    return;
  }

  result.appliedThisRun.forEach((fileName) => {
    console.log(`Applied ${fileName}`);
  });
};

const insertRows = async (client, tableName, columns, rows) => {
  if (rows.length === 0) {
    return;
  }

  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowPlaceholders = columns.map((columnName, columnIndex) => {
      values.push(row[columnName]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });

    return `(${rowPlaceholders.join(', ')})`;
  });

  await client.query(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
    values
  );
};

const staffEmail = (name) => {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}fake@${evidenceDomain}`;
};

const buildStaffSeeds = () => {
  return [
    {
      key: 'bestCandidate',
      contractHours: 30,
      fullName: "Sean O'Connor",
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'darraghTie',
      contractHours: 24,
      fullName: 'Darragh Doyle',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'roisinTie',
      contractHours: 24,
      fullName: 'Roisin Walsh',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'overContract',
      contractHours: 8,
      fullName: 'Oisin Murphy',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'heavyWorkload',
      contractHours: 18,
      fullName: 'Niamh Kelly',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'inactive',
      contractHours: 24,
      fullName: 'Cormac Hayes',
      isActive: false,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'wrongRole',
      contractHours: 24,
      fullName: 'Caoimhe Ryan',
      isActive: true,
      primaryRole: 'FLOOR',
      userIsActive: true
    },
    {
      key: 'leave',
      contractHours: 24,
      fullName: 'Orla Collins',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'barReserveOne',
      contractHours: 24,
      fullName: 'Fionn Byrne',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'barReserveTwo',
      contractHours: 24,
      fullName: 'Saoirse Flynn',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'overlap',
      contractHours: 24,
      fullName: 'Cian Quinn',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    },
    {
      key: 'touching',
      contractHours: 24,
      fullName: 'Aisling Nolan',
      isActive: true,
      primaryRole: 'BAR',
      userIsActive: true
    }
  ].map((staffMember, index) => {
    return {
      ...staffMember,
      email: staffEmail(staffMember.fullName),
      id: crypto.randomUUID(),
      phoneNumber: `08571010${String(index).padStart(2, '0')}`,
      userId: crypto.randomUUID()
    };
  });
};

const deleteExistingEvidenceData = async (client) => {
  const currentEvidenceEmails = [
    evidenceManagerEmail,
    ...buildStaffSeeds().map((staffMember) => staffMember.email)
  ];
  const usersResult = await client.query(
    'SELECT id FROM users WHERE email = ANY($1::text[]) OR email LIKE $2 OR email LIKE $3',
    [
      currentEvidenceEmails,
      `%@${legacyEvidenceDomain}`,
      `%@${interimEvidenceDomain}`
    ]
  );
  const userIds = usersResult.rows.map((row) => row.id);

  const staffResult =
    userIds.length > 0
      ? await client.query(
          'SELECT id FROM staff_profiles WHERE user_id = ANY($1::uuid[])',
          [userIds]
        )
      : { rows: [] };
  const staffIds = staffResult.rows.map((row) => row.id);

  const shiftResult = await client.query(
    `SELECT id
     FROM shifts
     WHERE notes LIKE 'Evidence rota%'
        OR notes LIKE 'Evidence recommendation%'
        OR notes = ANY($1::text[])`,
    [seededShiftNotes]
  );
  const shiftIds = shiftResult.rows.map((row) => row.id);

  if (shiftIds.length > 0 || staffIds.length > 0 || userIds.length > 0) {
    await client.query(
      `
        DELETE FROM shift_assignments
        WHERE shift_id = ANY($1::uuid[])
           OR staff_profile_id = ANY($2::uuid[])
           OR assigned_by_user_id = ANY($3::uuid[])
      `,
      [shiftIds, staffIds, userIds]
    );
  }

  if (staffIds.length > 0 || userIds.length > 0) {
    await client.query(
      `
        DELETE FROM leave_requests
        WHERE staff_profile_id = ANY($1::uuid[])
           OR decided_by_user_id = ANY($2::uuid[])
      `,
      [staffIds, userIds]
    );
  }

  await client.query(
    `DELETE FROM shifts
     WHERE notes LIKE 'Evidence rota%'
        OR notes LIKE 'Evidence recommendation%'
        OR notes = ANY($1::text[])`,
    [seededShiftNotes]
  );

  if (userIds.length > 0) {
    await client.query('DELETE FROM staff_profiles WHERE user_id = ANY($1::uuid[])', [
      userIds
    ]);
    await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
  }
};

const seedRotaEvidence = async () => {
  await assertMigrationsApplied();

  const managerUserId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const managerPasswordHash = await bcrypt.hash(evidenceManagerPassword, 10);
  const staffPasswordHash = await bcrypt.hash(evidenceStaffPassword, 10);
  const staffSeeds = buildStaffSeeds();
  const staffByKey = new Map(staffSeeds.map((staffMember) => [staffMember.key, staffMember]));

  const shiftIds = {
    darraghHours: crypto.randomUUID(),
    heavyHoursOne: crypto.randomUUID(),
    heavyHoursTwo: crypto.randomUUID(),
    overlapExisting: crypto.randomUUID(),
    overContractHours: crypto.randomUUID(),
    target: crypto.randomUUID(),
    touchingExisting: crypto.randomUUID(),
    roisinHours: crypto.randomUUID()
  };

  await withTransaction(async (client) => {
    await deleteExistingEvidenceData(client);

    await insertRows(
      client,
      'users',
      [
        'id',
        'email',
        'password_hash',
        'role',
        'is_active',
        'must_change_password',
        'password_changed_at',
        'created_at',
        'updated_at'
      ],
      [
        {
          created_at: new Date(),
          email: evidenceManagerEmail,
          id: managerUserId,
          is_active: true,
          must_change_password: false,
          password_changed_at: new Date(),
          password_hash: managerPasswordHash,
          role: 'MANAGER',
          updated_at: new Date()
        },
        ...staffSeeds.map((staffMember) => ({
          created_at: new Date(),
          email: staffMember.email,
          id: staffMember.userId,
          is_active: staffMember.userIsActive,
          must_change_password: false,
          password_changed_at: new Date(),
          password_hash: staffPasswordHash,
          role: 'STAFF',
          updated_at: new Date()
        }))
      ]
    );

    await insertRows(
      client,
      'staff_profiles',
      [
        'id',
        'user_id',
        'full_name',
        'primary_role',
        'contract_hours',
        'phone_number',
        'is_active',
        'created_at',
        'updated_at'
      ],
      [
        {
          contract_hours: 40,
          created_at: new Date(),
          full_name: "Maeve O'Connor",
          id: managerStaffProfileId,
          is_active: true,
          phone_number: '0857101000',
          primary_role: 'FLOOR',
          updated_at: new Date(),
          user_id: managerUserId
        },
        ...staffSeeds.map((staffMember) => ({
          contract_hours: staffMember.contractHours,
          created_at: new Date(),
          full_name: staffMember.fullName,
          id: staffMember.id,
          is_active: staffMember.isActive,
          phone_number: staffMember.phoneNumber,
          primary_role: staffMember.primaryRole,
          updated_at: new Date(),
          user_id: staffMember.userId
        }))
      ]
    );

    await insertRows(
      client,
      'shifts',
      [
        'id',
        'shift_date',
        'start_time',
        'end_time',
        'required_role',
        'status',
        'notes',
        'created_at',
        'updated_at'
      ],
      [
        {
          created_at: new Date(),
          end_time: evidenceTargetShiftTime.endTime,
          id: shiftIds.target,
          notes: seededShiftNotes[0],
          required_role: 'BAR',
          shift_date: evidenceTargetShiftDate,
          start_time: evidenceTargetShiftTime.startTime,
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '17:00',
          id: shiftIds.darraghHours,
          notes: seededShiftNotes[1],
          required_role: 'BAR',
          shift_date: '2026-07-13',
          start_time: '09:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '18:00',
          id: shiftIds.heavyHoursOne,
          notes: seededShiftNotes[2],
          required_role: 'BAR',
          shift_date: '2026-07-13',
          start_time: '08:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '16:00',
          id: shiftIds.heavyHoursTwo,
          notes: seededShiftNotes[3],
          required_role: 'BAR',
          shift_date: '2026-07-16',
          start_time: '08:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '16:00',
          id: shiftIds.overContractHours,
          notes: seededShiftNotes[4],
          required_role: 'BAR',
          shift_date: '2026-07-17',
          start_time: '08:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '23:00',
          id: shiftIds.overlapExisting,
          notes: seededShiftNotes[5],
          required_role: 'BAR',
          shift_date: evidenceTargetShiftDate,
          start_time: '18:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '15:00',
          id: shiftIds.touchingExisting,
          notes: seededShiftNotes[6],
          required_role: 'BAR',
          shift_date: evidenceTargetShiftDate,
          start_time: '09:00',
          status: 'OPEN',
          updated_at: new Date()
        },
        {
          created_at: new Date(),
          end_time: '17:00',
          id: shiftIds.roisinHours,
          notes: seededShiftNotes[7],
          required_role: 'BAR',
          shift_date: '2026-07-14',
          start_time: '09:00',
          status: 'OPEN',
          updated_at: new Date()
        }
      ]
    );

    await insertRows(
      client,
      'leave_requests',
      [
        'staff_profile_id',
        'start_date',
        'end_date',
        'reason',
        'status',
        'manager_comment',
        'decided_by_user_id',
        'decided_at',
        'created_at',
        'updated_at'
      ],
      [
        {
          created_at: new Date(),
          decided_at: new Date(),
          decided_by_user_id: managerUserId,
          end_date: evidenceTargetShiftDate,
          manager_comment: 'Approved',
          reason: 'Annual leave',
          staff_profile_id: staffByKey.get('leave').id,
          start_date: evidenceTargetShiftDate,
          status: 'APPROVED',
          updated_at: new Date()
        }
      ]
    );

    await insertRows(
      client,
      'shift_assignments',
      [
        'shift_id',
        'staff_profile_id',
        'assigned_by_user_id',
        'assigned_at',
        'created_at',
        'updated_at'
      ],
      [
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.darraghHours,
          staff_profile_id: staffByKey.get('darraghTie').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.roisinHours,
          staff_profile_id: staffByKey.get('roisinTie').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.overContractHours,
          staff_profile_id: staffByKey.get('overContract').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.heavyHoursOne,
          staff_profile_id: staffByKey.get('heavyWorkload').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.heavyHoursTwo,
          staff_profile_id: staffByKey.get('heavyWorkload').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.overlapExisting,
          staff_profile_id: staffByKey.get('overlap').id,
          updated_at: new Date()
        },
        {
          assigned_at: new Date(),
          assigned_by_user_id: managerUserId,
          created_at: new Date(),
          shift_id: shiftIds.touchingExisting,
          staff_profile_id: staffByKey.get('touching').id,
          updated_at: new Date()
        }
      ]
    );
  });

  console.log('Local rota evidence data seeded.');
  console.log(`Manager login: ${evidenceManagerEmail}`);
  console.log('Local evidence credentials were prepared without printing the password.');
  console.log(`Week start: ${evidenceWeekStart}`);
  console.log(
    `Target shift: ${evidenceTargetShiftDate} ${evidenceTargetShiftTime.startTime}-${evidenceTargetShiftTime.endTime} BAR`
  );
  console.log(`Target shift id: ${shiftIds.target}`);
  console.log(`Evidence staff records: ${staffSeeds.length}`);
};

const run = async () => {
  const target = assertLocalDatabase();
  printTarget(target);

  if (command === 'check') {
    await checkConnection();
    await printMigrationSummary();
    return;
  }

  if (command === 'migrate') {
    await checkConnection();
    await runMigrations();
    await printMigrationSummary();
    return;
  }

  if (command === 'seed-rota') {
    await checkConnection();
    await seedRotaEvidence();
    return;
  }

  if (command === 'all') {
    await checkConnection();
    await runMigrations();
    await seedRotaEvidence();
    return;
  }

  throw new Error(
    `Unknown local evidence command "${command}". Use check, migrate, seed-rota, or all.`
  );
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
