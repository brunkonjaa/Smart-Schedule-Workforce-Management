const { query } = require('../config/db');

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
  createAuditLog
};
