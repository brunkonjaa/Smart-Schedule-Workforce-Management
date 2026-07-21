ALTER TABLE audit_logs
  DROP CONSTRAINT audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (
    action IN (
      'ASSIGNMENT_CREATED',
      'ASSIGNMENT_UPDATED',
      'ASSIGNMENT_DELETED',
      'SHIFT_CREATED',
      'SHIFT_UPDATED',
      'SHIFT_DELETED',
      'EMPLOYEE_SUMMARY_VIEWED',
      'EMPLOYEE_SUMMARY_PRINT_REQUESTED',
      'EMPLOYEE_SUMMARY_ACCESS_DENIED'
    )
  );

ALTER TABLE audit_logs
  DROP CONSTRAINT audit_logs_entity_type_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('ASSIGNMENT', 'SHIFT', 'STAFF_PROFILE'));
