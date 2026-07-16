CREATE TEMP TABLE placeholder_staff_to_remove ON COMMIT DROP AS
SELECT
  staff_profiles.id AS staff_profile_id,
  staff_profiles.user_id
FROM staff_profiles
JOIN users ON users.id = staff_profiles.user_id
WHERE staff_profiles.full_name IN ('Reset Staff', 'Swap Requester', 'Swap Target')
  AND (
    users.email LIKE 'reset-staff-%@example.com'
    OR users.email LIKE 'swap-requester-%@example.com'
    OR users.email LIKE 'swap-target-%@example.com'
  );

DELETE FROM shift_assignments
WHERE staff_profile_id IN (
  SELECT staff_profile_id
  FROM placeholder_staff_to_remove
);

DELETE FROM staff_profiles
WHERE id IN (
  SELECT staff_profile_id
  FROM placeholder_staff_to_remove
);

DELETE FROM users
WHERE id IN (
  SELECT user_id
  FROM placeholder_staff_to_remove
);
