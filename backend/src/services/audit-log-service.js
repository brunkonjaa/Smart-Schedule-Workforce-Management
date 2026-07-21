const { query } = require('../config/db');

const employeeAccessActions = [
  'EMPLOYEE_SUMMARY_VIEWED',
  'EMPLOYEE_SUMMARY_PRINT_REQUESTED',
  'EMPLOYEE_SUMMARY_ACCESS_DENIED'
];

const mapAuditLogRecord = (record) => ({
  action: record.action,
  actorEmail: record.actor_email || null,
  actorName: record.actor_name || null,
  afterState: record.after_state,
  beforeState: record.before_state,
  createdAt: record.created_at,
  entityId: record.entity_id,
  entityType: record.entity_type,
  id: record.id,
  summary: record.summary
});

const listAuditLogs = async ({ limit = 100 } = {}) => {
  const result = await query(
    `
      SELECT
        audit_logs.id,
        audit_logs.action,
        audit_logs.entity_type,
        audit_logs.entity_id,
        audit_logs.summary,
        audit_logs.before_state,
        audit_logs.after_state,
        audit_logs.created_at,
        users.email AS actor_email,
        staff_profiles.full_name AS actor_name
      FROM audit_logs
      LEFT JOIN users
        ON users.id = audit_logs.actor_user_id
      LEFT JOIN staff_profiles
        ON staff_profiles.user_id = users.id
      WHERE audit_logs.entity_type IN ('ASSIGNMENT', 'SHIFT')
      ORDER BY audit_logs.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map(mapAuditLogRecord);
};

const createAuditLog = async ({
  action,
  actorUserId,
  afterState = null,
  beforeState = null,
  client = null,
  entityId,
  entityType,
  summary
}) => {
  const executeQuery = client ? client.query.bind(client) : query;

  await executeQuery(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        summary,
        before_state,
        after_state,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW())
    `,
    [
      actorUserId,
      action,
      entityType,
      entityId,
      summary,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null
    ]
  );
};

const createEmployeeAccessEvent = async ({
  action,
  actorUserId,
  result,
  source = null,
  targetStaffProfileId
}) => {
  if (!employeeAccessActions.includes(action)) {
    throw new Error(`Unsupported Employee access action "${action}".`);
  }

  const summaries = {
    EMPLOYEE_SUMMARY_ACCESS_DENIED: 'Denied Employee Summary access',
    EMPLOYEE_SUMMARY_PRINT_REQUESTED: 'Requested Employee Summary print',
    EMPLOYEE_SUMMARY_VIEWED: 'Viewed Employee Summary'
  };

  await createAuditLog({
    action,
    actorUserId,
    afterState: {
      result,
      source
    },
    beforeState: null,
    entityId: targetStaffProfileId,
    entityType: 'STAFF_PROFILE',
    summary: summaries[action]
  });
};

const mapEmployeeAccessRecord = (record) => ({
  action: record.action,
  actorEmail: record.actor_email || null,
  actorName: record.actor_name || null,
  createdAt: record.created_at,
  id: record.id,
  result: record.result,
  source: record.source || null,
  targetEmployeeId: record.entity_id,
  targetEmployeeName: record.target_employee_name || null
});

const listEmployeeAccessLogs = async ({ page = 1, pageSize = 25 } = {}) => {
  const offset = (page - 1) * pageSize;
  const [recordsResult, countResult] = await Promise.all([
    query(
      `
        SELECT
          audit_logs.id,
          audit_logs.action,
          audit_logs.entity_id,
          audit_logs.created_at,
          audit_logs.after_state ->> 'result' AS result,
          audit_logs.after_state ->> 'source' AS source,
          users.email AS actor_email,
          actor_profiles.full_name AS actor_name,
          target_profiles.full_name AS target_employee_name
        FROM audit_logs
        LEFT JOIN users
          ON users.id = audit_logs.actor_user_id
        LEFT JOIN staff_profiles actor_profiles
          ON actor_profiles.user_id = users.id
        LEFT JOIN staff_profiles target_profiles
          ON target_profiles.id = audit_logs.entity_id
        WHERE audit_logs.entity_type = 'STAFF_PROFILE'
          AND audit_logs.action = ANY($1::varchar[])
        ORDER BY audit_logs.created_at DESC, audit_logs.id DESC
        LIMIT $2 OFFSET $3
      `,
      [employeeAccessActions, pageSize, offset]
    ),
    query(
      `
        SELECT COUNT(*)::int AS total
        FROM audit_logs
        WHERE entity_type = 'STAFF_PROFILE'
          AND action = ANY($1::varchar[])
      `,
      [employeeAccessActions]
    )
  ]);
  const total = Number(countResult.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    logs: recordsResult.rows.map(mapEmployeeAccessRecord),
    pagination: {
      hasNext: page < totalPages,
      hasPrevious: page > 1,
      page,
      pageSize,
      total,
      totalPages
    }
  };
};

module.exports = {
  createAuditLog,
  createEmployeeAccessEvent,
  employeeAccessActions,
  listEmployeeAccessLogs,
  listAuditLogs
};
