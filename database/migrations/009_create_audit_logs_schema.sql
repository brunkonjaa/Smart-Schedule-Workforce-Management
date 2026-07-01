CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action VARCHAR(40) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  summary VARCHAR(250) NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT audit_logs_action_check
    CHECK (
      action IN (
        'ASSIGNMENT_CREATED',
        'ASSIGNMENT_UPDATED',
        'ASSIGNMENT_DELETED',
        'SHIFT_CREATED',
        'SHIFT_UPDATED',
        'SHIFT_DELETED'
      )
    ),
  CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN ('ASSIGNMENT', 'SHIFT')),
  CONSTRAINT audit_logs_summary_not_blank_check
    CHECK (BTRIM(summary) <> '')
);

CREATE INDEX audit_logs_actor_user_id_idx
  ON audit_logs (actor_user_id);

CREATE INDEX audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id);

CREATE INDEX audit_logs_created_at_idx
  ON audit_logs (created_at);
