CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  manager_comment VARCHAR(500),
  decided_by_user_id UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_requests_staff_profile_id_fkey
    FOREIGN KEY (staff_profile_id)
    REFERENCES staff_profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT leave_requests_decided_by_user_id_fkey
    FOREIGN KEY (decided_by_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT leave_requests_date_order_check
    CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_reason_not_blank_check
    CHECK (BTRIM(reason) <> ''),
  CONSTRAINT leave_requests_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT leave_requests_decision_fields_check
    CHECK (
      (status = 'PENDING' AND decided_at IS NULL AND decided_by_user_id IS NULL)
      OR (
        status IN ('APPROVED', 'REJECTED')
        AND decided_at IS NOT NULL
        AND decided_by_user_id IS NOT NULL
      )
    ),
  CONSTRAINT leave_requests_manager_comment_not_blank_check
    CHECK (manager_comment IS NULL OR BTRIM(manager_comment) <> '')
);

CREATE INDEX leave_requests_staff_dates_idx
  ON leave_requests (staff_profile_id, start_date, end_date);

CREATE INDEX leave_requests_status_idx
  ON leave_requests (status);
