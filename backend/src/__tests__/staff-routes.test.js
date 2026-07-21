const crypto = require('crypto');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const { closePool, query } = require('../config/db');
const {
  mutationProtectionHeaderName
} = require('../middleware/request-security');

jest.setTimeout(20000);

describe('staff routes', () => {
  const managerId = crypto.randomUUID();
  const managerStaffProfileId = crypto.randomUUID();
  const staffUserId = crypto.randomUUID();
  const staffProfileId = crypto.randomUUID();
  const extraStaffUserId = crypto.randomUUID();
  const extraStaffProfileId = crypto.randomUUID();
  const managerEmail = `declanbyrne${Date.now()}fake@gmail.com`;
  const staffEmail = `siobhankelly${Date.now()}fake@gmail.com`;
  const extraStaffEmail = `eoingallagher${Date.now()}fake@gmail.com`;
  const managerPassword = 'ManagerRoutePass123!';
  const staffPassword = 'StaffRoutePass123!';
  const temporaryResetPassword = 'StaffRouteReset123!';
  const createdStaffEmail = 'aislingbyrnefake@gmail.com';
  const mutationHeader = {
    [mutationProtectionHeaderName]: '1'
  };

  beforeAll(async () => {
    const managerPasswordHash = await bcrypt.hash(managerPassword, 10);
    const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

    await query(
      `
        INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
        VALUES
          ($1, $2, $3, 'MANAGER', TRUE, NOW(), NOW()),
          ($4, $5, $6, 'STAFF', TRUE, NOW(), NOW()),
          ($7, $8, $6, 'STAFF', TRUE, NOW(), NOW())
      `,
      [
        managerId,
        managerEmail,
        managerPasswordHash,
        staffUserId,
        staffEmail,
        staffPasswordHash,
        extraStaffUserId,
        extraStaffEmail
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
          ($1, $2, 'Declan Byrne', 'FLOOR', 40.00, '0851000001', TRUE, NOW(), NOW()),
          ($3, $4, 'Siobhan Kelly', 'BAR', 28.00, '0851000002', TRUE, NOW(), NOW()),
          ($5, $6, 'Eoin Gallagher', 'KITCHEN', 30.00, '0851000003', TRUE, NOW(), NOW())
      `,
      [
        managerStaffProfileId,
        managerId,
        staffProfileId,
        staffUserId,
        extraStaffProfileId,
        extraStaffUserId
      ]
    );
  });

  afterAll(async () => {
    await query(
      'DELETE FROM staff_profiles WHERE id IN ($1, $2, $3)',
      [managerStaffProfileId, staffProfileId, extraStaffProfileId]
    );
    await query(
      'DELETE FROM users WHERE id IN ($1, $2, $3)',
      [managerId, staffUserId, extraStaffUserId]
    );
    await query(
      'DELETE FROM staff_profiles WHERE full_name IN ($1, $2)',
      ['Aisling Byrne', 'Clodagh Murphy']
    );
    await query(
      'DELETE FROM users WHERE email IN ($1, $2)',
      [createdStaffEmail, 'clodaghmurphyfake@gmail.com']
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

  test('rejects unauthenticated staff list requests', async () => {
    const response = await request(app).get('/api/v1/staff');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Authentication Required',
      message: 'You must be logged in to access this route.'
    });
  });

  test('rejects staff users on manager-only list routes', async () => {
    const agent = await loginAsStaff();
    const response = await agent.get('/api/v1/staff');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'You do not have permission to access this route.'
    });
  });

  test('lists staff records for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent.get('/api/v1/staff');

    expect(response.status).toBe(200);
    expect(response.body.staff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: extraStaffEmail,
          fullName: 'Eoin Gallagher',
          id: extraStaffProfileId,
          isActive: true,
          primaryRole: 'KITCHEN',
          role: 'STAFF'
        }),
        expect.objectContaining({
          email: staffEmail,
          fullName: 'Siobhan Kelly',
          id: staffProfileId,
          isActive: true,
          primaryRole: 'BAR',
          role: 'STAFF'
        })
      ])
    );
  });

  test('rejects unsupported list filters', async () => {
    const agent = await loginAsManager();
    const response = await agent.get('/api/v1/staff?department=floor');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      details: ['unsupported filters: department'],
      error: 'Validation Failed',
      message: 'The staff request contains invalid fields.'
    });
  });

  test('requires the mutation protection header on staff creation', async () => {
    const agent = await loginAsManager();
    const response = await agent.post('/api/v1/staff').send({
      contractHours: 18,
      email: createdStaffEmail,
      fullName: 'Aisling Byrne',
      password: 'CreatedStaffPass123!',
      phoneNumber: '0851000004',
      primaryRole: 'FLOOR'
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'This request is missing the required mutation protection header.'
    });
  });

  test('rejects a mutation with a cross-origin request header', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/staff')
      .set(mutationHeader)
      .set('Origin', 'https://outside.example')
      .send({
        contractHours: 18,
        email: createdStaffEmail,
        fullName: "Niall O'Connor",
        password: 'CreatedStaffPass123!',
        phoneNumber: '0851000004',
        primaryRole: 'FLOOR'
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'This request failed the mutation protection check.'
    });
  });

  test('creates a staff user and linked staff profile for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/staff')
      .set(mutationHeader)
      .send({
        contractHours: 18,
        email: createdStaffEmail,
        fullName: 'Aisling Byrne',
        password: 'CreatedStaffPass123!',
        phoneNumber: '0851000004',
        primaryRole: 'FLOOR'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Staff record created successfully.');
    expect(response.body.staff).toEqual(
      expect.objectContaining({
        email: createdStaffEmail,
        fullName: 'Aisling Byrne',
        isActive: true,
        primaryRole: 'FLOOR',
        role: 'STAFF'
      })
    );

    const storedPassword = await query(
      `SELECT password_hash, password_scheme, password_pepper_version
       FROM users WHERE email = $1`,
      [createdStaffEmail]
    );
    expect(storedPassword.rows[0]).toEqual(expect.objectContaining({
      password_pepper_version: 1,
      password_scheme: 'ARGON2ID_PEPPERED'
    }));
    expect(storedPassword.rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  test('rejects invalid create payload fields for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/staff')
      .set(mutationHeader)
      .send({
        contractHours: 18.555,
        email: 'not-an-email',
        fullName: 'Clodagh Murphy',
        isActive: 'yes',
        notes: 'unexpected',
        password: 'weakpassword',
        primaryRole: 'DJ'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported fields: notes',
        'email must be a valid email address',
        'password must be at least 15 characters long',
        'primaryRole must be one of: FLOOR, BAR, KITCHEN, OTHER',
        'contractHours must use no more than 2 decimal places',
        'isActive must be a boolean'
      ])
    );
  });

  test('rejects duplicate staff emails for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post('/api/v1/staff')
      .set(mutationHeader)
      .send({
        contractHours: 18,
        email: staffEmail,
        fullName: 'Clodagh Murphy',
        password: 'CreatedStaffPass123!',
        primaryRole: 'FLOOR'
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Conflict',
      message: 'A staff account with that email already exists.'
    });
  });

  test('requires the mutation protection header on staff updates', async () => {
    const agent = await loginAsManager();
    const response = await agent.put(`/api/v1/staff/${staffProfileId}`).send({
      fullName: 'Aisling Murphy'
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Forbidden',
      message: 'This request is missing the required mutation protection header.'
    });
  });

  test('updates a staff profile for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/staff/${staffProfileId}`)
      .set(mutationHeader)
      .send({
        contractHours: 32,
        fullName: "Siobhan O'Connor",
        isActive: false,
        phoneNumber: '0851999999',
        primaryRole: 'FLOOR'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Staff record updated successfully.');
    expect(response.body.staff).toEqual(
      expect.objectContaining({
        contractHours: 32,
        email: staffEmail,
        fullName: "Siobhan O'Connor",
        id: staffProfileId,
        isActive: false,
        phoneNumber: '0851999999',
        primaryRole: 'FLOOR',
        role: 'STAFF'
        })
    );
  });

  test('rejects invalid update payload fields for managers', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/staff/${staffProfileId}`)
      .set(mutationHeader)
      .send({
        contractHours: -1.234,
        fullName: '',
        notes: 'unexpected',
        phoneNumber: 'abc',
        primaryRole: 'HOST'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Failed');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        'unsupported fields: notes',
        'fullName cannot be empty',
        'primaryRole must be one of: FLOOR, BAR, KITCHEN, OTHER',
        'contractHours must use no more than 2 decimal places',
        'phoneNumber must contain only digits and common phone symbols'
      ])
    );
  });

  test('rejects invalid staff ids on update routes', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put('/api/v1/staff/not-a-uuid')
      .set(mutationHeader)
      .send({
        fullName: 'Eoin Gallagher'
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      details: ['staffId must be a valid UUID'],
      error: 'Validation Failed',
      message: 'The staff request contains invalid fields.'
    });
  });

  test('returns 404 when updating a missing staff record', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .put(`/api/v1/staff/${crypto.randomUUID()}`)
      .set(mutationHeader)
      .send({
        fullName: "Fergus O'Neill"
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'The requested staff record could not be found.'
    });
  });

  test('managers can set a temporary password for staff accounts', async () => {
    const agent = await loginAsManager();
    const response = await agent
      .post(`/api/v1/staff/${extraStaffProfileId}/reset-password`)
      .set(mutationHeader)
      .send({
        temporaryPassword: temporaryResetPassword
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Temporary password reset successfully.');

    const oldPasswordLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: extraStaffEmail,
        password: staffPassword
      });
    const temporaryPasswordLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: extraStaffEmail,
        password: temporaryResetPassword
      });

    expect(oldPasswordLoginResponse.status).toBe(401);
    expect(temporaryPasswordLoginResponse.status).toBe(200);
    expect(temporaryPasswordLoginResponse.body.user.mustChangePassword).toBe(true);
  });
});
