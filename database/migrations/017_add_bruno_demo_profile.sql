INSERT INTO staff_profiles (
  user_id,
  full_name,
  primary_role,
  contract_hours,
  is_active
)
SELECT
  users.id,
  'Bruno Suric',
  'OTHER',
  40.00,
  TRUE
FROM users
WHERE users.email = 'brunkonjaa@gmail.com'
  AND NOT EXISTS (
    SELECT 1
    FROM staff_profiles
    WHERE staff_profiles.user_id = users.id
  );
