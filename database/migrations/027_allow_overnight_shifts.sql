ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_time_order_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_non_zero_duration_check
  CHECK (end_time <> start_time);
