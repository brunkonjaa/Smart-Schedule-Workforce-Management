CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL,
  target_user_id UUID NULL,
  staff_profile_id UUID NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  ip_address TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT security_events_actor_user_id_fkey
    FOREIGN KEY (actor_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT security_events_target_user_id_fkey
    FOREIGN KEY (target_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT security_events_staff_profile_id_fkey
    FOREIGN KEY (staff_profile_id)
    REFERENCES staff_profiles (id)
    ON DELETE SET NULL,
  CONSTRAINT security_events_event_type_not_blank_check
    CHECK (length(trim(event_type)) > 0),
  CONSTRAINT security_events_outcome_check
    CHECK (outcome IN ('SUCCESS', 'FAILURE'))
);

CREATE INDEX IF NOT EXISTS security_events_created_at_idx
  ON security_events (created_at);

CREATE INDEX IF NOT EXISTS security_events_event_type_idx
  ON security_events (event_type);

CREATE INDEX IF NOT EXISTS security_events_actor_user_id_idx
  ON security_events (actor_user_id);

CREATE INDEX IF NOT EXISTS security_events_target_user_id_idx
  ON security_events (target_user_id);
