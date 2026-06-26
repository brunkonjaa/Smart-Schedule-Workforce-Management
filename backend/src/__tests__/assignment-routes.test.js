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
  const managerEmail = `assignment-manager-${Date.now()}@example.com`;
  const staffEmail = `assignment-staff-${Date.now()}@example.com`;
  const secondStaffEmail = `assignment-second-staff-${Date.now()}@example.com`;
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
  const availabilityConflictShiftId = crypto.randomUUID();
  const nextWeekStart = getMondayOffset(2);
  const roleMismatchShiftDate = getDateFromWeek(nextWeekStart, 0);
  const leaveConflictShiftDate = getDateFromWeek(nextWeekStart, 1);
  const availabilityConflictShiftDate = getDateFromWeek(nextWeekStart, 2);
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
          ($1, $2, 'Assignment Manager', 'FLOOR', 40.00, '0855000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Assignment Staff', 'BAR', 28.00, '0855000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Assignment Second Staff', 'BAR', 24.00, '0855000003', TRUE, NOW(), NOW())
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
          ($10, $11, '15:00', '21:00', 'BAR', 'OPEN', 'Availability conflict assignment route test', NOW(), NOW()),
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
        availabilityConflictShiftId,
        availabilityConflictShiftDate,
        updateAssignmentShiftId,
        updateAssignmentShiftDate,
        deleteAssignmentShiftId,
        deleteAssignmentShiftDate
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
          ($1, $2, 2, '10:00', '20:00', 'AVAILABLE', NOW(), NOW()),
          ($1, $2, 5, '13:00', '23:00', 'AVAILABLE', NOW(), NOW()),
          ($1, $2, 6, '08:00', '18:00', 'AVAILABLE', NOW(), NOW()),
          ($3, $2, 4, '09:00', '17:00', 'AVAILABLE', NOW(), NOW())
      `,
      [staffProfileId, nextWeekStart, secondStaffProfileId]
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
      'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        assignableShiftId,
        duplicateShiftId,
        roleMismatchShiftId,
        leaveConflictShiftId,
        overlapConflictShiftId,
        availabilityConflictShiftId,
        updateAssignmentShiftId,
        deleteAssignmentShiftId
      ]
    );
    await query(
      'DELETE FROM leave_requests WHERE staff_profile_id IN ($1, $2, $3)',
      [managerStaffProfileId, staffProfileId, secondStaffProfileId]
    );
    await query(
      'DELETE FROM availability_entries WHERE staff_profile_id IN ($1, $2, $3)',
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
        availabilityConflictShiftId,
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
    const response = await agent.post('/api/v1/auth/login').send({
      email: managerEmail,
      password: managerPassword
    });

    expect(response.status).toBe(200);
    return agent;
  };

  const loginAsStaff = async () => {
    const agent = request.agent(app);
    const response = await agent.post('/api/v1/auth/login').send({
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
          fullName: 'Assignment Staff',
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
        fullName: 'Assignment Staff',
        requiredRole: 'BAR',
        shiftDate: assignableShiftDate,
        shiftId: assignableShiftId,
        staffProfileId,
        startTime: '14:00:00'
      })
    );
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
        fullName: 'Assignment Second Staff',
        shiftId: updateAssignmentShiftId,
        staffProfileId: secondStaffProfileId
      })
    );
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
      message: 'This staff member already has an overlapping shift assignment.'
    });
  });

  test('rejects assignment when availability does not cover the shift time', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/assignments')
      .set(mutationHeader)
      .send({
        shiftId: availabilityConflictShiftId,
        staffProfileId
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'This staff member does not have availability covering this shift time.'
    });
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
