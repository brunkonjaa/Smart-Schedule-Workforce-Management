const { query } = require('../config/db');

const createSecurityEvent = async ({
  actorUserId = null,
  client = null,
  eventType,
  ipAddress = null,
  metadata = null,
  outcome = 'SUCCESS',
  staffProfileId = null,
  targetUserId = null
}) => {
  const executeQuery = client ? client.query.bind(client) : query;

  await executeQuery(
    `
      INSERT INTO security_events (
        actor_user_id,
        target_user_id,
        staff_profile_id,
        event_type,
        outcome,
        ip_address,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
    `,
    [
      actorUserId,
      targetUserId,
      staffProfileId,
      eventType,
      outcome,
      ipAddress,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

module.exports = {
  createSecurityEvent
};
