UPDATE users
SET email = CASE staff_profiles.full_name
  WHEN 'Alex Byrne' THEN 'alex.byrne@example.com'
  WHEN 'Jamie Murphy' THEN 'jamie.murphy@example.com'
  WHEN 'Casey Doyle' THEN 'casey.doyle@example.com'
  ELSE users.email
END,
    updated_at = NOW()
FROM staff_profiles
WHERE staff_profiles.user_id = users.id
  AND staff_profiles.full_name IN ('Alex Byrne', 'Jamie Murphy', 'Casey Doyle')
  AND users.email IN ('staff1@example.com', 'staff2@example.com', 'staff3@example.com');
