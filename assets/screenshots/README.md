# Screenshot Evidence Log

This folder is for report evidence and build proof only.

## Main Rule

Do not treat screenshots like random desktop captures. Save them in a way that still makes sense later when the report needs a direct reference.

## Folder Rule

Keep current evidence under `tests/` and split it by what the screenshot is proving.

Current folders in use:

1. `backend-setup`
2. `database-setup`
3. `frontend-shell`
4. `jira`
5. `migrations`

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

## Practical Reminder

Avoid screenshots that leak things I would not want sitting in the repo or in a report draft.

That means:

1. no full passwords
2. no full connection strings
3. no secret keys
4. no irrelevant browser tabs if I can avoid it
