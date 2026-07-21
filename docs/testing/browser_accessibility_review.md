# Browser, Keyboard And Accessibility Review

## Current status

I reran the live browser checks on 18 July 2026 against the guarded `smart_schedule_local` database after migrations 001 to 022 were confirmed. I signed in as Maeve O'Connor and Aaron Collins. The browser sizes were 1920 x 855, 1024 x 768 and 390 x 844. The manager and staff rota views, manager pages, invalid login, NodyChat, manager/staff navigation boundary and rota modal keyboard behaviour were checked from the running interface.

The live checks passed at those three sizes without page-level horizontal overflow or browser console errors. I then used the real Chrome window controls for the zoom check. The measured CSS viewport changed from 1920 x 855 at device pixel ratio 1 to 960 x 427 at device pixel ratio 2. This is an actual 200% browser zoom result, not only a resized window. The staff rota kept its navigation and weekly table without document-level horizontal overflow. Screenshot `135` records the result, and Chrome was reset to 1920 x 855 at 100% afterward.

## Completed code and contrast checks

| Area | Evidence checked | Result |
| --- | --- | --- |
| Responsive layout | CSS breakpoints at 1120, 900, 760/720, 620 and 560 px; live checks at 1920 x 855, 1024 x 768 and 390 x 844 | Passed at the three measured sizes; no page-level horizontal overflow |
| Rota dialogs | `aria-modal`, `role=dialog`, labelled heading, initial focus, Tab trap, Escape close and return to the rota trigger | Passed live; focus started on Change time, all 22 sampled Tab moves stayed inside the 19-control dialog, and Escape returned focus to the cell action |
| Swap warning dialog | labelled/described modal, initial focus, Tab trap, Escape close and return focus | Present in `swap-requests-ui.js` |
| NodyChat keyboard | input receives focus on open; Escape closes; focus returns to launcher | Passed live for the workplace/direct selector and message field |
| NodyChat announcements | message list uses `role=log`/polite additions; status uses `role=status`/polite live region | Added in this pass |
| Department filter | regular buttons with `aria-pressed` instead of incomplete ARIA tab semantics | Corrected in this pass |
| Validation | invalid manager login plus native/server-side validation paths | Invalid login passed live with `Invalid email or password.`; a staff Time Off request with an end date before its start date stayed unsaved; an assignment with 17:00 start and 10:00 end stayed unsaved, showed the server message and returned focus to Start time |
| Reduced motion | `prefers-reduced-motion: reduce` rules are present | Code support present |
| Manager/staff RBAC | manager-only Staff and Audit log navigation, plus direct hash access | Staff navigation hid both links and direct `#audit-logs` access returned the staff user to `#rota` |
| Dark theme | staff rota at 390 x 844 | Passed the visual/overflow spot check; body text/background resolved to light text on the dark surface |

## Measured colour pairs

`node scripts/check_colour_contrast.js` checks the main solid text/background pairs. All listed pairs now pass the WCAG AA 4.5:1 normal-text threshold.

| Pair | Ratio |
| --- | ---: |
| Light text on light background | 16.54:1 |
| Light muted text on light background | 5.94:1 |
| Light accent on white | 6.29:1 |
| White on purple primary-button end | 6.29:1 |
| White on teal primary-button end | 5.47:1 |
| Light success / unread / error on white | 5.33 / 5.17 / 6.57:1 |
| Dark text / muted / accent on dark background | 16.15 / 8.58 / 5.78:1 |
| Dark success / unread / error overrides | 10.84 / 10.48 / 9.95:1 |

The earlier bright teal end of the primary-button gradient did not give enough contrast with white text, so it was changed from `#14b8a6` to `#0f766e`. Dark NodyChat success, unread and error text also received explicit light-colour overrides.

## Live results recorded on 18 July 2026

| Check | Result |
| --- | --- |
| Manager login and rota | Passed; manager cell actions and all four department filters rendered |
| Manager Overview, Audit log, Staff, Time Off and Swap Requests | Passed after each asynchronous route finished loading |
| Staff login and rota | Passed; the full published roster rendered without manager cell actions |
| Staff role boundary | Passed; Staff and Audit log links were absent and direct audit hash access returned to Rota |
| Invalid login | Passed; the rejected credentials stayed on `#login` and showed the server message |
| Invalid Time Off date order | Passed; end date before start date was rejected with `End date must be the same as or after the start date.` and the existing request count stayed at one |
| Invalid assignment time order | Passed; 17:00 to 10:00 was rejected with `End time must be later than start time.`, focus returned to Start time, and the future rota cell stayed OFF |
| NodyChat | Passed; workplace room opened with message focus, direct conversation selection reached connected state, and Escape returned focus to the launcher |
| Rota modal | Passed; focus entry, containment, Escape close and return to the original cell action were observed |
| 1920 x 855, 1024 x 768 and 390 x 844 | Passed without document-level horizontal overflow |
| Dark mobile staff rota | Passed visual and overflow spot check at 390 x 844 |
| 960 x 428 zoom-pressure equivalent | Passed without lost controls or document overflow |
| Actual 200% Chrome zoom | Passed at a measured 960 x 427 CSS viewport and device pixel ratio 2; no document overflow |

The hosted public root also returned HTTP 200 after a 23.536 second free-tier wake-up. The warm `/health` request returned HTTP 200 in 81 ms with `database: connected`, and unauthenticated `/api/v1/auth/me` correctly returned 401 in 114 ms.

A fresh hosted fake-staff login then returned 200 after a 25.144 second cold wake. The same session returned 200 for `/api/v1/auth/me` in 136 ms, the weekly rota in 296 ms, Time Off in 121 ms, swap requests in 120 ms, NodyChat messages in 312 ms, NodyChat people in 115 ms and rota history in 249 ms. The real hosted interface also loaded Aoife O'Sullivan's rota, Time Off page, NodyChat workplace room and a direct conversation selection. Screenshots `130` to `132` record the hosted views without showing the login form or password. Screenshot `133` records the corrected direct-conversation wording from the current local code.

Screenshot `138` records the future-date assignment rejection and visible focus return. The only remaining live account check is a fresh hosted manager login. The current manager password was not reset or guessed for this check. Independent participant testing remains outside the agreed work plan.

## Lighthouse check on 20 July 2026

I ran Lighthouse from Chrome Incognito against the warm hosted application. The valid mobile login navigation run scored 99 Performance, 91 Accessibility, 96 Best Practices and 90 SEO. It found that the two invisible login autofill decoys still counted as unlabelled controls, the mobile layout hid the page `h2` above an `h3`, and the document had no meta description.

I removed the decoy controls and gave the real labelled email/password fields their standard autocomplete purposes. `Account access` is now the section `h2`, and `frontend/public/index.html` has a Smart Schedule-specific description. After commit `4a67646a58982e58d542b9fbfba07c470f424b26` deployed, the desktop login snapshot scored 100 Accessibility, 96 Best Practices and 100 SEO. The authenticated mobile manager Rota snapshot separately passed 17/17 Accessibility and 4/4 Best Practices checks.

The remaining Best Practices reduction comes from the public page checking `/api/v1/auth/me` and correctly receiving `401` without a session. I kept that authentication boundary instead of returning a false success only to change a Lighthouse score. Later navigation attempts failed with `NO_NAVSTART`, which means Chrome did not record the start of the page trace. Those attempts are not presented as performance failures. Screenshots `142` to `144` and the HTML/JSON files under `lighthouse/` keep the valid results separate.

This matrix is developer-run accessibility evidence. Independent participant testing remains outside the agreed work plan.
