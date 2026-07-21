const { query } = require('../config/db');

const sensitiveMetadataNamePattern =
  /(password|passcode|pepper|token|secret|session|cookie|credential|hmac|hash)/i;

const sanitizeMetadata = (value, depth = 0) => {
  if (depth > 4 || value === null || typeof value === 'undefined') {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeMetadata(entry, depth + 1));
  }

  if (typeof value !== 'object') {
    if (typeof value === 'string') {
      return value.slice(0, 500);
    }

    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveMetadataNamePattern.test(key))
      .slice(0, 40)
      .map(([key, entry]) => [key, sanitizeMetadata(entry, depth + 1)])
  );
};

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
      metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null
    ]
  );
};

module.exports = {
  createSecurityEvent,
  sanitizeMetadata
};
