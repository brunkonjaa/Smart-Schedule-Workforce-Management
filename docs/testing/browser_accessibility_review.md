# Browser, Keyboard And Accessibility Review

## Current status

The live browser-control connection was not available during the 17 July report pass, even though the local app and database were running. Because of that I have not marked the desktop/tablet/phone, 200% zoom or full keyboard route as freshly passed. Existing screenshots 099 to 103 and 108 show earlier desktop/mobile/PWA states, but screenshots are not a replacement for running the matrix again.

The code-level checks and fixes below were completed. The remaining live checks are listed separately so the report does not turn source inspection into browser evidence.

## Completed code and contrast checks

| Area | Evidence checked | Result |
| --- | --- | --- |
| Responsive layout | CSS breakpoints at 1120, 900, 760/720, 620 and 560 px; wide tables use controlled horizontal overflow | Code support present; live size matrix still required |
| Rota dialogs | `aria-modal`, `role=dialog`, labelled heading, initial focus, Tab/Shift+Tab trap, Escape close and return to the rota trigger | Present in `rota-ui.js` |
| Swap warning dialog | labelled/described modal, initial focus, Tab trap, Escape close and return focus | Present in `swap-requests-ui.js` |
| NodyChat keyboard | input receives focus on open; Escape closes; focus returns to launcher | Return/Escape handling added in this pass |
| NodyChat announcements | message list uses `role=log`/polite additions; status uses `role=status`/polite live region | Added in this pass |
| Department filter | regular buttons with `aria-pressed` instead of incomplete ARIA tab semantics | Corrected in this pass |
| Validation | native required/email/password fields plus server-side exact-field, date, UUID, ownership and business-rule validation | Covered by route suites; live error focus still required |
| Reduced motion | `prefers-reduced-motion: reduce` rules are present | Code support present |

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

## Live matrix still to run

When a browser connection is available, check these in both manager and staff sessions:

1. 1440 x 900 desktop, 768 x 1024 tablet and 390 x 844 phone widths
2. keyboard-only path from login through Rota, Time Off, Swap Requests and NodyChat
3. visible focus on navigation, buttons, form fields, rota cell actions and chat controls
4. modal focus entry, Tab/Shift+Tab containment, Escape close and focus return
5. invalid login, Time Off, shift and assignment messages with focus/announcement behaviour
6. 200% browser zoom without lost controls or overlapping fixed chat content
7. light and dark theme spot checks for text, status and focus contrast

This matrix is developer-run accessibility evidence. Independent participant testing remains outside the agreed work plan.
