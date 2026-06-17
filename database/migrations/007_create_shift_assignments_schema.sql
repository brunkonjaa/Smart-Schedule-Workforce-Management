CREATE TABLE shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL,
  staff_profile_id UUID NOT NULL,
  assigned_by_user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shift_assignments_shift_id_unique UNIQUE (shift_id),
  CONSTRAINT shift_assignments_shift_id_fkey
    FOREIGN KEY (shift_id)
    REFERENCES shifts (id)
    ON DELETE CASCADE,
  CONSTRAINT shift_assignments_staff_profile_id_fkey
    FOREIGN KEY (staff_profile_id)
    REFERENCES staff_profiles (id),
  CONSTRAINT shift_assignments_assigned_by_user_id_fkey
    FOREIGN KEY (assigned_by_user_id)
    REFERENCES users (id)
);

CREATE INDEX shift_assignments_staff_profile_id_idx
  ON shift_assignments (staff_profile_id);

CREATE INDEX shift_assignments_assigned_at_idx
  ON shift_assignments (assigned_at);
