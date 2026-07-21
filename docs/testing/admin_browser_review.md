# Admin Browser Review

## QA inventory

This pass uses Niamh O'Sullivan, Ciaran Murphy, Declan O'Connor, Maeve Ryan and Aoife Brennan against the guarded local PostgreSQL database. Their Gmail-format addresses keep the deliberate `fake` marker. The script does not print or save passwords, invitation values, cookies or passkey credential material. It removes the temporary rows when the run finishes.

| Visible claim or control | Functional check | Visual state and expected evidence |
| --- | --- | --- |
| Admin has only Admin, Password and Logout navigation | sign in as the temporary reviewer and read the real navigation | desktop Admin workspace; no Rota, Staff, Audit Log or NodyChat control |
| Reviewer exception is limited to one account | reviewer opens Admin without a passkey; ordinary Admin receives the setup screen | reviewer desktop plus ordinary-Admin setup state |
| Reviewer banner links are real | use Change password and Register passkey buttons and check keyboard focus | Password page with focus on the matching control |
| Banner dismissal lasts for one browser session | dismiss, navigate/reload, then sign out and sign in again | banner absent before logout and visible after a new session |
| Admin account page works at three sizes | inspect the populated account/invitation/event sections at 1600x900, 1024x768 and 390x844 | desktop, tablet and mobile captures with no horizontal page overflow |
| Re-authentication is accessible | open an account-changing control, press Escape, reopen and cancel | labelled modal, focus inside it and return focus after close |
| Errors are clear | submit Add administrator with invalid fields | visible validation summary without a broken layout |
| Logout and Browser Back do not restore content | log out, go back and check session/auth view | Login remains visible and Admin data is absent |
| Invalidated Admin session returns to Login | invalidate the temporary session in PostgreSQL and make another protected request | Login or expired-session feedback, no retained Admin table |
| Manager and Staff navigation stays unchanged | sign in with generated operational accounts and record labels/order | labels match the confirmed pages and no Admin link appears |
| Audit Log information control works | Manager opens the control by pointer and keyboard | existing tabs/table width remain unchanged around the new details block |
| Existing Rota and Employee Summary presentation stays unchanged | inspect Rota and the protected summary at desktop/mobile and A4 print size | evidence 167-169 and 171; no Admin selector leakage |
| Employee access uses current staff names | open Aoife Brennan's summary as Maeve Ryan, then return to Employee access | evidence 170 contains the one current access row and no implementation note in the heading |

Exploratory checks:

1. try a direct `#admin` hash while signed in as Manager and confirm the shell resolves back to an allowed page;
2. switch light/dark theme on the Admin page and confirm the account table, banner and re-authentication dialog remain readable;
3. check the densest mobile Admin table state after expanding the account actions.

## Result

The final run on 21 July 2026 passed 27 checks. A Chromium virtual authenticator completed Niamh O'Sullivan's optional passkey registration and later passkey login, then completed Declan O'Connor's required invitation activation. The account list, re-authentication dialog, logout/back behaviour, invalidated session, direct Manager hash, Manager and Staff navigation, Audit Log disclosure, Rota, Employee Summary and Employee access history all passed. Evidence `159` to `171` records the stable states, including the replacement A4 print capture for Aoife Brennan. Each screenshot was blocked until every password input on the page was empty.
