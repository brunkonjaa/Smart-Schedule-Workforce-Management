# Local Performance Measurements

## What I measured

I ran `node scripts/measure_local_performance.js` on 17 July 2026 against `http://localhost:3000` and the guarded `smart_schedule_local` PostgreSQL database. Migrations 001 to 022 were applied. Each row below is fifteen sequential HTTP requests after one manager login.

This is server-response evidence only. It does not include Render wake-up time, a real broadband/4G connection, browser painting or JavaScript interaction time, so it does not prove the original under-three-second browser target by itself.

| Request | Average body | Median | 95th percentile / maximum |
| --- | ---: | ---: | ---: |
| Frontend HTML `/` | 3,595 bytes | 3.02 ms | 12.29 ms |
| Main CSS | 82,707 bytes | 2.75 ms | 3.90 ms |
| Health plus database check | 38 bytes | 2.09 ms | 3.79 ms |
| Weekly rota API, all departments | 36,966 bytes | 10.21 ms | 115.69 ms |
| Manager staff API | 12,814 bytes | 6.93 ms | 8.63 ms |
| NodyChat bootstrap API | 23,754 bytes | 9.79 ms | 93.92 ms |

The rota and chat requests have the widest first/slow response, but every recorded local response stayed below 116 ms. That result is useful for comparing backend work on the same machine. It should not be turned into a claim about hosted mobile load time.

## Repeating the check

1. run `npm run local:evidence:check` in `backend`
2. start the app with `npm run local:evidence:start`
3. run `node scripts/measure_local_performance.js` from the repo root

The script uses only the deterministic evidence manager and does not print the password or session cookie in its results.
