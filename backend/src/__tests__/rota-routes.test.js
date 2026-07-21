const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');

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

describe('rota routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const secondStaffUserId = crypto.randomUUID();
  const secondStaffProfileId = crypto.randomUUID();
  const managerEmail = `fionnmurphy${Date.now()}fake@gmail.com`;
  const staffEmail = `eimearkelly${Date.now()}fake@gmail.com`;
  const secondStaffEmail = `darraghbyrne${Date.now()}fake@gmail.com`;
  const managerPassword = 'RotaManager123!';
  const staffPassword = 'RotaStaff123!';
  const secondStaffPassword = 'RotaSecondStaff123!';
  const assignedShiftId = crypto.randomUUID();
  const openShiftId = crypto.randomUUID();
  const nextWeekStart = getMondayOffset(3);
  const assignedShiftDate = getDateFromWeek(nextWeekStart, 2);
  const openShiftDate = getDateFromWeek(nextWeekStart, 4);
  const leaveDate = getDateFromWeek(nextWeekStart, 5);

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
          ($1, $2, 'Fionn Murphy', 'FLOOR', 40.00, '0856000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Eimear Kelly', 'BAR', 28.00, '0856000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Darragh Byrne', 'BAR', 20.00, '0856000003', TRUE, NOW(), NOW())
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
          ($1, $2, '12:00', '20:00', 'BAR', 'OPEN', 'Assigned rota shift', NOW(), NOW()),
          ($3, $4, '18:00', '23:00', 'BAR', 'OPEN', 'Open rota shift', NOW(), NOW())
      `,
      [assignedShiftId, assignedShiftDate, openShiftId, openShiftDate]
    );

    await query(
      `
        INSERT INTO shift_assignments (
          shift_id,
          staff_profile_id,
          assigned_by_user_id,
          assigned_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, NOW(), NOW(), NOW())
      `,
      [assignedShiftId, staffProfileId, managerId]
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
        VALUES ($1, $2, $2, 'Rota route leave test', 'APPROVED', 'Approved for rota route test', $3, NOW(), NOW(), NOW())
      `,
      [secondStaffProfileId, leaveDate, managerId]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM shift_assignments WHERE shift_id IN ($1, $2)',
      [assignedShiftId, openShiftId]
    );
    await query(
      'DELETE FROM leave_requests WHERE staff_profile_id IN ($1, $2)',
      [staffProfileId, secondStaffProfileId]
    );
    await query(
      'DELETE FROM shifts WHERE id IN ($1, $2)',
      [assignedShiftId, openShiftId]
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

  test('rejects unauthenticated rota requests', async () => {
    const response = await request(app).get(
      `/api/v1/rota?weekStart=${nextWeekStart}&department=BAR`
    );

    expect(response.status).toBe(401);
  });

  test('returns a weekly rota grid for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      `/api/v1/rota?weekStart=${nextWeekStart}&department=BAR`
    );

    expect(response.status).toBe(200);
    expect(response.body.rota).toEqual(
      expect.objectContaining({
        department: 'BAR',
        summary: expect.objectContaining({
          approvedLeave: expect.any(Number),
          assignedShifts: expect.any(Number),
          openShifts: expect.any(Number)
        }),
        weekStart: nextWeekStart
      })
    );
    expect(response.body.rota.summary.approvedLeave).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.summary.assignedShifts).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.summary.openShifts).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.days).toHaveLength(7);

    const staffRow = response.body.rota.rows.find((row) => {
      return row.staffProfileId === staffProfileId;
    });
    expect(staffRow.days[assignedShiftDate]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notes: 'Assigned rota shift',
          shiftId: assignedShiftId,
          staffName: 'Eimear Kelly',
          state: 'ASSIGNED'
        })
      ])
    );

    const openRow = response.body.rota.rows.find((row) => {
      return row.systemRow === 'OPEN_SHIFTS';
    });
    expect(openRow.days[openShiftDate]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shiftId: openShiftId,
          state: 'OPEN'
        })
      ])
    );
  });

  test('allows staff users to view the full rota without manager-only fields', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get(
      `/api/v1/rota?weekStart=${nextWeekStart}&department=ALL`
    );

    expect(response.status).toBe(200);
    expect(response.body.rota.summary).toEqual(
      expect.objectContaining({
        approvedLeave: expect.any(Number),
        assignedShifts: expect.any(Number),
        openShifts: expect.any(Number)
      })
    );
    expect(response.body.rota.summary.approvedLeave).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.summary.assignedShifts).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.summary.openShifts).toBeGreaterThanOrEqual(1);
    expect(response.body.rota.rows.length).toBeGreaterThanOrEqual(3);

    const staffRow = response.body.rota.rows.find((row) => {
      return row.staffProfileId === staffProfileId;
    });
    const assignedCell = staffRow.days[assignedShiftDate].find((cell) => {
      return cell.staffName === 'Eimear Kelly' && cell.state === 'ASSIGNED';
    });

    expect(assignedCell).toEqual(
      expect.objectContaining({
        endTime: '20:00',
        shiftDate: assignedShiftDate,
        startTime: '12:00',
        staffName: 'Eimear Kelly',
        state: 'ASSIGNED'
      })
    );
    expect(assignedCell.assignmentId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/i));
    expect(assignedCell.notes).toBeUndefined();
    expect(assignedCell.shiftId).toBe(assignedShiftId);
    expect(
      response.body.rota.rows.some((row) => row.staffName === 'Darragh Byrne')
    ).toBe(true);
  });

  test('allows staff users to view their previous-week work history', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get('/api/v1/rota/history');

    expect(response.status).toBe(200);
    expect(response.body.weeks).toEqual(expect.any(Array));
    response.body.weeks.forEach((week) => {
      expect(week).toEqual(expect.objectContaining({
        hours: expect.any(Number),
        shifts: expect.any(Array),
        weekEnd: expect.any(String),
        weekStart: expect.any(String)
      }));
    });
  });

  test('rejects invalid rota filters', async () => {
    const agent = await loginAsManager();
    const response = await agent.get(
      '/api/v1/rota?weekStart=2026-06-10&department=HOST&extra=true'
    );

    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported filters: extra',
        'weekStart must be a Monday date',
        'department must be one of: FLOOR, BAR, KITCHEN, OTHER, ALL'
      ])
    );
  });
});
