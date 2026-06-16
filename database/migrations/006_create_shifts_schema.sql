CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  required_role VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shifts_time_order_check
    CHECK (end_time > start_time),
  CONSTRAINT shifts_required_role_check
    CHECK (required_role IN ('FLOOR', 'BAR', 'KITCHEN')),
  CONSTRAINT shifts_status_check
    CHECK (status IN ('DRAFT', 'OPEN', 'CANCELLED')),
  CONSTRAINT shifts_notes_not_blank_check
    CHECK (notes IS NULL OR BTRIM(notes) <> '')
);

CREATE INDEX shifts_shift_date_idx
  ON shifts (shift_date);

CREATE INDEX shifts_role_date_idx
  ON shifts (required_role, shift_date);
