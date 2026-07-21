# Lighthouse Evidence

These are the saved Lighthouse checks for the hosted application. I ran them in Chrome Incognito on 20 July 2026 after the free Render service was warm. The HTML files are easier to read and the JSON files keep the exact scores, URL, mode and audit details. Lighthouse supports the browser review, but it does not replace the keyboard and focus checks I did myself.

| Report | Mode | Result |
| --- | --- | --- |
| `lighthouse-mobile-hosted-login-2026-07-20` | Mobile navigation, public login | 99 Performance, 91 Accessibility, 96 Best Practices, 90 SEO; this is the valid run before the semantic fixes |
| `lighthouse-mobile-manager-rota-snapshot-2026-07-20` | Mobile snapshot, authenticated manager Rota | 17/17 Accessibility and 4/4 Best Practices checks passed |
| `lighthouse-desktop-hosted-login-snapshot-2026-07-20` | Desktop snapshot, public login after commit `4a67646a58982e58d542b9fbfba07c470f424b26` | 100 Accessibility, 96 Best Practices, 100 SEO |

The first login report found the invisible autofill decoys, skipped mobile heading level and missing description. I corrected those exact findings and used the desktop snapshot to confirm the deployed result. Best Practices remains at 96 because an unauthenticated login page check to `/api/v1/auth/me` correctly returns `401`.

Later navigation retries returned `NO_NAVSTART`, so Chrome had not captured the page-load trace required for the performance metrics. Those failed reports are not stored here and are not counted as zero scores. Lighthouse also leaves manual items such as tab order, focus movement and modal trapping to the reviewer. Those checks are recorded separately in `docs/testing/browser_accessibility_review.md`.

I ran PageSpeed Insights again on 21 July 2026 after merge `eb9ff328a6f69640c1c50c3fdd432b27f4d946a7` reached Render. This time the 1.4 MB PNG had been replaced by a 24 KB WebP and the initial text responses were compressed. Mobile Performance increased from 75 to 99 and mobile Largest Contentful Paint dropped from 8.9 seconds to 1.8 seconds. Desktop Performance increased from 95 to 100 with a 0.4 second Largest Contentful Paint. Accessibility and SEO stayed at 100 in both runs. PageSpeed still lists the main stylesheet as render-blocking, with an estimated 1,340 ms mobile saving, so I have not described that item as fully removed. Screenshots `194` and `195` keep the actual results because PageSpeed scores can change slightly between runs.
