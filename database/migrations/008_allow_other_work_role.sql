ALTER TABLE shifts
  DROP CONSTRAINT shifts_required_role_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_required_role_check
    CHECK (required_role IN ('FLOOR', 'BAR', 'KITCHEN', 'OTHER'));
