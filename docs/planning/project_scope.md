# Project Scope

This file sets the boundary around Smart Schedule. It explains the problem I chose, what I finished, and what I deliberately left outside a small hospitality rota application.

## The problem I chose

I have spent over 25 years in hospitality management, so the problem came from work I know first hand. A weekly rota is not just names in boxes. Before assigning somebody, a manager has to know whether the person is active, can work that role, is on approved leave, already has a clashing shift, or is reaching the weekly limits. Last-minute swaps then add another set of messages and checks.

Staff need the same information from the other side. They should be able to see the rota, request Time Off and deal with a future shift change without learning a large HR system or contacting several people to find the right answer.

## The finished MVP

Smart Schedule now includes:

1. separate Admin, Manager and Staff accounts with backend permission checks;
2. staff records with role, contract hours and active state;
3. a Monday-to-Sunday rota for Bar, Floor, Kitchen and Kitchen Porter;
4. shift creation, editing and assignment from the Manager workflow;
5. overnight shifts and checks for approved leave, role mismatch, duplicate assignment, overlapping or touching shifts, five shifts and forty hours per week;
6. a contract-hours warning that still lets the Manager make the final decision when the hard limits pass;
7. Time Off submission, withdrawal and Manager approval or rejection;
8. future shift swaps with an optional target, staff acceptance and a final Manager decision;
9. a reviewable `Populate next week` draft based on the current week's shift pattern;
10. previous worked weeks, Employee Summary and separate rota/employee-access audit records;
11. password reset, password change, passkeys and the narrow Admin account-security workspace;
12. NodyChat workplace and direct conversations with participant checks; and
13. an installable web-app shell for browsers that support it.

## Why the application stays small

The focus is ordinary staffing work in one hospitality workplace. I did not add payroll, accounting or a large HR section just to make the system appear bigger. A small hospitality business may not need those parts, and it may already use another service for them. Keeping them out leaves a shorter route between signing in and doing the actual rota job.

This is a scope choice, not a claim that payroll or HR never matter. A business can use Smart Schedule if this focused setup fits how it works. A larger or multi-site organisation would need more than this MVP provides.

## Main rules

1. Only an active staff account with the required role can be assigned.
2. Approved Time Off blocks an assignment on the matching date.
3. Overlapping and touching shifts are blocked.
4. More than five assigned shifts or forty assigned hours in one week is blocked.
5. Contract-hour excess returns a warning when the hard rules still allow the save.
6. Staff can read the full rota but cannot change shifts or assignments.
7. Only the owner can request a swap from their own future assignment.
8. A swap changes the rota only after staff acceptance, Manager approval and one final eligibility check.
9. An Admin does not inherit Manager access to employee or rota information.

## Two deliberate workflow limits

`Populate next week` is not automatic scheduling. It copies a pattern, applies fixed rules and shows a draft. The Manager remains responsible for checking the demand, the people and any unfilled shift before approving it.

Weekly availability was removed. Asking every staff member to fill in another form each week did not match the normal hospitality routine I was trying to support. Smart Schedule treats the regular pattern as normal and records exceptions through Time Off and shift swaps. Migration `014_remove_weekly_availability.sql` keeps that direction change visible in the real database history.

## Outside this MVP

The finished submission does not include payroll or accounting, POS/sales forecasting, billing, multi-branch management, native Android or iOS applications, or autonomous rota publishing. Chat retention/deletion controls and independent participant testing are also outside this release.

The application, database and main automated checks are complete for the submitted scope. Hosted checks that could not be repeated are listed in [known_limitations.md](../release/known_limitations.md) and the exact release evidence is in [final_verification_record.md](../release/final_verification_record.md).
