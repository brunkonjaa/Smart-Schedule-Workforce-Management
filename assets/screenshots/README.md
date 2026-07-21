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
5. `deployment`
6. `frontend-shell`
7. `frontend-workflows`
8. `jira`
9. `migrations`

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
- `071` shift assignments migration status applied
- `072` shift assignments table visible
- `073` shift assignments columns query
- `074` assignment route test suite passing
- `075` assignment API manager login success
- `076` assignment API shift created
- `077` assignment API create success
- `078` assignment API duplicate conflict
- `079` assignment route test suite passing
- `080` rota first weekly view manager
- `081` rota manager desktop clean
- `082` rota manager cell actions
- `083` rota staff read only view
- `084` rota manager mobile day view
- `085` Render hosted health connected
- `086` Render hosted app login page
- `087` Render service overview
- `088` hosted manager rota week loaded
- `089` hosted manager staff list loaded
- `090` hosted staff rota read-only actions
- `091` historical local recommendation modal before the weekly rota flow replaced it
- `092` historical local recommendation exclusions before the weekly rota flow replaced it
- `093` local evidence check local database
- `094` local evidence seed output from the earlier recommendation checkpoint
- `095` backend test menu full suite passing
- `096` security access-control test suite passing
- `097` historical recommendation test suite before that route left the final scope
- `098` dependency audit zero vulnerabilities
- `099` rota manager desktop department-filtered view
- `100` centered desktop login account access
- `101` rota staff mobile department-filtered view
- `102` staff mobile time-off request form
- `103` mobile login account access
- `104` staff overview history card with swap requests and time off
- `105` staff time-off request page
- `106` filled Bar rota view
- `107` staff swap requests page
- `108` hosted mobile PWA install prompt
- `109` hosted staff swap requests desktop
- `110` hosted manager overview desktop
- `111` hosted manager rota desktop
- `112` NodyChat workplace room opened
- `113` NodyChat unread count and jump-to-latest control
- `114` NodyChat latest messages opened
- `115` NodyChat new-message notification
- `116` local chat migration applied
- `117` Render shell access free-tier limit
- `118` Render backend root directory
- `119` Render build command including migration
- `120` current local weekly rota
- `121` current local manager overview
- `122` current local staff-management layout
- `123` current local manager Time Off layout
- `124` current local manager Swap Requests layout
- `125` staff schedule history
- `126` staff Time Off request
- `127` swap request awaiting manager decision
- `128` swap approval blocked by role conflict
- `129` rejected swap result
- `130` hosted staff rota after a fresh authenticated sign-in
- `131` hosted staff Time Off page with an approved demo request
- `132` hosted NodyChat workplace room with unread-state evidence
- `133` corrected local NodyChat direct conversation selected for Maeve Ryan
- `134` terminal migration status showing migrations `001` through `022` applied
- `135` hosted staff rota at verified 200% Chrome zoom
- `136` terminal backend coverage run with 14 suites and 91 tests passing
- `137` local staff Time Off request rejected because the end date is before the start date
- `138` local manager assignment rejected because the end time is before the start time, with focus returned to Start time
- `139` fresh local PowerShell coverage run with 14 suites and 91 tests passing on 20 July 2026
- `140` successful GitHub Actions backend job showing PostgreSQL setup, migrations, coverage tests, dependency audit and coverage upload
- `141` safe hosted Audit Log print preview using landscape layout and page 1 only
- `142` mobile hosted login Lighthouse navigation result: 99 Performance, 91 Accessibility, 96 Best Practices and 90 SEO before the semantic fixes
- `143` authenticated mobile manager Rota Lighthouse snapshot with 17/17 Accessibility and 4/4 Best Practices checks passing
- `144` post-fix desktop hosted login Lighthouse snapshot with 100 Accessibility, 96 Best Practices and 100 SEO
- `145` hosted manager Rota confirmation after 61 generated next-week assignments were approved and saved
- `146` hosted manager assignment dialog rejecting a shift that overlaps or touches an existing shift
- `147` hosted manager passkey registration reaching the browser-managed WebAuthn confirmation prompt
- `149` cropped local proof that the selected rota week is kept separate from Later upcoming shifts
- `153` local staff denial result returned to the read-only Rota with no Employee Summary panel, email, phone or manager-only employee links
- `154` cropped local manager Rota workspace after the desktop width was reduced from the full app-shell width to 1560 pixels
- `155` cropped hosted Employee access page showing five real view and print-request records with the total and page controls
- `156` cropped hosted Rota activity after page navigation, showing 1,744 records and page 3 of 70
- `157` Neon production monitoring showing the active compute, low RAM and CPU use, zero deadlocks and the short row-activity spike from the storage check
- `158` Neon production monitoring showing the connection counts and database-size graph, with `neondb` at about 16 MB and all databases at about 39 MB
- `159` local Admin workspace signed in as Niamh O'Sullivan, with Ciaran Murphy and the submission-review banner visible
- `160` the same Admin workspace at 390 x 844 without page-level horizontal overflow
- `161` Declan O'Connor's one-use invitation after the password step, waiting for passkey registration
- `162` Ciaran Murphy stopped at the required passkey setup screen before the Admin workspace opens
- `163` Niamh O'Sullivan's Password and passkeys page with empty password fields and the optional review-account controls
- `164` the Manager Audit Log with About these records expanded and keyboard checked
- `165` the Admin workspace at 1024 x 768
- `166` recent Admin security events showing Niamh O'Sullivan as the actor for the browser checks
- `167` the Manager Rota after the Admin-only frontend changes
- `168` desktop Employee Summary for Aoife Brennan over the Staff page
- `169` the same Aoife Brennan Employee Summary at 390 x 844
- `170` Employee access history showing Maeve Ryan opening Aoife Brennan's summary, without a linked employee name or implementation note in the heading
- `171` A4 Employee Summary print evidence for Aoife Brennan after the Irish-name and fake-marked demo-address correction
- `177` combined Phase 1 and Phase 2 lint evidence showing the `chore/phase-1-verification` branch, the exact lint command and a clean returned PowerShell prompt
- `178` combined Phase 1 and Phase 2 backend coverage showing 25 passing suites, 219 passing tests and 62.18% branch coverage
- `179` combined Phase 1 and Phase 2 production dependency audit and Argon2id benchmark showing zero known vulnerabilities, the configured parameters, four concurrent operations and the observed local timing and memory result
- `180` PR-triggered GitHub Actions evidence for pull request `#1`, commit `f97d9a5` and successful backend workflow run `29859249959`
- `181` deployed Render response evidence showing the exact hosted WebSocket CSP origin, frame protection, nosniff, no-referrer, HSTS, service-worker cache v12 and connected health result
- `182` production session-cookie attributes with the value omitted, followed by six passing Phase 3 HTTP security tests
- `183` GitHub repository security settings showing secret scanning, push protection, Dependabot security updates and vulnerability alerts enabled
- `184` repository security review showing clean current-file and Git-history scans plus the five largest tracked files, without printing matched secret values
- `185` authenticated hosted login and `/me` evidence showing `Secure`, `HttpOnly` and `SameSite=Lax` with the cookie value omitted, followed by a `204` cleanup logout
- `186` Phase 4 local verification showing 29 passing suites, 236 passing tests, final coverage, migrations `001` to `027`, clean ESLint and zero known production dependency vulnerabilities

## Phase 4 index review

I checked the numbered image files against this index on 21 July 2026. There are 182 numbered files and every one has a caption here. Number `108` is a JPG, not a missing PNG. Numbers `148` and `150` to `152` are unused. I left those gaps in place because renumbering later screenshots would make older report references point at the wrong evidence. No evidence number is duplicated.

## Practical Reminder

Avoid screenshots that leak things I would not want sitting in the repo or in a report draft.

That means:

1. no full passwords
2. no full connection strings
3. no secret keys
4. no irrelevant browser tabs if I can avoid it
