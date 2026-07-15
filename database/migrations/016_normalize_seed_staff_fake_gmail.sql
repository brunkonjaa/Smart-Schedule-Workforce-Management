UPDATE users
SET email = CASE staff_profiles.full_name
  WHEN 'Alex Byrne' THEN 'alexbyrnefake@gmail.com'
  WHEN 'Jamie Murphy' THEN 'jamiemurphyfake@gmail.com'
  WHEN 'Casey Doyle' THEN 'caseydoylefake@gmail.com'
  ELSE users.email
END,
    updated_at = NOW()
FROM staff_profiles
WHERE staff_profiles.user_id = users.id
  AND staff_profiles.full_name IN ('Alex Byrne', 'Jamie Murphy', 'Casey Doyle')
  AND users.email IN (
    'alex.byrne@example.com',
    'jamie.murphy@example.com',
    'casey.doyle@example.com',
    'staff1@example.com',
    'staff2@example.com',
    'staff3@example.com'
  );
