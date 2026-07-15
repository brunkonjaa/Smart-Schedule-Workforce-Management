CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
  requester_staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  target_staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  accepted_by_staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
  reason VARCHAR(500),
  manager_note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS shift_swap_requests_status_idx
  ON shift_swap_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_swap_request_per_assignment_idx
  ON shift_swap_requests (assignment_id)
  WHERE status IN ('PENDING', 'ACCEPTED');
