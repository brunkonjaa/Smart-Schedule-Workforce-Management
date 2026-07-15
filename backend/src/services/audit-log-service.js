const { query } = require('../config/db');

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

module.exports = {
  createAuditLog,
  listAuditLogs
};
