CREATE TABLE admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by_admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_invitations_email_lowercase_check
    CHECK (invited_email = LOWER(invited_email)),
  CONSTRAINT admin_invitations_email_not_blank_check
    CHECK (length(trim(invited_email)) > 0),
  CONSTRAINT admin_invitations_display_name_not_blank_check
    CHECK (length(trim(display_name)) > 0),
  CONSTRAINT admin_invitations_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT admin_invitations_single_terminal_state_check
    CHECK (num_nonnulls(used_at, cancelled_at, expired_at) <= 1)
);

CREATE INDEX admin_invitations_invited_email_idx
  ON admin_invitations (invited_email, created_at DESC);

CREATE INDEX admin_invitations_pending_idx
  ON admin_invitations (expires_at, created_at DESC)
  WHERE used_at IS NULL AND cancelled_at IS NULL AND expired_at IS NULL;
