const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

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

describe('assignment routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const secondStaffUserId = crypto.randomUUID();
  const secondStaffProfileId = crypto.randomUUID();
  const managerEmail = `fionamurphy${Date.now()}fake@gmail.com`;
  const staffEmail = `conorbyrne${Date.now()}fake@gmail.com`;
  const secondStaffEmail = `niamhwalsh${Date.now()}fake@gmail.com`;
  const managerPassword = 'AssignmentManager123!';
  const staffPassword = 'AssignmentStaff123!';
  const secondStaffPassword = 'AssignmentSecondStaff123!';
  const assignableShiftId = crypto.randomUUID();
  const duplicateShiftId = crypto.randomUUID();
  const updateAssignmentId = crypto.randomUUID();
  const deleteAssignmentId = crypto.randomUUID();
  const updateAssignmentShiftId = crypto.randomUUID();
  const deleteAssignmentShiftId = crypto.randomUUID();
  const roleMismatchShiftId = crypto.randomUUID();
  const leaveConflictShiftId = crypto.randomUUID();
  const overlapConflictShiftId = crypto.randomUUID();
  const noWeeklyAvailabilityShiftId = crypto.randomUUID();
  const nextWeekStart = getMondayOffset(2);
  const roleMismatchShiftDate = getDateFromWeek(nextWeekStart, 0);
  const leaveConflictShiftDate = getDateFromWeek(nextWeekStart, 1);
  const noWeeklyAvailabilityShiftDate = getDateFromWeek(nextWeekStart, 2);
  const assignableShiftDate = getDateFromWeek(nextWeekStart, 4);
  const duplicateShiftDate = getDateFromWeek(nextWeekStart, 5);
  const updateAssignmentShiftDate = getDateFromWeek(nextWeekStart, 3);
  const deleteAssignmentShiftDate = getDateFromWeek(nextWeekStart, 6);
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };

  beforeAll(async () => {
    const managerPasswordHash = await bcrypt.hash(managerPassword, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);
    const secondStaffPasswordHash = await bcrypt.hash(secondStaffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW()),
          ($7, $8, $9, 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        managerId,
        managerEmail,
        managerPasswordHash,
        staffUserId,
        staffEmail,
        staffPasswordHash,
        secondStaffUserId,
        secondStaffEmail,
        secondStaffPasswordHash
      ]
    );

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
        VALUES
          ($1, $2, 'Fiona Murphy', 'FLOOR', 40.00, '0855000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Conor Byrne', 'BAR', 28.00, '0855000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Niamh Walsh', 'BAR', 24.00, '0855000003', TRUE, NOW(), NOW())
      `,
      [
        managerStaffProfileId,
        managerId,
        staffProfileId,
        staffUserId,
        secondStaffProfileId,
        secondStaffUserId
      ]
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
          ($1, $2, '14:00', '22:00', 'BAR', 'OPEN', 'Assignment route test', NOW(), NOW()),
          ($3, $4, '09:00', '17:00', 'BAR', 'OPEN', 'Duplicate assignment route test', NOW(), NOW()),
          ($5, $6, '12:00', '20:00', 'FLOOR', 'OPEN', 'Role mismatch assignment route test', NOW(), NOW()),
          ($7, $8, '11:00', '19:00', 'BAR', 'OPEN', 'Leave conflict assignment route test', NOW(), NOW()),
          ($9, $4, '10:00', '18:00', 'BAR', 'OPEN', 'Overlap assignment route test', NOW(), NOW()),
          ($10, $11, '15:00', '21:00', 'BAR', 'OPEN', 'No weekly availability assignment route test', NOW(), NOW()),
          ($12, $13, '10:00', '16:00', 'BAR', 'OPEN', 'Update assignment route test', NOW(), NOW()),
          ($14, $15, '08:00', '14:00', 'BAR', 'OPEN', 'Delete assignment route test', NOW(), NOW())
      `,
      [
        assignableShiftId,
        assignableShiftDate,
        duplicateShiftId,
        duplicateShiftDate,
        roleMismatchShiftId,
        roleMismatchShiftDate,
        leaveConflictShiftId,
        leaveConflictShiftDate,
        overlapConflictShiftId,
        noWeeklyAvailabilityShiftId,
        noWeeklyAvailabilityShiftDate,
        updateAssignmentShiftId,
        updateAssignmentShiftDate,
        deleteAssignmentShiftId,
        deleteAssignmentShiftDate
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
        VALUES ($1, $2, $2, 'Approved leave conflict test', 'APPROVED', 'Approved for route test', $3, NOW(), NOW(), NOW())
      `,
      [staffProfileId, leaveConflictShiftDate, managerId]
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
          ($1, $2, $3, $4, NOW(), NOW(), NOW()),
          ($5, $6, $3, $4, NOW(), NOW(), NOW()),
          ($7, $8, $3, $4, NOW(), NOW(), NOW())
      `,
      [
        crypto.randomUUID(),
        duplicateShiftId,
        staffProfileId,
        managerId,
        updateAssignmentId,
        updateAssignmentShiftId,
        deleteAssignmentId,
        deleteAssignmentShiftId
      ]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM audit_logs WHERE actor_user_id IN ($1, $2, $3)',
      [managerId, staffUserId, secondStaffUserId]
    );
    await query(
      'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        assignableShiftId,
        duplicateShiftId,
        roleMismatchShiftId,
        leaveConflictShiftId,
        overlapConflictShiftId,
        noWeeklyAvailabilityShiftId,
        updateAssignmentShiftId,
        deleteAssignmentShiftId
      ]
    );
    await query(
      'DELETE FROM leave_requests WHERE staff_profile_id IN ($1, $2, $3)',
      [managerStaffProfileId, staffProfileId, secondStaffProfileId]
    );
    await query(
      'DELETE FROM shifts WHERE id IN ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        assignableShiftId,
        duplicateShiftId,
        roleMismatchShiftId,
        leaveConflictShiftId,
        overlapConflictShiftId,
        noWeeklyAvailabilityShiftId,
        updateAssignmentShiftId,
        deleteAssignmentShiftId
      ]
    );
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)',
      [managerStaffProfileId, staffProfileId, secondStaffProfileId]
    );
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3)',
      [managerId, staffUserId, secondStaffUserId]
    );
    await closePool();
  });

  const loginAsManager = async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: managerEmail,
      password: managerPassword
    });

    expect(response.status).toBe(200);
    return agent;
  };

  const loginAsStaff = async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').set('x-smart-schedule-csrf', '1').send({
      email: staffEmail,
      password: staffPassword
    });

    expect(response.status).toBe(200);
    return agent;
  };

  test('rejects unauthenticated assignment requests', async () => {
    const response = await request(app)
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(401);
  });

  test('rejects staff users on manager-only assignment routes', async () => {
    const agent = await loginAsStaff();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(403);
  });

  test('lists assignments for the selected week for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(`/api/v1/assignments?weekStart=${nextWeekStart}`);

    expect(response.status).toBe(200);
    expect(response.body.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fullName: 'Conor Byrne',
          requiredRole: 'BAR',
          shiftDate: duplicateShiftDate,
          shiftId: duplicateShiftId,
          staffProfileId,
          startTime: '09:00:00'
        })
      ])
    );
  });

  test('rejects invalid assignment list filters', async () => {
    const agent = await loginAsManager();
    const response = await agent.get('/api/v1/assignments?weekStart=2026-06-10&extra=true');

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported filters: extra',
        'weekStart must be a Monday date'
      ])
    );
  });

  test('requires the mutation protection header on assignment creation', async () => {
    const agent = await loginAsManager();
    const response = await agent.post('/api/v1/assignments').send({
      shiftId: assignableShiftId,
      staffProfileId
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'This request is missing the required mutation protection header.'
    });
  });

  test('creates a shift assignment for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: assignableShiftId,
        staffProfileId
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Shift assignment created successfully.');
    expect(response.body.assignment).toEqual(
      expect.objectContaining({
        assignedByUserId: managerId,
        endTime: '22:00:00',
        fullName: 'Conor Byrne',
        requiredRole: 'BAR',
        shiftDate: assignableShiftDate,
        shiftId: assignableShiftId,
        staffProfileId,
        startTime: '14:00:00'
      })
    );
    expect(response.body.warnings).toEqual([]);

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'ASSIGNMENT_CREATED'
        LIMIT 1
      `,
      [response.body.assignment.id]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'ASSIGNMENT_CREATED',
        actor_user_id: managerId,
        before_state: null,
        entity_id: response.body.assignment.id,
        entity_type: 'ASSIGNMENT'
      })
    );
    expect(auditLog.rows[0].after_state.staffProfileId).toBe(staffProfileId);
  });

  test('updates an assignment for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/assignments/${updateAssignmentId}`)
      .set(mutationHeader)
      .send({
        staffProfileId: secondStaffProfileId
      });

    expect(response.status).toBe(200);
    expect(response.body.assignment).toEqual(
      expect.objectContaining({
        fullName: 'Niamh Walsh',
        shiftId: updateAssignmentShiftId,
        staffProfileId: secondStaffProfileId
      })
    );
    expect(response.body.warnings).toEqual([]);

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'ASSIGNMENT_UPDATED'
        LIMIT 1
      `,
      [response.body.assignment.id]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'ASSIGNMENT_UPDATED',
        actor_user_id: managerId,
        entity_id: response.body.assignment.id,
        entity_type: 'ASSIGNMENT'
      })
    );
    expect(auditLog.rows[0].before_state.staffProfileId).toBe(staffProfileId);
    expect(auditLog.rows[0].after_state.staffProfileId).toBe(secondStaffProfileId);
  });

  test('deletes assignments for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .delete(`/api/v1/assignments/${deleteAssignmentId}`)
      .set(mutationHeader);

    expect(response.status).toBe(204);

    const deletedAssignment = await query(
      'SELECT id FROM shift_assignments WHERE id = $1',
      [deleteAssignmentId]
    );
    expect(deletedAssignment.rowCount).toBe(0);

    const auditLog = await query(
      `
        SELECT action, actor_user_id, after_state, before_state, entity_id, entity_type
        FROM audit_logs
        WHERE entity_id = $1
          AND action = 'ASSIGNMENT_DELETED'
        LIMIT 1
      `,
      [deleteAssignmentId]
    );
    expect(auditLog.rowCount).toBe(1);
    expect(auditLog.rows[0]).toEqual(
      expect.objectContaining({
        action: 'ASSIGNMENT_DELETED',
        actor_user_id: managerId,
        after_state: null,
        entity_id: deleteAssignmentId,
        entity_type: 'ASSIGNMENT'
      })
    );
    expect(auditLog.rows[0].before_state.shiftId).toBe(deleteAssignmentShiftId);
  });

  test('rejects duplicate assignment for the same shift', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: duplicateShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This shift already has an assignment.'
    });
  });

  test('rejects assignment when staff role does not match the shift role', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: roleMismatchShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This staff member role does not match the shift role.'
    });
  });

  test('rejects assignment when staff has approved leave on the shift date', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: leaveConflictShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This staff member has approved leave on this shift date.'
    });
  });

  test('rejects assignment when staff already has an overlapping shift', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: overlapConflictShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This staff member already has a shift that overlaps or touches this shift time.'
    });
  });

  test('rejects assignment when staff already has a shift ending at the new shift start time', async () => {
    const adjacentExistingShiftId = crypto.randomUUID();
    const adjacentConflictShiftId = crypto.randomUUID();
    const adjacentAssignmentId = crypto.randomUUID();
    const adjacentShiftDate = roleMismatchShiftDate;
    const agent = await loginAsManager();

    try {
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
            ($1, $3, '10:00', '16:00', 'BAR', 'OPEN', 'Adjacent existing shift', NOW(), NOW()),
            ($2, $3, '16:00', '22:00', 'BAR', 'OPEN', 'Adjacent conflict shift', NOW(), NOW())
        `,
        [adjacentExistingShiftId, adjacentConflictShiftId, adjacentShiftDate]
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
        [adjacentAssignmentId, adjacentExistingShiftId, staffProfileId, managerId]
      );

      const response = await agent
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({
          shiftId: adjacentConflictShiftId,
          staffProfileId
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'Conflict',
        message: 'This staff member already has a shift that overlaps or touches this shift time.'
      });
    } finally {
      await query(
        'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2)',
        [adjacentExistingShiftId, adjacentConflictShiftId]
      );
      await query(
        'DELETE FROM shifts WHERE id IN ($1, $2)',
        [adjacentExistingShiftId, adjacentConflictShiftId]
      );
    }
  });

  test('returns a warning when assignment would exceed weekly contract hours', async () => {
    const contractUserId = crypto.randomUUID();
    const contractStaffProfileId = crypto.randomUUID();
    const firstExistingShiftId = crypto.randomUUID();
    const secondExistingShiftId = crypto.randomUUID();
    const contractWarningShiftId = crypto.randomUUID();
    const firstExistingAssignmentId = crypto.randomUUID();
    const secondExistingAssignmentId = crypto.randomUUID();
    const contractEmail = `grainneoconnor${Date.now()}fake@gmail.com`;
    const contractPasswordHash = await bcrypt.hash('AssignmentContract123!', 10);
    const firstShiftDate = getDateFromWeek(nextWeekStart, 0);
    const secondShiftDate = getDateFromWeek(nextWeekStart, 1);
    const warningShiftDate = getDateFromWeek(nextWeekStart, 2);
    const agent = await loginAsManager();

    try {
      await query(
        `
          INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())
        `,
        [contractUserId, contractEmail, contractPasswordHash]
      );
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
          VALUES ($1, $2, 'Grainne O''Connor', 'BAR', 20.00, '0855000099', TRUE, NOW(), NOW())
        `,
        [contractStaffProfileId, contractUserId]
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
            ($1, $4, '09:00', '17:00', 'BAR', 'OPEN', 'Contract warning existing one', NOW(), NOW()),
            ($2, $5, '09:00', '17:00', 'BAR', 'OPEN', 'Contract warning existing two', NOW(), NOW()),
            ($3, $6, '09:00', '17:00', 'BAR', 'OPEN', 'Contract warning new shift', NOW(), NOW())
        `,
        [
          firstExistingShiftId,
          secondExistingShiftId,
          contractWarningShiftId,
          firstShiftDate,
          secondShiftDate,
          warningShiftDate
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
          VALUES
            ($1, $3, $5, $6, NOW(), NOW(), NOW()),
            ($2, $4, $5, $6, NOW(), NOW(), NOW())
        `,
        [
          firstExistingAssignmentId,
          secondExistingAssignmentId,
          firstExistingShiftId,
          secondExistingShiftId,
          contractStaffProfileId,
          managerId
        ]
      );

      const response = await agent
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({
          shiftId: contractWarningShiftId,
          staffProfileId: contractStaffProfileId
        });

      expect(response.status).toBe(201);
      expect(response.body.warnings).toEqual([
        expect.objectContaining({
          assignedHoursBefore: 16,
          code: 'CONTRACT_HOURS_EXCEEDED',
          contractHours: 20,
          overByHours: 4,
          projectedHours: 24,
          shiftHours: 8,
          weekStart: nextWeekStart
        })
      ]);
      expect(response.body.warnings[0].message).toContain("Grainne O'Connor");
    } finally {
      await query(
        'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2, $3)',
        [firstExistingShiftId, secondExistingShiftId, contractWarningShiftId]
      );
      await query(
        'DELETE FROM shifts WHERE id IN ($1, $2, $3)',
        [firstExistingShiftId, secondExistingShiftId, contractWarningShiftId]
      );
      await query(
        'DELETE FROM staff_profiles WHERE id = $1',
        [contractStaffProfileId]
      );
      await query('DELETE FROM users WHERE id = $1', [contractUserId]);
    }
  });

  test('rejects assignment when staff would go over five shifts in the same week', async () => {
    const limitUserId = crypto.randomUUID();
    const limitStaffProfileId = crypto.randomUUID();
    const targetShiftId = crypto.randomUUID();
    const existingShiftIds = Array.from({ length: 5 }, () => crypto.randomUUID());
    const existingAssignmentIds = Array.from({ length: 5 }, () => crypto.randomUUID());
    const limitEmail = `orankelly${Date.now()}fake@gmail.com`;
    const limitPasswordHash = await bcrypt.hash('AssignmentShiftLimit123!', 10);
    const existingShiftDates = Array.from({ length: 5 }, (_, index) => {
      return getDateFromWeek(nextWeekStart, index);
    });
    const targetShiftDate = getDateFromWeek(nextWeekStart, 6);
    const agent = await loginAsManager();

    try {
      await query(
        `
          INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())
        `,
        [limitUserId, limitEmail, limitPasswordHash]
      );
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
          VALUES ($1, $2, 'Oran Kelly', 'BAR', 40.00, '0855000100', TRUE, NOW(), NOW())
        `,
        [limitStaffProfileId, limitUserId]
      );

      const shiftValues = [];
      const shiftPlaceholders = existingShiftIds
        .map((shiftId, index) => {
          const dateValue = existingShiftDates[index];
          shiftValues.push(shiftId, dateValue);
          return `($${shiftValues.length - 1}, $${shiftValues.length}, '09:00', '15:00', 'BAR', 'OPEN', 'Weekly shift limit existing ${index + 1}', NOW(), NOW())`;
        })
        .join(', ');

      shiftValues.push(targetShiftId, targetShiftDate);
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
            ${shiftPlaceholders},
            ($${shiftValues.length - 1}, $${shiftValues.length}, '10:00', '16:00', 'BAR', 'OPEN', 'Weekly shift limit target', NOW(), NOW())
        `,
        shiftValues
      );

      const assignmentValues = [];
      const assignmentPlaceholders = existingAssignmentIds
        .map((assignmentId, index) => {
          assignmentValues.push(
            assignmentId,
            existingShiftIds[index],
            limitStaffProfileId,
            managerId
          );
          return `($${assignmentValues.length - 3}, $${assignmentValues.length - 2}, $${assignmentValues.length - 1}, $${assignmentValues.length}, NOW(), NOW(), NOW())`;
        })
        .join(', ');

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
          VALUES ${assignmentPlaceholders}
        `,
        assignmentValues
      );

      const response = await agent
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({
          shiftId: targetShiftId,
          staffProfileId: limitStaffProfileId
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'Conflict',
        message: 'This staff member would go over 5 shifts for the week.'
      });
    } finally {
      await query(
        'DELETE FROM shift_assignments WHERE shift_id = ANY($1::uuid[])',
        [[...existingShiftIds, targetShiftId]]
      );
      await query(
        'DELETE FROM shifts WHERE id = ANY($1::uuid[])',
        [[...existingShiftIds, targetShiftId]]
      );
      await query('DELETE FROM staff_profiles WHERE id = $1', [limitStaffProfileId]);
      await query('DELETE FROM users WHERE id = $1', [limitUserId]);
    }
  });

  test('rejects assignment when staff would go over forty hours in the same week', async () => {
    const hoursUserId = crypto.randomUUID();
    const hoursStaffProfileId = crypto.randomUUID();
    const targetShiftId = crypto.randomUUID();
    const existingShiftIds = Array.from({ length: 4 }, () => crypto.randomUUID());
    const existingAssignmentIds = Array.from({ length: 4 }, () => crypto.randomUUID());
    const hoursEmail = `sineaddoyle${Date.now()}fake@gmail.com`;
    const hoursPasswordHash = await bcrypt.hash('AssignmentHoursLimit123!', 10);
    const existingShiftDates = Array.from({ length: 4 }, (_, index) => {
      return getDateFromWeek(nextWeekStart, index);
    });
    const targetShiftDate = getDateFromWeek(nextWeekStart, 4);
    const agent = await loginAsManager();

    try {
      await query(
        `
          INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, 'STAFF', TRUE, NOW(), NOW())
        `,
        [hoursUserId, hoursEmail, hoursPasswordHash]
      );
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
          VALUES ($1, $2, 'Sinead Doyle', 'BAR', 40.00, '0855000101', TRUE, NOW(), NOW())
        `,
        [hoursStaffProfileId, hoursUserId]
      );

      const shiftValues = [];
      const shiftPlaceholders = existingShiftIds
        .map((shiftId, index) => {
          const dateValue = existingShiftDates[index];
          shiftValues.push(shiftId, dateValue);
          return `($${shiftValues.length - 1}, $${shiftValues.length}, '09:00', '18:00', 'BAR', 'OPEN', 'Weekly hours limit existing ${index + 1}', NOW(), NOW())`;
        })
        .join(', ');

      shiftValues.push(targetShiftId, targetShiftDate);
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
            ${shiftPlaceholders},
            ($${shiftValues.length - 1}, $${shiftValues.length}, '12:00', '18:00', 'BAR', 'OPEN', 'Weekly hours limit target', NOW(), NOW())
        `,
        shiftValues
      );

      const assignmentValues = [];
      const assignmentPlaceholders = existingAssignmentIds
        .map((assignmentId, index) => {
          assignmentValues.push(
            assignmentId,
            existingShiftIds[index],
            hoursStaffProfileId,
            managerId
          );
          return `($${assignmentValues.length - 3}, $${assignmentValues.length - 2}, $${assignmentValues.length - 1}, $${assignmentValues.length}, NOW(), NOW(), NOW())`;
        })
        .join(', ');

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
          VALUES ${assignmentPlaceholders}
        `,
        assignmentValues
      );

      const response = await agent
        .post('/api/v1/assignments')
        .set(mutationHeader)
        .send({
          shiftId: targetShiftId,
          staffProfileId: hoursStaffProfileId
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'Conflict',
        message: 'This staff member would go over 40 hours for the week.'
      });
    } finally {
      await query(
        'DELETE FROM shift_assignments WHERE shift_id = ANY($1::uuid[])',
        [[...existingShiftIds, targetShiftId]]
      );
      await query(
        'DELETE FROM shifts WHERE id = ANY($1::uuid[])',
        [[...existingShiftIds, targetShiftId]]
      );
      await query('DELETE FROM staff_profiles WHERE id = $1', [hoursStaffProfileId]);
      await query('DELETE FROM users WHERE id = $1', [hoursUserId]);
    }
  });

  test('allows assignment without a weekly availability window', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: noWeeklyAvailabilityShiftId,
        staffProfileId
      });

    expect(response.status).toBe(201);
    expect(response.body.assignment).toEqual(
      expect.objectContaining({
        shiftId: noWeeklyAvailabilityShiftId,
        staffProfileId
      })
    );
    expect(response.body.warnings).toEqual([]);
  });

  test('rejects invalid assignment payloads', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        notes: 'unexpected',
        shiftId: 'bad-shift',
        staffProfileId: 'bad-staff'
      });

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported fields: notes',
        'shiftId must be a valid UUID',
        'staffProfileId must be a valid UUID'
      ])
    );
  });
});
