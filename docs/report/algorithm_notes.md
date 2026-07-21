# Smart Schedule Algorithm Notes

This file explains the parts of Smart Schedule that make a decision in a set order. In plain terms, it shows why an assignment is accepted or refused, how a next-week suggestion is chosen, how a swap changes state and how NodyChat knows what is unread. There is no separate AI scheduling engine. The Manager-reviewed next-week result is a browser draft and still saves through the normal protected shift and assignment routes.

## Assignment order and hard conflicts

An assignment starts by checking the request contains the right kind of values. The backend then protects the decision as one database transaction so two requests cannot quietly save conflicting results at the same time. The rules run in this order:

1. the shift must exist and have `OPEN` status
2. the staff profile and linked user must both be active
3. `primary_role` must match the shift `required_role`
4. approved leave cannot cover the shift date
5. another assignment cannot overlap or touch the new shift time on the same date
6. the projected Monday-to-Sunday total cannot exceed five assigned shifts
7. the projected Monday-to-Sunday hours cannot exceed forty

The first failed rule returns a conflict and nothing is inserted. The same checks run again when an assignment is changed to another person. This order is visible in `backend/src/services/assignment-service.js`, with the weekly limits at lines 17-18 and the eligibility path around lines 441-534.

## Contract-hour warnings

`staff_profiles.contract_hours` is a warning threshold, not another hard block. This was kept separate because a real hospitality week can contain agreed extra hours while still staying inside the five-shift and forty-hour safety limits. If the projected total passes the contract value, the save succeeds and the response contains `CONTRACT_HOURS_EXCEEDED`, projected hours, contract hours, the difference and the Monday week start. The manager sees the warning before treating the rota as finished.

## Manager-reviewed next-week population

`buildDraftRota` in `frontend/src/services/rota-ui.js` moves the current week's pattern forward by seven days and removes exact duplicates already present in the target week. It then works through shifts with the fewest matching-role staff first. This reduces the chance that a hard-to-fill role is left until the end.

For each shift, the candidate list keeps staff who match the role, are not on approved leave, do not overlap an existing or already suggested shift, stay below five shifts, and stay at or below forty hours. Candidates are ordered by current shift count, then current hours, then name. The first candidate becomes a suggestion. When nobody passes, the shift remains in `unfilled` with the reason shown to the manager.

This is deliberately a preview. No generated shift or suggestion is saved until the manager selects Approve. Saving then calls the existing manager-only shift and assignment APIs, so backend validation still has the final decision.

## Shift-swap transitions

Only the owner of a future `OPEN` assignment can create a request. A request may name one active staff profile with the required role or stay open. The database prevents a second `PENDING` or `ACCEPTED` request for the same assignment.

A targeted request can only be accepted by that target. An open request can be accepted by another staff member after the assignment eligibility check. The request then moves from `PENDING` to `ACCEPTED`. Manager approval calls `updateAssignment`, which runs the live role, leave, time and weekly-limit checks again. The assignment changes first, then the request is marked `APPROVED`. A manager can instead mark an active request `REJECTED`. `CANCELLED` and `EXPIRED` are allowed database values but the current routes do not expose those transitions, so the report should not present them as working actions.

## NodyChat unread and message rules

The shared `WORKPLACE` conversation is created by migration `022`. Bootstrap makes sure the signed-in user has a participant row, which also covers staff accounts created after that migration. A direct conversation uses the two sorted user UUIDs as `direct_key`, so the same pair reopens one record instead of creating duplicates.

Conversation lists start from `chat_conversation_participants`, so a direct room is not returned to an outsider. A send checks the same membership before inserting. A saved WebSocket message is broadcast only to connected user IDs returned from the participant table.

Unread state is separate for each `(user_id, conversation_id)`. The unread query counts messages from another sender after the stored `last_read_message_id` and also returns the first unread UUID. A read update uses an insert-select joined to conversation participants. If the message belongs to a direct room the user is not part of, no read row is written.
