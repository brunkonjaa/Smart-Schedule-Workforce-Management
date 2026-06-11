# Project Scope

## What This Scope Covers

This file is the build target for the current Smart Schedule MVP.

It is not a claim that every feature listed here already exists in working backend code. Some of it is already in the frontend shell, some of it is already in the database layer, and some of it is still the next implementation step.

## Project Thesis

Smart Schedule is a web-based rota system for small hospitality teams.

The main problem is not complicated in theory, but it becomes messy fast in real use. A manager needs to know who is active, who is available, who is on leave, what shifts still need coverage, and who is already overbooked. A staff member mainly needs a smaller and clearer version of that same system.

## Problem This Project Is Trying To Solve

Small hospitality teams often end up managing rotas through messages, paper notes, calls, and spreadsheets. That works until too many separate decisions start depending on each other.

Typical issues are:

1. leave requests get noticed too late
2. staff are scheduled when they are not free
3. overlapping work gets missed
4. the manager spends time fixing avoidable mistakes after the rota is already half-made

This project tries to put that weekly workflow into one system instead of spreading it across too many places.

## Current MVP Scope

The current MVP keeps the project to the core workflow:

1. user accounts with `MANAGER` and `STAFF` roles
2. staff record management
3. weekly availability submission
4. leave request submission
5. leave approval or rejection
6. shift creation
7. manual staff assignment
8. staff rota view
9. basic conflict checks

## What Is Already Grounded In The Repo

Parts already visible in the repo:

1. frontend shell pages for the main workflows
2. backend foundation with a database-backed health route
3. `users` schema migration
4. `staff_profiles` schema migration
5. initial seed data migration
6. PostgreSQL-backed session configuration
7. login, logout, and current-session auth routes
8. first backend auth tests
9. SRS diagram exports under `docs/SRS/diagrams/`

Parts still not built yet:

1. authentication and role middleware for the rest of the route surface
2. availability routes
3. leave routes
4. shifts and assignments routes
5. conflict-check service logic

## Deferred From The Older Draft

These were in earlier versions of the project notes, but I pushed them out because they were widening the build too early:

1. shift swaps
2. smart candidate suggestions
3. reports
4. audit log screens
5. rota publication flow

## Out Of Scope

These are not part of the current module build:

1. payroll integration
2. native mobile app
3. biometric attendance hardware
4. multi-branch support
5. POS or sales forecasting integration
6. full auto-scheduling

## Core Rules The MVP Depends On

1. a staff member cannot be assigned to overlapping shifts
2. a staff member cannot be assigned during approved leave
3. availability needs to be checked before assignment
4. contract hours can raise a warning
5. manager-only actions stay manager-only

## What Counts As Success

For this MVP, success means:

1. a manager can manage the weekly rota flow in one place
2. a staff user can log in and see only their own side of the system
3. common scheduling conflicts are blocked or clearly warned
4. the main flows can be demonstrated without hand-editing database rows every time

## Technical Direction

1. frontend and backend stay separate
2. the database stays on `PostgreSQL`
3. authentication stays session-based
4. hosting direction stays with `Neon` and `Render`

I kept the MVP narrower because finishing the real base workflow is more useful than half-building every nice extra idea around it.
