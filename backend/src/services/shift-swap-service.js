const { query, withTransaction } = require('../config/db');
const {
  evaluateAssignmentEligibility,
  findShiftForAssignment,
  findStaffProfileForAssignment,
  updateAssignment
} = require('./assignment-service');
const { isPlainObject, listUnexpectedFields } = require('./workflow-service-utils');

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const swapFields = ['assignmentId', 'targetStaffProfileId', 'reason'];

const validateSwapInput = (payload) => {
  const details = [];
  if (!isPlainObject(payload)) {
    return { details: ['request body must be a JSON object'], swapInput: {} };
  }

  const assignmentId = String(payload.assignmentId || '').trim();
  const targetStaffProfileId = payload.targetStaffProfileId
    ? String(payload.targetStaffProfileId).trim()
    : null;
  const reason = payload.reason == null ? null : String(payload.reason).trim();

  const unexpected = listUnexpectedFields(payload, swapFields);
  if (unexpected.length > 0) details.push(`unsupported fields: ${unexpected.join(', ')}`);
  if (!uuidPattern.test(assignmentId)) details.push('assignmentId must be a valid UUID');
  if (targetStaffProfileId && !uuidPattern.test(targetStaffProfileId)) {
    details.push('targetStaffProfileId must be a valid UUID');
  }
  if (reason && reason.length > 500) details.push('reason must be 500 characters or fewer');

  return {
    details,
    swapInput: { assignmentId, reason, targetStaffProfileId }
  };
};

const mapSwap = (row) => ({
  acceptedAt: row.accepted_at,
  acceptedByStaffProfileId: row.accepted_by_staff_profile_id,
  assignmentId: row.assignment_id,
  createdAt: row.created_at,
  decidedAt: row.decided_at,
  id: row.id,
  managerNote: row.manager_note,
  reason: row.reason,
  requesterName: row.requester_name,
  requesterStaffProfileId: row.requester_staff_profile_id,
  shiftDate: row.shift_date,
  shiftEndTime: row.end_time,
  shiftStartTime: row.start_time,
  status: row.status,
  targetName: row.target_name,
  targetStaffProfileId: row.target_staff_profile_id
});

const swapSelect = `
  SELECT requests.*, shifts.shift_date::text AS shift_date,
         shifts.start_time::text AS start_time, shifts.end_time::text AS end_time,
         requester.full_name AS requester_name, target.full_name AS target_name
  FROM shift_swap_requests requests
  INNER JOIN shift_assignments assignments ON assignments.id = requests.assignment_id
  INNER JOIN shifts ON shifts.id = assignments.shift_id
  INNER JOIN staff_profiles requester ON requester.id = requests.requester_staff_profile_id
  LEFT JOIN staff_profiles target ON target.id = requests.target_staff_profile_id
`;

const findSwap = async (swapId, client = null, forUpdate = false) => {
  const executor = client || { query };
  const result = await executor.query(
    `${swapSelect} WHERE requests.id = $1 ${forUpdate ? 'FOR UPDATE OF requests' : ''}`,
    [swapId]
  );
  return result.rows[0] ? mapSwap(result.rows[0]) : null;
};

const createSwapRequest = async ({ requesterStaffProfileId, swapInput }) => {
  return withTransaction(async (client) => {
    const assignmentResult = await client.query(
      `
        SELECT assignments.id, assignments.staff_profile_id, shifts.shift_date,
               shifts.status, shifts.required_role
        FROM shift_assignments assignments
        INNER JOIN shifts ON shifts.id = assignments.shift_id
        WHERE assignments.id = $1
        FOR UPDATE
      `,
      [swapInput.assignmentId]
    );
    const assignment = assignmentResult.rows[0] || null;

    if (!assignment) return { code: 'NOT_FOUND' };
    if (assignment.staff_profile_id !== requesterStaffProfileId) return { code: 'FORBIDDEN' };
    if (assignment.shift_date <= new Date().toISOString().slice(0, 10)) return { code: 'PAST_SHIFT' };
    if (assignment.status !== 'OPEN') return { code: 'SHIFT_NOT_OPEN' };

    if (swapInput.targetStaffProfileId === requesterStaffProfileId) {
      return { code: 'SELF_TARGET' };
    }

    if (swapInput.targetStaffProfileId) {
      const targetResult = await client.query(
        `SELECT id, primary_role, is_active FROM staff_profiles WHERE id = $1`,
        [swapInput.targetStaffProfileId]
      );
      const target = targetResult.rows[0] || null;
      if (!target || !target.is_active || target.primary_role !== assignment.required_role) {
        return { code: 'TARGET_INELIGIBLE' };
      }
    }

    const existing = await client.query(
      `SELECT id FROM shift_swap_requests WHERE assignment_id = $1 AND status IN ('PENDING', 'ACCEPTED')`,
      [swapInput.assignmentId]
    );
    if (existing.rowCount > 0) return { code: 'ALREADY_REQUESTED' };

    const inserted = await client.query(
      `
        INSERT INTO shift_swap_requests (
          assignment_id, requester_staff_profile_id, target_staff_profile_id, reason
        ) VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [swapInput.assignmentId, requesterStaffProfileId, swapInput.targetStaffProfileId, swapInput.reason]
    );

    return { swap: await findSwap(inserted.rows[0].id, client) };
  });
};

const listSwapRequests = async (authUser) => {
  const conditions = `requests.status IN ('PENDING', 'ACCEPTED')`;
  const result = await query(
    `${swapSelect} WHERE ${conditions} AND shifts.shift_date >= CURRENT_DATE ORDER BY shifts.shift_date, shifts.start_time, requests.created_at`
  );
  return result.rows.map(mapSwap);
};

const acceptSwapRequest = async ({ swapId, staffProfileId }) => {
  return withTransaction(async (client) => {
    const swap = await findSwap(swapId, client, true);
    if (!swap || swap.status !== 'PENDING') return { code: 'NOT_AVAILABLE' };
    if (swap.targetStaffProfileId && swap.targetStaffProfileId !== staffProfileId) return { code: 'FORBIDDEN' };
    if (swap.requesterStaffProfileId === staffProfileId) return { code: 'FORBIDDEN' };
    const assignmentShift = await client.query(
      `SELECT shift_id FROM shift_assignments WHERE id = $1`,
      [swap.assignmentId]
    );
    const shift = assignmentShift.rows[0]
      ? await findShiftForAssignment(assignmentShift.rows[0].shift_id, client)
      : null;
    const candidate = await findStaffProfileForAssignment(staffProfileId, client);
    const eligibility = shift && candidate
      ? await evaluateAssignmentEligibility(
        { shiftId: shift.id, staffProfileId },
        shift,
        candidate,
        client
      )
      : { eligible: false };
    if (!eligibility.eligible) {
      return { code: 'TARGET_INELIGIBLE' };
    }
    await client.query(
      `UPDATE shift_swap_requests SET accepted_by_staff_profile_id = $1, accepted_at = NOW(), status = 'ACCEPTED' WHERE id = $2`,
      [staffProfileId, swapId]
    );
    return { swap: await findSwap(swapId, client) };
  });
};

const decideSwapRequest = async ({ decision, managerNote, swapId, managerUserId }) => {
  const swap = await findSwap(swapId);
  if (!swap || !['PENDING', 'ACCEPTED'].includes(swap.status)) return { code: 'NOT_AVAILABLE' };
  if (decision === 'APPROVE') {
    if (!swap.acceptedByStaffProfileId) return { code: 'STAFF_NOT_ACCEPTED' };
    const result = await updateAssignment(
      swap.assignmentId,
      { staffProfileId: swap.acceptedByStaffProfileId },
      managerUserId
    );
    if (result.missingResource) return { code: 'NOT_FOUND' };
  }
  const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const result = await query(
    `UPDATE shift_swap_requests SET status = $1, manager_note = $2, decided_at = NOW(), decided_by_user_id = $3 WHERE id = $4 RETURNING id`,
    [nextStatus, managerNote || null, managerUserId, swapId]
  );
  return { swap: result.rows[0] ? await findSwap(swapId) : null };
};

module.exports = {
  acceptSwapRequest,
  createSwapRequest,
  decideSwapRequest,
  listSwapRequests,
  validateSwapInput
};
