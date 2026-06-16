# Screenshot Evidence Log

This folder is for report evidence and build proof only.

## Main Rule

Do not treat screenshots like random desktop captures. Save them in a way that still makes sense later when the report needs a direct reference.

## Folder Rule

Keep current evidence under `tests/` and split it by what the screenshot is proving.

Current folders in use:

1. `backend-setup`
2. `backend-auth`
3. `backend-workflows`
4. `database-setup`
5. `frontend-shell`
6. `frontend-workflows`
7. `jira`
8. `migrations`

If a new type of evidence is needed later, add another clear folder instead of dumping everything into one place.

## Filename Rule

Use this format:

`NNN_short-description.png`

Examples:

1. `tests/backend-setup/001_backend-health-check-response.png`
2. `tests/database-setup/028_staff-profiles-table-visible-in-neon.png`
3. `tests/jira/032_scrum-12-in-progress.png`

## Numbering Rule

1. use one number sequence across the whole project
2. do not restart numbering inside each folder
3. do not reuse a number for different evidence
4. if the screenshot is a replacement of the exact same evidence item, keeping the same number is fine
5. if it proves something else, use the next number

## Current Numbering Log

- `001` backend health check response
- `002` backend server running
- `003` overview dark
- `004` overview light
- `005` overview staff light
- `006` rota light
- `007` shifts dark
- `008` shifts light
- `009` sprint 1 board
- `010` Neon project created
- `011` database URL configured
- `012` DB health check working
- `013` SCRUM-6 done
- `014` SCRUM-7 in progress
- `015` migration status no files
- `016` migration runner no files
- `017` sprint 1 all items done
- `018` next sprint created
- `019` sprint 1 completed
- `020` sprint 2 planned
- `021` sprint 2 started
- `022` SCRUM-10 in progress
- `023` users migration status applied
- `024` SCRUM-10 done
- `025` users table visible in Neon
- `026` users table columns query
- `027` SCRUM-11 in progress
- `028` staff profiles table visible in Neon
- `029` staff profiles columns query
- `030` staff profiles migration file
- `031` SCRUM-11 done
- `032` SCRUM-12 in progress
- `033` seed initial data file
- `034` seeded users query result
- `035` seed migration status applied
- `036` SCRUM-12 done
- `037` SCRUM-13 done and SCRUM-14 in progress
- `038` SCRUM-14 done
- `039` login success response
- `040` auth me success response
- `041` logout success response
- `042` auth me after logout unauthorized
- `043` SCRUM-15 done and SCRUM-16 in progress
- `044` auth security test suite passing
- `045` SCRUM-16 done
- `046` role middleware test suite passing
- `047` SCRUM-17, SCRUM-18, and SCRUM-19 in progress
- `048` staff management test suite passing
- `049` SCRUM-17, SCRUM-18, and SCRUM-19 done
- `050` login invalid credentials
- `051` staff records manager view light
- `052` staff create form filled
- `053` staff duplicate email error
- `054` staff update saved
- `055` staff list with inactive record
- `056` staff filter floor
- `057` staff filter bar
- `058` availability save success
- `059` availability validation end time before start
- `060` leave request validation missing reason
- `061` leave request submitted pending
- `062` leave request approved manager view
- `063` shift validation end time before start
- `064` staff blocked from manager shifts page
- `065` workflow route test suite passing
- `066` shift delete button visible
- `067` availability entry delete success
- `068` shift delete success
- `069` assignments review shift working
- `070` assignments staff assigned success

## Practical Reminder

Avoid screenshots that leak things I would not want sitting in the repo or in a report draft.

That means:

1. no full passwords
2. no full connection strings
3. no secret keys
4. no irrelevant browser tabs if I can avoid it
