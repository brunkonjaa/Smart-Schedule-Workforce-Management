const crypto = require('crypto');
const { closePool, query } = require('../config/db');
const { getShiftRecommendations } = require('../services/shift-recommendation-service');

jest.setTimeout(20000);

const getMondayOffset = (offsetWeeks) => {
  const currentDate = new Date();
  const weekday = currentDate.getUTCDay() || 7;
  currentDate.setUTCDate(currentDate.getUTCDate() - (weekday - 1) + (offsetWeeks * 7));
  return currentDate.toISOString().slice(0, 10);
};

const getDateFromWeek = (weekStart, dayOffset) => {
  const currentDate = new Date(`${weekStart}T00:00:00Z`);
  currentDate.setUTCDate(currentDate.getUTCDate() + dayOffset);
  return currentDate.toISOString().slice(0, 10);
};

describe('shift recommendation service', () => {
  const managerUserId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const nextWeekStart = getMondayOffset(6);
  const targetShiftId = crypto.randomUUID();
  const noEligibleShiftId = crypto.randomUUID();
  const aaronHoursDate = getDateFromWeek(nextWeekStart, 0);
  const heavyHoursOneDate = getDateFromWeek(nextWeekStart, 0);
  const heavyHoursTwoDate = getDateFromWeek(nextWeekStart, 3);
  const targetShiftDate = getDateFromWeek(nextWeekStart, 2);
  const noEligibleShiftDate = getDateFromWeek(nextWeekStart, 3);
  const overContractHoursDate = getDateFromWeek(nextWeekStart, 4);
  const zoeHoursDate = getDateFromWeek(nextWeekStart, 1);
  const staffSeeds = [
    {
      contractHours: 30,
      fullName: 'Best Candidate',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Aaron Tie',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Zoe Tie',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 8,
      fullName: 'Over Contract Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 18,
      fullName: 'Heavy Workload Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Inactive Staff',
      id: crypto.randomUUID(),
      isActive: false,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Wrong Role Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'FLOOR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Leave Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Missing Availability Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Unavailable Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Overlap Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    },
    {
      contractHours: 24,
      fullName: 'Touching Staff',
      id: crypto.randomUUID(),
      isActive: true,
      primaryRole: 'BAR',
      userId: crypto.randomUUID(),
      userIsActive: true
    }
  ];
  const bestCandidate = staffSeeds[0];
  const aaronTie = staffSeeds[1];
  const zoeTie = staffSeeds[2];
  const overContractStaff = staffSeeds[3];
  const heavyWorkloadStaff = staffSeeds[4];
  const inactiveStaff = staffSeeds[5];
  const wrongRoleStaff = staffSeeds[6];
  const leaveStaff = staffSeeds[7];
  const missingAvailabilityStaff = staffSeeds[8];
  const unavailableStaff = staffSeeds[9];
  const overlapStaff = staffSeeds[10];
  const touchingStaff = staffSeeds[11];
  const seededShiftIds = {
    aaronHours: crypto.randomUUID(),
    heavyHoursOne: crypto.randomUUID(),
    heavyHoursTwo: crypto.randomUUID(),
    overlapExisting: crypto.randomUUID(),
    overContractHours: crypto.randomUUID(),
    touchingExisting: crypto.randomUUID(),
    zoeHours: crypto.randomUUID()
  };

  beforeAll(async () => {
    const userValues = [managerUserId, 'service-manager@example.com', 'hash'];
    const userRows = [`($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW())`];
    let placeholderIndex = 4;

    staffSeeds.forEach((staffMember, index) => {
      userValues.push(
        staffMember.userId,
        `recommendation-service-${index}-${Date.now()}@example.com`,
        'hash'
      );
      userRows.push(
        `($${placeholderIndex}, $${placeholderIndex + 1}, $${placeholderIndex + 2}, 'STAFF', $${placeholderIndex + 3}, NOW(), NOW())`
      );
      userValues.push(staffMember.userIsActive);
      placeholderIndex += 4;
    });

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ${userRows.join(', ')}
      `,
      userValues
    );

    const staffValues = [
      managerStaffProfileId,
      managerUserId,
      'Recommendation Manager',
      'FLOOR',
      40,
      true
    ];
    const staffRows = [`($1, $2, $3, $4, $5, '0857100001', $6, NOW(), NOW())`];
    placeholderIndex = 7;

    staffSeeds.forEach((staffMember, index) => {
      staffValues.push(
        staffMember.id,
        staffMember.userId,
        staffMember.fullName,
        staffMember.primaryRole,
        staffMember.contractHours,
        staffMember.isActive
      );
      staffRows.push(
        `($${placeholderIndex}, $${placeholderIndex + 1}, $${placeholderIndex + 2}, $${placeholderIndex + 3}, $${placeholderIndex + 4}, '08571000${String(index + 2).padStart(2, '0')}', $${placeholderIndex + 5}, NOW(), NOW())`
      );
      placeholderIndex += 6;
    });

    await query(
      `
        INSERT INTO staff_profiles (
          id,
          user_id,
          full_name,
          primary_role,
          contract_hours,
          phone_number,
          is_active,
          created_at,
          updated_at
        )
        VALUES ${staffRows.join(', ')}
      `,
      staffValues
    );

    await query(
      `
        INSERT INTO shifts (
          id,
          shift_date,
          start_time,
          end_time,
          required_role,
          status,
          notes,
          created_at,
          updated_at
        )
        VALUES
          ($1, $2, '15:00', '21:00', 'BAR', 'OPEN', 'Recommendation target shift', NOW(), NOW()),
          ($3, $4, '15:00', '21:00', 'KITCHEN', 'OPEN', 'No eligible shift', NOW(), NOW()),
          ($5, $12, '09:00', '17:00', 'BAR', 'OPEN', 'Aaron current hours', NOW(), NOW()),
          ($6, $13, '08:00', '18:00', 'BAR', 'OPEN', 'Heavy current hours one', NOW(), NOW()),
          ($7, $14, '08:00', '16:00', 'BAR', 'OPEN', 'Heavy current hours two', NOW(), NOW()),
          ($8, $2, '18:00', '23:00', 'BAR', 'OPEN', 'Overlap existing shift', NOW(), NOW()),
          ($9, $15, '08:00', '16:00', 'BAR', 'OPEN', 'Over contract current hours', NOW(), NOW()),
          ($10, $2, '09:00', '15:00', 'BAR', 'OPEN', 'Touching existing shift', NOW(), NOW()),
          ($11, $16, '09:00', '17:00', 'BAR', 'OPEN', 'Zoe current hours', NOW(), NOW())
      `,
      [
        targetShiftId,
        targetShiftDate,
        noEligibleShiftId,
        noEligibleShiftDate,
        seededShiftIds.aaronHours,
        seededShiftIds.heavyHoursOne,
        seededShiftIds.heavyHoursTwo,
        seededShiftIds.overlapExisting,
        seededShiftIds.overContractHours,
        seededShiftIds.touchingExisting,
        seededShiftIds.zoeHours,
        aaronHoursDate,
        heavyHoursOneDate,
        heavyHoursTwoDate,
        overContractHoursDate,
        zoeHoursDate
      ]
    );

    await query(
      `
        INSERT INTO availability_entries (
          staff_profile_id,
          week_start,
          day_of_week,
          start_time,
          end_time,
          status,
          created_at,
          updated_at
        )
        VALUES
          ($1, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($2, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($3, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($4, $10, 4, '07:00', '17:00', 'AVAILABLE', NOW(), NOW()),
          ($4, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($5, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($6, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($7, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($7, $10, 3, '14:00', '18:00', 'UNAVAILABLE', NOW(), NOW()),
          ($8, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($9, $10, 3, '12:00', '23:00', 'AVAILABLE', NOW(), NOW())
      `,
      [
        bestCandidate.id,
        aaronTie.id,
        zoeTie.id,
        overContractStaff.id,
        heavyWorkloadStaff.id,
        leaveStaff.id,
        unavailableStaff.id,
        overlapStaff.id,
        touchingStaff.id,
        nextWeekStart
      ]
    );

    await query(
      `
        INSERT INTO leave_requests (
          staff_profile_id,
          start_date,
          end_date,
          reason,
          status,
          manager_comment,
          decided_by_user_id,
          decided_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $2, 'Recommendation leave test', 'APPROVED', 'Approved for service test', $3, NOW(), NOW(), NOW())
      `,
      [leaveStaff.id, targetShiftDate, managerUserId]
    );

    await query(
      `
        INSERT INTO shift_assignments (
          id,
          shift_id,
          staff_profile_id,
          assigned_by_user_id,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES
          ($1, $7, $8, $13, NOW(), NOW(), NOW()),
          ($2, $9, $10, $13, NOW(), NOW(), NOW()),
          ($3, $11, $12, $13, NOW(), NOW(), NOW()),
          ($4, $14, $15, $13, NOW(), NOW(), NOW()),
          ($5, $16, $17, $13, NOW(), NOW(), NOW()),
          ($6, $18, $19, $13, NOW(), NOW(), NOW())
      `,
      [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
        seededShiftIds.aaronHours,
        aaronTie.id,
        seededShiftIds.heavyHoursOne,
        heavyWorkloadStaff.id,
        seededShiftIds.heavyHoursTwo,
        heavyWorkloadStaff.id,
        managerUserId,
        seededShiftIds.overlapExisting,
        overlapStaff.id,
        seededShiftIds.overContractHours,
        overContractStaff.id,
        seededShiftIds.touchingExisting,
        touchingStaff.id
      ]
    );

    await query(
      `
        INSERT INTO shift_assignments (
          id,
          shift_id,
          staff_profile_id,
          assigned_by_user_id,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `,
      [crypto.randomUUID(), seededShiftIds.zoeHours, zoeTie.id, managerUserId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM audit_logs WHERE actor_user_id = $1',
      [managerUserId]
    );
    await query(
      'DELETE FROM shift_assignments WHERE assigned_by_user_id = $1',
      [managerUserId]
    );
    await query(
      'DELETE FROM leave_requests WHERE decided_by_user_id = $1',
      [managerUserId]
    );
    await query(
      'DELETE FROM availability_entries WHERE staff_profile_id IN (' +
        staffSeeds.map((_, index) => `$${index + 1}`).join(', ') +
      ')',
      staffSeeds.map((staffMember) => staffMember.id)
    );
    await query(
      'DELETE FROM shifts WHERE id IN ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        targetShiftId,
        noEligibleShiftId,
        seededShiftIds.aaronHours,
        seededShiftIds.heavyHoursOne,
        seededShiftIds.heavyHoursTwo,
        seededShiftIds.overlapExisting,
        seededShiftIds.overContractHours,
        seededShiftIds.touchingExisting,
        seededShiftIds.zoeHours
      ]
    );
    await query(
      'DELETE FROM staff_profiles WHERE id IN (' +
        [managerStaffProfileId, ...staffSeeds.map((staffMember) => staffMember.id)]
          .map((_, index) => `$${index + 1}`)
          .join(', ') +
      ')',
      [managerStaffProfileId, ...staffSeeds.map((staffMember) => staffMember.id)]
    );
    await query(
      'DELETE FROM users WHERE id IN (' +
        [managerUserId, ...staffSeeds.map((staffMember) => staffMember.userId)]
          .map((_, index) => `$${index + 1}`)
          .join(', ') +
      ')',
      [managerUserId, ...staffSeeds.map((staffMember) => staffMember.userId)]
    );
    await closePool();
  });

  test('builds ranked recommendations and exclusions using the current assignment rules', async () => {
    const assignmentCountBefore = await query(
      'SELECT COUNT(*)::int AS total FROM shift_assignments WHERE shift_id = $1',
      [targetShiftId]
    );

    const result = await getShiftRecommendations(targetShiftId);

    expect(result.shift).toEqual(
      expect.objectContaining({
        date: targetShiftDate,
        endTime: '21:00',
        id: targetShiftId,
        requiredRole: 'BAR',
        startTime: '15:00'
      })
    );
    expect(result.recommendations.map((candidate) => candidate.name)).toEqual([
      'Best Candidate',
      'Aaron Tie',
      'Zoe Tie',
      'Over Contract Staff',
      'Heavy Workload Staff'
    ]);

    const bestCandidateResult = result.recommendations[0];
    expect(bestCandidateResult).toEqual(
      expect.objectContaining({
        contractHours: 30,
        currentWeeklyHours: 0,
        projectedWeeklyHours: 6,
        score: 135,
        staffId: bestCandidate.id
      })
    );

    const tieSlice = result.recommendations.slice(1, 3);
    expect(tieSlice.map((candidate) => candidate.name)).toEqual([
      'Aaron Tie',
      'Zoe Tie'
    ]);
    expect(tieSlice[0].score).toBe(tieSlice[1].score);
    expect(tieSlice[0].projectedWeeklyHours).toBe(tieSlice[1].projectedWeeklyHours);

    const overContractResult = result.recommendations.find((candidate) => {
      return candidate.staffId === overContractStaff.id;
    });
    expect(overContractResult.warnings).toEqual([
      expect.objectContaining({
        code: 'CONTRACT_HOURS_EXCEEDED'
      })
    ]);

    expect(result.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: inactiveStaff.fullName,
          reason: expect.objectContaining({
            code: 'STAFF_NOT_ACTIVE'
          })
        }),
        expect.objectContaining({
          name: wrongRoleStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_ROLE_CONFLICT'
          })
        }),
        expect.objectContaining({
          name: leaveStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_LEAVE_CONFLICT'
          })
        }),
        expect.objectContaining({
          name: missingAvailabilityStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_AVAILABILITY_CONFLICT'
          })
        }),
        expect.objectContaining({
          name: unavailableStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_UNAVAILABLE_CONFLICT'
          })
        }),
        expect.objectContaining({
          name: overlapStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_OVERLAP_CONFLICT'
          })
        }),
        expect.objectContaining({
          name: touchingStaff.fullName,
          reason: expect.objectContaining({
            code: 'ASSIGNMENT_OVERLAP_CONFLICT'
          })
        })
      ])
    );

    const assignmentCountAfter = await query(
      'SELECT COUNT(*)::int AS total FROM shift_assignments WHERE shift_id = $1',
      [targetShiftId]
    );
    expect(assignmentCountAfter.rows[0].total).toBe(assignmentCountBefore.rows[0].total);
  });

  test('returns a valid empty recommendation list when nobody is eligible', async () => {
    const result = await getShiftRecommendations(noEligibleShiftId);

    expect(result.recommendations).toEqual([]);
    expect(result.excluded.length).toBeGreaterThan(0);
    expect(result.shift).toEqual(
      expect.objectContaining({
        id: noEligibleShiftId,
        requiredRole: 'KITCHEN'
      })
    );
  });
});
