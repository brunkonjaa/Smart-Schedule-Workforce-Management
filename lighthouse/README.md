# Lighthouse Evidence

These are the saved Lighthouse checks for the hosted application. I ran them in Chrome Incognito on 20 July 2026 after the free Render service was warm. The HTML files are easier to read and the JSON files keep the exact scores, URL, mode and audit details. Lighthouse supports the browser review, but it does not replace the keyboard and focus checks I did myself.

| Report | Mode | Result |
| --- | --- | --- |
| `lighthouse-mobile-hosted-login-2026-07-20` | Mobile navigation, public login | 99 Performance, 91 Accessibility, 96 Best Practices, 90 SEO; this is the valid run before the semantic fixes |
| `lighthouse-mobile-manager-rota-snapshot-2026-07-20` | Mobile snapshot, authenticated manager Rota | 17/17 Accessibility and 4/4 Best Practices checks passed |
| `lighthouse-desktop-hosted-login-snapshot-2026-07-20` | Desktop snapshot, public login after commit `4a67646a58982e58d542b9fbfba07c470f424b26` | 100 Accessibility, 96 Best Practices, 100 SEO |

The first login report found the invisible autofill decoys, skipped mobile heading level and missing description. I corrected those exact findings and used the desktop snapshot to confirm the deployed result. Best Practices remains at 96 because an unauthenticated login page check to `/api/v1/auth/me` correctly returns `401`.

Later navigation retries returned `NO_NAVSTART`, so Chrome had not captured the page-load trace required for the performance metrics. Those failed reports are not stored here and are not counted as zero scores. Lighthouse also leaves manual items such as tab order, focus movement and modal trapping to the reviewer. Those checks are recorded separately in `docs/testing/browser_accessibility_review.md`.
