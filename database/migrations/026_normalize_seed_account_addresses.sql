UPDATE users
SET email = CASE id
  WHEN '4be2aa6f-2a3b-4b61-9b8b-0a1e5a2f5c01' THEN 'morgankellyfake@gmail.com'
  WHEN '6c514db0-aabc-4da2-a3df-2a64875d5b02' THEN 'alexbyrnefake@gmail.com'
  WHEN '8e97f39e-1a77-48b9-8f64-34765f418103' THEN 'jamiemurphyfake@gmail.com'
  WHEN 'a1b55a6d-5d58-48c4-94ff-50ac61c7f904' THEN 'caseydoylefake@gmail.com'
  ELSE email
END,
    updated_at = NOW()
WHERE id IN (
  '4be2aa6f-2a3b-4b61-9b8b-0a1e5a2f5c01',
  '6c514db0-aabc-4da2-a3df-2a64875d5b02',
  '8e97f39e-1a77-48b9-8f64-34765f418103',
  'a1b55a6d-5d58-48c4-94ff-50ac61c7f904'
)
AND email IN (
  'manager@example.com',
  'alex.byrne@example.com',
  'jamie.murphy@example.com',
  'casey.doyle@example.com',
  'staff1@example.com',
  'staff2@example.com',
  'staff3@example.com',
  'morgan.kelly@demo.smart-schedule.test',
  'alex.byrne@demo.smart-schedule.test',
  'jamie.murphy@demo.smart-schedule.test',
  'casey.doyle@demo.smart-schedule.test',
  'alexbyrnefake@gmail.com',
  'jamiemurphyfake@gmail.com',
  'caseydoylefake@gmail.com'
);
