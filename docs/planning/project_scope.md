# Project Scope

## Change Note

- Previous position: the scope included swap requests, reports, and a wider scheduling feature set.
- Updated position: the scope now matches the current MVP.
- Why: to match the current proposal.

## Project Thesis

Smart Schedule is a web-based rota system for small hospitality teams. It brings staff, availability, leave requests, and weekly shifts into one place.

## Problem Statement

Small hospitality businesses often manage rotas through messages, paper notes, and spreadsheets. Things get missed. Leave gets approved late. Staff get scheduled when they are not free. Managers then spend extra time fixing the week.

The project solves that by keeping the weekly rota workflow in one system.

## Current MVP

1. User accounts with role-based access: `Manager` and `Staff`
2. Staff record management
3. Weekly availability submission
4. Leave request submission
5. Leave approval or rejection
6. Shift creation
7. Manual shift assignment
8. Staff shift view
9. Basic conflict warnings

## Deferred From Earlier Draft

These items were in older documents. They are not part of the implementation starting point now.

1. Shift swaps
2. Smart candidate suggestions
3. Reports
4. Audit log screens
5. Rota publication flow

## Out of Scope

1. Payroll integration
2. Native mobile app
3. Biometric attendance hardware
4. Multi-branch support
5. POS or sales forecasting integration
6. Full auto-scheduling

## Core Rules

1. A staff member cannot be assigned to overlapping shifts.
2. A staff member cannot be assigned when unavailable.
3. Approved leave blocks assignment.
4. Contract hours can trigger a warning.
5. Manager-only actions stay manager-only.

## Success Criteria

1. A manager can create a weekly rota using availability and leave data.
2. A staff user can log in and view their own shifts.
3. The system blocks or warns about common scheduling problems.
4. The main flows can be tested without editing the database by hand.

## Technical Direction

1. Web app with separate frontend and backend
2. PostgreSQL database
3. Session-based authentication
4. Deployment on Neon and Render
