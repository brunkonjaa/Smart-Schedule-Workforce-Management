CREATE TABLE availability_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id UUID NOT NULL,
  week_start DATE NOT NULL,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT availability_entries_staff_profile_id_fkey
    FOREIGN KEY (staff_profile_id)
    REFERENCES staff_profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT availability_entries_week_start_monday_check
    CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  CONSTRAINT availability_entries_day_of_week_check
    CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT availability_entries_time_order_check
    CHECK (end_time > start_time),
  CONSTRAINT availability_entries_status_check
    CHECK (status IN ('AVAILABLE', 'UNAVAILABLE')),
  CONSTRAINT availability_entries_exact_window_unique
    UNIQUE (staff_profile_id, week_start, day_of_week, start_time, end_time, status)
);

CREATE INDEX availability_entries_staff_week_idx
  ON availability_entries (staff_profile_id, week_start, day_of_week);

CREATE INDEX availability_entries_week_status_idx
  ON availability_entries (week_start, status);
