# Project Scope

## Project problem

Smart Schedule is for a small hospitality team where the weekly rota depends on staff roles, leave dates, shift times, and last-minute changes. The problem is not only writing names into a table. A manager also needs to avoid putting someone on approved leave, giving them overlapping work, or breaking the weekly shift and hour limits.

Staff have a different problem. They need to see the roster, request time off, see previous worked weeks, and ask for a future shift swap without sending separate messages to every colleague.

## Current MVP

The current build includes:

1. manager and staff login with server-side sessions
2. manager staff records with active/inactive state and role information
3. leave requests with manager decisions and staff withdrawal of pending requests
4. shift creation and editing for Bar, Floor, Kitchen, and Kitchen Porter work
5. manager assignment and reassignment actions
6. role, leave, active-account, duplicate, overlap, touching-shift, five-shift, and forty-hour checks
7. contract-hour warnings where the manager can still save the assignment
8. weekly rota view with week navigation and department filters
9. staff access to the full weekly roster while manager edit actions remain protected
10. manager-controlled next-week rota drafts copied from the current weekly pattern
11. password reset links with expiry and single-use tokens
12. manager-only password request display
13. future-shift swap requests with optional target staff, target acceptance, and manager approval
14. staff overview history and responsive time-off, swap, and rota navigation cards

## Not part of this MVP

I have left these out of the current build:

1. full automatic rota generation
2. payroll and attendance integration
3. POS or sales forecasting
4. multi-branch support
5. native mobile app
6. reports and wider audit reporting beyond the current manager audit page

`Populate next week` creates a manager-controlled draft for the next seven days. It copies the current shift pattern, checks the same assignment rules, and waits for manager approval before saving. This is not treated as full automatic scheduling because the manager still reviews the rota.

## Main workflow rules

1. only an active staff account with the correct role can be assigned
2. approved leave blocks assignment on matching dates
3. overlapping and touching shifts are blocked on the same day
4. more than five assigned shifts in a week is blocked
5. more than forty assigned hours in a week is blocked
6. contract-hour excess is returned as a warning when the hard limits still allow the save
7. staff can view the rota but cannot edit shifts or assignments
8. only the logged-in owner can request a swap for their own future assignment
9. a swap changes the assignment only after the target accepts and a manager approves it

## Direction change: weekly availability

Weekly availability was removed from the final workflow. In a real hospitality team staff are not normally expected to send management a fresh availability form every week. The rota uses the normal staffing pattern and handles exceptions through leave and future shift swap requests. The old availability migration remains in the ordered history, and migration `014_remove_weekly_availability.sql` removes the old table safely.

## What still needs proof

The main code workflow and manager audit page are present. The remaining project work is final hosted verification, formal UAT evidence, and final report alignment.
