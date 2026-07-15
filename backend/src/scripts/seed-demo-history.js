const bcrypt = require('bcrypt');
const crypto = require('crypto');

const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, pool } = require('../config/db');

const demoDomain = 'demo.smart-schedule.test';
const demoPassword = 'DemoStaffPass123!';
const hashRounds = 12;
const roles = ['BAR', 'FLOOR', 'KITCHEN', 'OTHER'];
const currentWeekOffset = 0;
const nextWeekOffset = 1;
const firstWeekOffset = -12;
const staffCount = 24;
const activeStaffCount = 24;
const resetDemoSeed = process.argv.includes('--reset') || process.env.SMART_SCHEDULE_RESET_DEMO_SEED === 'true';

const fakeFullNames = [
  "Aoife O'Sullivan",
  'Cian Murphy',
  'Niamh Byrne',
  'Eoin Gallagher',
  "Liam O'Rourke",
  "Brid O'Neill",
  'Saoirse Walsh',
  'Conor Kelly',
  "Orla McCarthy",
  "Tadhg O'Brien",
  'Maeve Ryan',
  'Ronan Doyle',
  'Patrick Healy',
  'Molly Keane',
  'Fionn McDonagh',
  'Ciara Kavanagh',
  "Brendan O'Leary",
  'Roisin Farrell',
  "Dara Brennan",
  "Aisling O'Connor",
  'Seamus Flynn',
  'Declan Whelan',
  'Emer Nolan',
  'Cathal Byrne'
];

const rolePlan = [
  ...Array(6).fill('BAR'),
  ...Array(8).fill('FLOOR'),
  ...Array(4).fill('KITCHEN'),
  ...Array(6).fill('OTHER')
];

const pad = (value) => String(value).padStart(2, '0');

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const parseIsoDate = (value) => new Date(`${value}T00:00:00Z`);

const addDays = (dateText, days) => {
  const date = parseIsoDate(dateText);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
};

const getCurrentWeekStart = () => {
  const today = new Date();
  const utcDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const isoDay = utcDate.getUTCDay() === 0 ? 7 : utcDate.getUTCDay();
  utcDate.setUTCDate(utcDate.getUTCDate() - (isoDay - 1));
  return toIsoDate(utcDate);
};

const addWeeks = (weekStart, weeks) => addDays(weekStart, weeks * 7);

const getDayOfWeek = (dateText) => {
  const day = parseIsoDate(dateText).getUTCDay();
  return day === 0 ? 7 : day;
};

const slugify = (value) => {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.');
};

const hasSameDayTimeConflict = (left, right) => {
  return left.startTime < right.endTime && left.endTime > right.startTime;
};

const timeRange = (startTime, endTime) => ({ startTime, endTime });

const buildShiftPatterns = (role, dayIndex) => {
  if (role === 'BAR') {
    return [
      timeRange('10:00', '17:00'),
      timeRange('12:00', '20:00'),
      timeRange('17:00', '23:30')
    ];
  }

  if (role === 'FLOOR') {
    return [
      timeRange('11:00', '16:00'),
      timeRange('12:00', '17:00'),
      timeRange('13:00', '18:00'),
      timeRange('15:00', '21:00')
    ];
  }

  if (role === 'KITCHEN') {
    return [timeRange('10:00', '16:00'), timeRange('15:00', '21:00')];
  }

  return [
    timeRange('10:00', '16:00'),
    timeRange('14:00', '18:00'),
    timeRange('16:00', '22:00')
  ];
};

const buildStaff = () => {
  const currentWeekStart = getCurrentWeekStart();

  return Array.from({ length: staffCount }, (_, index) => {
    const fullName = fakeFullNames[index];
    const paddedNumber = pad(index + 1);
    const isActive = index < activeStaffCount;
    const role = rolePlan[index];
    const startOffset = isActive ? -90 + (index % 40) : -104 + (index % 20);
    const endOffset = isActive ? null : -75 + ((index - activeStaffCount) * 4);

    return {
      contractHours: [12, 16, 20, 24, 28, 32, 36, 40][index % 8],
      email: `${slugify(fullName)}.demo.${paddedNumber}@${demoDomain}`,
      endDate: endOffset === null ? null : addWeeks(currentWeekStart, endOffset),
      fullName,
      id: crypto.randomUUID(),
      isActive,
      phoneNumber: `0800000${String(index + 1).padStart(3, '0')}`,
      primaryRole: role,
      startDate: addWeeks(currentWeekStart, startOffset),
      userId: crypto.randomUUID()
    };
  });
};

const isStaffEmployedOnDate = (staffMember, dateText) => {
  if (dateText < staffMember.startDate) {
    return false;
  }

  return !staffMember.endDate || dateText <= staffMember.endDate;
};

const buildLeaveRequests = (staff, managerUserId) => {
  const currentWeekStart = getCurrentWeekStart();

  return staff
    .filter((staffMember) => staffMember.isActive)
    .filter((_, index) => index % 5 === 0)
    .map((staffMember, index) => {
      const leaveWeekOffsets = [-8, -3, 5, 12];
      const weekStart = addWeeks(
        currentWeekStart,
        leaveWeekOffsets[index % leaveWeekOffsets.length]
      );
      const startDate = addDays(weekStart, (index % 4) + 1);

      return {
        decidedByUserId: managerUserId,
        endDate: addDays(startDate, index % 2),
        id: crypto.randomUUID(),
        reason: 'Demo annual leave for rota testing',
        staffProfileId: staffMember.id,
        startDate
      };
    });
};

const hasApprovedLeave = (leaveRequests, staffProfileId, dateText) => {
  return leaveRequests.some((leaveRequest) => {
    return (
      leaveRequest.staffProfileId === staffProfileId &&
      leaveRequest.startDate <= dateText &&
      leaveRequest.endDate >= dateText
    );
  });
};

const shouldKeepShiftOpen = (weekOffset, role, dayIndex, patternIndex) => {
  return false;
};

const chooseStaffForShift = (
  staffByRole,
  leaveRequests,
  assignedWindows,
  assignedDayCounts,
  role,
  shiftDate,
  shiftWindow
) => {
  const candidates = staffByRole[role].filter((staffMember) => {
    if (!isStaffEmployedOnDate(staffMember, shiftDate)) {
      return false;
    }

    if (hasApprovedLeave(leaveRequests, staffMember.id, shiftDate)) {
      return false;
    }

    const staffDateKey = `${staffMember.id}:${shiftDate}`;
    const existingWindows = assignedWindows.get(staffDateKey) || [];

    if (existingWindows.length > 0) {
      return false;
    }

    return !existingWindows.some((existingWindow) => {
      return hasSameDayTimeConflict(existingWindow, shiftWindow);
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftCount = assignedDayCounts.get(left.id) || 0;
    const rightCount = assignedDayCounts.get(right.id) || 0;
    return leftCount - rightCount || left.fullName.localeCompare(right.fullName);
  });

  return candidates[0];
};

const buildRotaRows = (staff, leaveRequests, managerUserId) => {
  const currentWeekStart = getCurrentWeekStart();
  const staffByRole = roles.reduce((groupedStaff, role) => {
    groupedStaff[role] = staff.filter((staffMember) => staffMember.primaryRole === role);
    return groupedStaff;
  }, {});
  const assignedWindows = new Map();
  const shifts = [];
  const assignments = [];

  for (let weekOffset = firstWeekOffset; weekOffset <= nextWeekOffset; weekOffset += 1) {
    const weekStart = addWeeks(currentWeekStart, weekOffset);
    const assignedDayCounts = new Map();

    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const shiftDate = addDays(weekStart, dayIndex);

      roles.forEach((role) => {
        buildShiftPatterns(role, dayIndex).forEach((shiftWindow, patternIndex) => {
          const shiftId = crypto.randomUUID();

          shifts.push({
            endTime: shiftWindow.endTime,
            id: shiftId,
            notes: `Demo ${role.toLowerCase()} rota history`,
            requiredRole: role,
            shiftDate,
            startTime: shiftWindow.startTime
          });

          if (shouldKeepShiftOpen(weekOffset, role, dayIndex, patternIndex)) {
            return;
          }

          const staffMember = chooseStaffForShift(
            staffByRole,
            leaveRequests,
            assignedWindows,
            assignedDayCounts,
            role,
            shiftDate,
            shiftWindow
          );

          if (!staffMember) {
            return;
          }

          const staffDateKey = `${staffMember.id}:${shiftDate}`;
          assignedWindows.set(staffDateKey, [
            ...(assignedWindows.get(staffDateKey) || []),
            shiftWindow
          ]);
          assignedDayCounts.set(
            staffMember.id,
            (assignedDayCounts.get(staffMember.id) || 0) + 1
          );
          assignments.push({
            assignedByUserId: managerUserId,
            id: crypto.randomUUID(),
            shiftId,
            staffProfileId: staffMember.id
          });
        });
      });
    }
  }

  return {
    assignments,
    shifts
  };
};

const getExistingDemoUserCount = async (client) => {
  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE email LIKE $1
    `,
    [`%@${demoDomain}`]
  );

  return result.rows[0].count;
};

const deleteExistingDemoData = async (client) => {
  const demoStaffResult = await client.query(
    `
      SELECT staff_profiles.id
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE users.email LIKE $1
    `,
    [`%@${demoDomain}`]
  );
  const demoStaffProfileIds = demoStaffResult.rows.map((row) => row.id);

  if (demoStaffProfileIds.length > 0) {
    await client.query(
      `
        DELETE FROM security_events
        WHERE staff_profile_id = ANY($1::uuid[])
      `,
      [demoStaffProfileIds]
    );
    await client.query(
      `
        DELETE FROM leave_requests
        WHERE staff_profile_id = ANY($1::uuid[])
      `,
      [demoStaffProfileIds]
    );
    await client.query(
      `
        DELETE FROM shift_assignments
        WHERE staff_profile_id = ANY($1::uuid[])
      `,
      [demoStaffProfileIds]
    );
  }

  await client.query(
    `
      DELETE FROM shifts
      WHERE notes LIKE 'Demo % rota history'
    `
  );
  await client.query(
    `
      DELETE FROM users
      WHERE email LIKE $1
    `,
    [`%@${demoDomain}`]
  );
};

const getManagerUserId = async (client) => {
  const result = await client.query(
    `
      SELECT id
      FROM users
      WHERE role = 'MANAGER'
        AND is_active = TRUE
      ORDER BY created_at ASC
      LIMIT 1
    `
  );

  if (result.rowCount === 0) {
    throw new Error('Demo seed needs one active manager account before it can create assignments.');
  }

  return result.rows[0].id;
};

const insertRows = async (client, tableName, columns, rows, chunkSize = 500) => {
  if (rows.length === 0) {
    return;
  }

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const rowPlaceholders = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });

      return `(${rowPlaceholders.join(', ')})`;
    });

    await client.query(
      `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
      `,
      values
    );
  }
};

const assertDemoSeedAllowed = () => {
  if (config.nodeEnv === 'production') {
    throw new Error('Demo history seed is blocked when NODE_ENV=production.');
  }

  const allowRemoteDemoSeed = process.env.SMART_SCHEDULE_ALLOW_DEMO_SEED === 'true';

  if (!isLocalDatabaseUrl(config.databaseUrl) && !allowRemoteDemoSeed) {
    throw new Error(
      'Demo history seed is blocked for remote databases unless SMART_SCHEDULE_ALLOW_DEMO_SEED=true is set.'
    );
  }
};

const run = async () => {
  let client;

  try {
    assertDemoSeedAllowed();
    client = await pool.connect();

    await client.query('BEGIN');

    let existingDemoUserCount = await getExistingDemoUserCount(client);

    if (existingDemoUserCount > 0) {
      if (!resetDemoSeed) {
        await client.query('ROLLBACK');
        console.log('Demo history already exists. No records added.');
        console.log('Run this script with --reset to rebuild the fake demo rota data.');
        return;
      }

      await deleteExistingDemoData(client);
      existingDemoUserCount = await getExistingDemoUserCount(client);

      if (existingDemoUserCount > 0) {
        throw new Error('Demo history reset did not remove all demo staff users.');
      }
    }

    const managerUserId = await getManagerUserId(client);
    const passwordHash = await bcrypt.hash(demoPassword, hashRounds);
    const staff = buildStaff();
    const leaveRequests = buildLeaveRequests(staff, managerUserId);
    const { assignments, shifts } = buildRotaRows(staff, leaveRequests, managerUserId);

    await insertRows(
      client,
      'users',
      ['id', 'email', 'password_hash', 'role', 'is_active'],
      staff.map((staffMember) => ({
        email: staffMember.email,
        id: staffMember.userId,
        is_active: staffMember.isActive,
        password_hash: passwordHash,
        role: 'STAFF'
      }))
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
        'is_active'
      ],
      staff.map((staffMember) => ({
        contract_hours: staffMember.contractHours,
        full_name: staffMember.fullName,
        id: staffMember.id,
        is_active: staffMember.isActive,
        phone_number: staffMember.phoneNumber,
        primary_role: staffMember.primaryRole,
        user_id: staffMember.userId
      }))
    );

    await insertRows(
      client,
      'leave_requests',
      [
        'id',
        'staff_profile_id',
        'start_date',
        'end_date',
        'reason',
        'status',
        'manager_comment',
        'decided_by_user_id',
        'decided_at'
      ],
      leaveRequests.map((leaveRequest) => ({
        decided_at: new Date(),
        decided_by_user_id: leaveRequest.decidedByUserId,
        end_date: leaveRequest.endDate,
        id: leaveRequest.id,
        manager_comment: 'Approved for demo rota testing',
        reason: leaveRequest.reason,
        staff_profile_id: leaveRequest.staffProfileId,
        start_date: leaveRequest.startDate,
        status: 'APPROVED'
      }))
    );

    await insertRows(
      client,
      'shifts',
      ['id', 'shift_date', 'start_time', 'end_time', 'required_role', 'status', 'notes'],
      shifts.map((shift) => ({
        end_time: shift.endTime,
        id: shift.id,
        notes: shift.notes,
        required_role: shift.requiredRole,
        shift_date: shift.shiftDate,
        start_time: shift.startTime,
        status: 'OPEN'
      }))
    );

    await insertRows(
      client,
      'shift_assignments',
      ['id', 'shift_id', 'staff_profile_id', 'assigned_by_user_id'],
      assignments.map((assignment) => ({
        assigned_by_user_id: assignment.assignedByUserId,
        id: assignment.id,
        shift_id: assignment.shiftId,
        staff_profile_id: assignment.staffProfileId
      }))
    );

    await client.query('COMMIT');

    console.log(resetDemoSeed ? 'Demo history reset and seed complete.' : 'Demo history seed complete.');
    console.log(`Demo staff users added: ${staff.length}`);
    console.log(`Active demo staff now: ${staff.filter((item) => item.isActive).length}`);
    console.log(`Historical and current shifts added: ${shifts.length}`);
    console.log(`Assignments added: ${assignments.length}`);
    console.log(`Approved leave records added: ${leaveRequests.length}`);
    console.log(`Demo staff password: ${demoPassword}`);
    console.log(`Demo email domain: ${demoDomain}`);
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await closePool();
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
