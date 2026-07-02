const { query } = require('../config/db');
const {
  evaluateAssignmentEligibility,
  findAssignmentByShiftId,
  findShiftForAssignment,
  roundHours
} = require('./assignment-service');

const recommendationBaseScore = 100;

const createConflictError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const mapShift = (shift) => {
  return {
    date: shift.shift_date,
    endTime: shift.end_time.slice(0, 5),
    id: shift.id,
    requiredRole: shift.required_role,
    startTime: shift.start_time.slice(0, 5)
  };
};

const listRecommendationStaffCandidates = async () => {
  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours,
        staff_profiles.is_active,
        users.is_active AS user_is_active
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE users.role = 'STAFF'
      ORDER BY staff_profiles.full_name ASC, staff_profiles.id ASC
    `
  );

  return result.rows;
};

const buildExcludedCandidate = (staffProfile, exclusionReason) => {
  return {
    name: staffProfile.full_name,
    reason: {
      code: exclusionReason.code,
      message: exclusionReason.message
    },
    staffId: staffProfile.id
  };
};

const buildAverageCurrentHours = (eligibleCandidates) => {
  if (eligibleCandidates.length === 0) {
    return 0;
  }

  const totalHours = eligibleCandidates.reduce((total, candidate) => {
    return total + candidate.currentWeeklyHours;
  }, 0);

  return roundHours(totalHours / eligibleCandidates.length);
};

const createScoreReason = (code, message, scoreChange) => {
  return {
    code,
    message,
    scoreChange
  };
};

const buildScoredRecommendation = (
  candidate,
  averageCurrentHours,
  lowestCurrentHours
) => {
  let score = recommendationBaseScore;
  const reasons = [];

  if (candidate.currentWeeklyHours < candidate.contractHours) {
    score += 20;
    reasons.push(
      createScoreReason(
        'BELOW_CONTRACT_HOURS',
        'Currently below contracted weekly hours.',
        20
      )
    );
  }

  if (candidate.currentWeeklyHours < averageCurrentHours) {
    score += 10;
    reasons.push(
      createScoreReason(
        'LOWER_THAN_ELIGIBLE_AVERAGE',
        'Current weekly hours are below the eligible staff average.',
        10
      )
    );
  }

  if (candidate.currentWeeklyHours === lowestCurrentHours) {
    score += 5;
    reasons.push(
      createScoreReason(
        'LOWEST_CURRENT_HOURS',
        'Currently has the lowest weekly hours among eligible staff.',
        5
      )
    );
  }

  if (candidate.projectedWeeklyHours > candidate.contractHours) {
    score -= 15;
    reasons.push(
      createScoreReason(
        'CONTRACT_HOURS_EXCEEDED',
        'This shift would push weekly hours over contract.',
        -15
      )
    );
  }

  if (candidate.currentWeeklyHours > averageCurrentHours) {
    score -= 5;
    reasons.push(
      createScoreReason(
        'HIGHER_THAN_ELIGIBLE_AVERAGE',
        'Current weekly hours are already high compared with other eligible staff.',
        -5
      )
    );
  }

  return {
    ...candidate,
    reasons,
    score
  };
};

const sortRecommendations = (left, right) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.projectedWeeklyHours !== right.projectedWeeklyHours) {
    return left.projectedWeeklyHours - right.projectedWeeklyHours;
  }

  if (left.currentWeeklyHours !== right.currentWeeklyHours) {
    return left.currentWeeklyHours - right.currentWeeklyHours;
  }

  const nameComparison = left.name.localeCompare(right.name);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return left.staffId.localeCompare(right.staffId);
};

const getShiftRecommendations = async (shiftId) => {
  const shift = await findShiftForAssignment(shiftId);

  if (!shift) {
    return {
      excluded: [],
      missingResource: 'shift',
      recommendations: [],
      shift: null
    };
  }

  if (shift.status !== 'OPEN') {
    throw createConflictError('SHIFT_NOT_OPEN', 'Only open shifts can be recommended.');
  }

  const existingAssignment = await findAssignmentByShiftId(shiftId);

  if (existingAssignment) {
    throw createConflictError(
      'SHIFT_ALREADY_ASSIGNED',
      'This shift already has an assignment.'
    );
  }

  const staffCandidates = await listRecommendationStaffCandidates();
  const eligibleCandidates = [];
  const excludedCandidates = [];

  for (const staffProfile of staffCandidates) {
    const evaluation = await evaluateAssignmentEligibility(
      {
        shiftId: shift.id,
        staffProfileId: staffProfile.id
      },
      shift,
      staffProfile
    );

    if (!evaluation.eligible) {
      excludedCandidates.push(
        buildExcludedCandidate(staffProfile, evaluation.exclusionReason)
      );
      continue;
    }

    eligibleCandidates.push({
      contractHours: evaluation.weeklyHours.contractHours,
      currentWeeklyHours: evaluation.weeklyHours.assignedHoursBefore,
      name: staffProfile.full_name,
      projectedWeeklyHours: evaluation.weeklyHours.projectedHours,
      role: staffProfile.primary_role,
      staffId: staffProfile.id,
      warnings: evaluation.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message
      }))
    });
  }

  const averageCurrentHours = buildAverageCurrentHours(eligibleCandidates);
  const lowestCurrentHours =
    eligibleCandidates.length > 0
      ? Math.min(...eligibleCandidates.map((candidate) => candidate.currentWeeklyHours))
      : 0;

  const recommendations = eligibleCandidates
    .map((candidate) => {
      return buildScoredRecommendation(
        candidate,
        averageCurrentHours,
        lowestCurrentHours
      );
    })
    .sort(sortRecommendations);

  return {
    excluded: excludedCandidates,
    missingResource: null,
    recommendations,
    shift: mapShift(shift)
  };
};

module.exports = {
  getShiftRecommendations
};
