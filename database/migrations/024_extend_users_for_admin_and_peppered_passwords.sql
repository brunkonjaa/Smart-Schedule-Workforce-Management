ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('MANAGER', 'STAFF', 'ADMIN'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS password_scheme VARCHAR(20) NOT NULL DEFAULT 'BCRYPT',
  ADD COLUMN IF NOT EXISTS password_pepper_version INTEGER NULL,
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_submission_reviewer BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD CONSTRAINT users_password_scheme_check
  CHECK (password_scheme IN ('BCRYPT', 'ARGON2ID_PEPPERED')),
  ADD CONSTRAINT users_password_pepper_version_check
  CHECK (
    (password_scheme = 'BCRYPT' AND password_pepper_version IS NULL)
    OR
    (password_scheme = 'ARGON2ID_PEPPERED' AND password_pepper_version > 0)
  ),
  ADD CONSTRAINT users_session_version_check
  CHECK (session_version > 0),
  ADD CONSTRAINT users_submission_reviewer_role_check
  CHECK (is_submission_reviewer = FALSE OR role = 'ADMIN'),
  ADD CONSTRAINT users_display_name_not_blank_check
  CHECK (display_name IS NULL OR length(trim(display_name)) > 0);
