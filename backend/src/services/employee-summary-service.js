const { query } = require('../config/db');
const {
  getAssignmentTotalsForWeek,
  getShiftHours,
  roundHours
} = require('./assignment-service');
const {
  isMondayDate,
  parseIsoDate
} = require('./workflow-service-utils');

const allowedSummarySources = [
  'AUDIT_LOG',
  'DIRECT',
  'ROTA',
  'STAFF',
  'SWAP_REQUESTS',
  'TIME_OFF'
];
const summaryFilterNames = ['source', 'weekStart'];

const addDays = (dateValue, dayCount) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
};

const getMondayForDate = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  const dayOffset = (date.getUTCDay() || 7) - 1;
  date.setUTCDate(date.getUTCDate() - dayOffset);
  return date.toISOString().slice(0, 10);
};

const getCurrentIsoDate = (now = new Date()) => {
  return new Date(now.getTime()).toISOString().slice(0, 10);
};

const normalizeSource = (value) => {
  const normalized = String(value || 'DIRECT')
    .trim()
    .replace(/[-\s]+/g, '_')
    .toUpperCase();

  return allowedSummarySources.includes(normalized) ? normalized : null;
};

const buildEmployeeSummaryFilters = (queryParams, now = new Date()) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !summaryFilterNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  const currentDate = getCurrentIsoDate(now);
  const currentWeekStart = getMondayForDate(currentDate);
  let selectedWeekStart = currentWeekStart;

  if (queryParams?.weekStart) {
    const parsedWeekStart = parseIsoDate(queryParams.weekStart);

    if (!parsedWeekStart) {
      details.push('weekStart must be a valid YYYY-MM-DD date');
    } else if (!isMondayDate(parsedWeekStart)) {
      details.push('weekStart must be a Monday date');
    } else {
      selectedWeekStart = parsedWeekStart;
    }
  }

  const source = normalizeSource(queryParams?.source);

  if (!source) {
    details.push(`source must be one of: ${allowedSummarySources.join(', ')}`);
  }

  return {
    details,
    filters: {
      currentDate,
      currentWeekStart,
      selectedWeekStart,
      source
    }
  };
};

const mapEmployeeProfile = (record) => {
  if (!record) {
    return null;
  }

  return {
    accountStatus: record.user_is_active ? 'ACTIVE' : 'INACTIVE',
    contractedWeeklyHours: Number(record.contract_hours),
    department: record.primary_role,
    email: record.email,
    employmentStartDate: record.employment_start_date,
    employmentStatus: record.staff_profile_is_active ? 'ACTIVE' : 'INACTIVE',
    fullName: record.full_name,
    id: record.id,
    phone: record.phone_number,
    role: record.user_role
  };
};

const findEmployeeSummaryProfile = async (staffProfileId) => {
  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours,
        staff_profiles.phone_number,
        staff_profiles.is_active AS staff_profile_is_active,
        staff_profiles.created_at::date::text AS employment_start_date,
        users.email,
        users.role AS user_role,
        users.is_active AS user_is_active
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE staff_profiles.id = $1
        AND users.role = 'STAFF'
      LIMIT 1
    `,
    [staffProfileId]
  );

  return mapEmployeeProfile(result.rows[0]);
};

const mapAssignment = (record) => ({
  assignmentId: record.assignment_id,
  department: record.required_role,
  endTime: String(record.end_time).slice(0, 5),
  shiftDate: record.shift_date,
  shiftId: record.shift_id,
  startTime: String(record.start_time).slice(0, 5)
});

const listActiveAssignments = async (staffProfileId, startDate, endDate) => {
  const result = await query(
    `
      SELECT
        shift_assignments.id AS assignment_id,
        shifts.id AS shift_id,
        shifts.shift_date::text AS shift_date,
        shifts.start_time::text AS start_time,
        shifts.end_time::text AS end_time,
        shifts.required_role
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      WHERE shift_assignments.staff_profile_id = $1
        AND shifts.shift_date BETWEEN $2::date AND $3::date
        AND shifts.status <> 'CANCELLED'
      ORDER BY shifts.shift_date ASC, shifts.start_time ASC, shift_assignments.id ASC
    `,
    [staffProfileId, startDate, endDate]
  );

  return result.rows.map(mapAssignment);
};

const listLaterUpcomingAssignments = async (
  staffProfileId,
  currentDate,
  futureEndDate,
  selectedWeekStart,
  selectedWeekEnd
) => {
  const result = await query(
    `
      SELECT
        shift_assignments.id AS assignment_id,
        shifts.id AS shift_id,
        shifts.shift_date::text AS shift_date,
        shifts.start_time::text AS start_time,
        shifts.end_time::text AS end_time,
        shifts.required_role
      FROM shift_assignments
      INNER JOIN shifts
        ON shifts.id = shift_assignments.shift_id
      WHERE shift_assignments.staff_profile_id = $1
        AND shifts.shift_date BETWEEN $2::date AND $3::date
        AND shifts.status <> 'CANCELLED'
        AND NOT (shifts.shift_date BETWEEN $4::date AND $5::date)
      ORDER BY shifts.shift_date ASC, shifts.start_time ASC, shift_assignments.id ASC
    `,
    [
      staffProfileId,
      currentDate,
      futureEndDate,
      selectedWeekStart,
      selectedWeekEnd
    ]
  );

  return result.rows.map(mapAssignment);
};

const mapInactiveAssignment = (record) => {
  const startTime = record.start_time ? String(record.start_time).slice(0, 5) : null;
  const endTime = record.end_time ? String(record.end_time).slice(0, 5) : null;

  return {
    department: record.department || null,
    detailsRetained: Boolean(
      record.shift_date && startTime && endTime && record.department
    ),
    endTime,
    recordedAt: record.recorded_at,
    shiftDate: record.shift_date || null,
    startTime,
    status: record.assignment_status
  };
};

const listInactiveAssignments = async (
  staffProfileId,
  { endDate = null, limit = 2147483647, startDate = null } = {}
) => {
  const result = await query(
    `
      SELECT
        inactive_assignments.assignment_status,
        inactive_assignments.department,
        inactive_assignments.end_time,
        inactive_assignments.recorded_at,
        inactive_assignments.shift_date,
        inactive_assignments.start_time
      FROM (
        SELECT
          'DELETED'::text AS assignment_status,
          audit_logs.before_state ->> 'requiredRole' AS department,
          audit_logs.before_state ->> 'endTime' AS end_time,
          audit_logs.created_at AS recorded_at,
          audit_logs.before_state ->> 'shiftDate' AS shift_date,
          audit_logs.before_state ->> 'startTime' AS start_time,
          audit_logs.before_state ->> 'staffProfileId' AS staff_profile_id
        FROM audit_logs
        WHERE audit_logs.action = 'ASSIGNMENT_DELETED'
          AND audit_logs.entity_type = 'ASSIGNMENT'

        UNION ALL

        SELECT
          'CANCELLED'::text AS assignment_status,
          shifts.required_role::text AS department,
          shifts.end_time::text AS end_time,
          shifts.updated_at AS recorded_at,
          shifts.shift_date::text AS shift_date,
          shifts.start_time::text AS start_time,
          shift_assignments.staff_profile_id::text AS staff_profile_id
        FROM shift_assignments
        INNER JOIN shifts
          ON shifts.id = shift_assignments.shift_id
        WHERE shifts.status = 'CANCELLED'
      ) AS inactive_assignments
      WHERE inactive_assignments.staff_profile_id = $1::text
        AND ($2::text IS NULL OR inactive_assignments.shift_date >= $2::text)
        AND ($3::text IS NULL OR inactive_assignments.shift_date <= $3::text)
      ORDER BY inactive_assignments.recorded_at DESC
      LIMIT $4
    `,
    [staffProfileId, startDate, endDate, limit]
  );

  return result.rows.map(mapInactiveAssignment);
};

const calculateInactiveHours = (records, weekStart, weekEnd) => {
  return roundHours(
    records
      .filter((record) => {
        return (
          record.shiftDate &&
          record.shiftDate >= weekStart &&
          record.shiftDate <= weekEnd &&
          record.startTime &&
          record.endTime
        );
      })
      .reduce((total, record) => {
        return total + getShiftHours({
          end_time: record.endTime,
          start_time: record.startTime
        });
      }, 0)
  );
};

const getContractComparison = (contractedHours, activeHours) => {
  const differenceHours = roundHours(activeHours - contractedHours);
  let status = 'MATCHED';

  if (differenceHours > 0) {
    status = 'OVER';
  } else if (differenceHours < 0) {
    status = 'UNDER';
  }

  return {
    differenceHours,
    status
  };
};

const buildWeekHours = async (
  staffProfileId,
  contractedHours,
  weekStart,
  inactiveAssignments
) => {
  const totals = await getAssignmentTotalsForWeek(staffProfileId, weekStart);
  const activeAssignmentHours = totals.assignedHours;

  return {
    activeAssignmentHours,
    contractedWeeklyHours: contractedHours,
    contractComparison: getContractComparison(
      contractedHours,
      activeAssignmentHours
    ),
    deletedOrCancelledAssignmentHours: calculateInactiveHours(
      inactiveAssignments,
      totals.weekStart,
      totals.weekEnd
    ),
    weekEnd: totals.weekEnd,
    weekStart: totals.weekStart
  };
};

const mapTimeOff = (record) => ({
  endDate: record.end_date,
  id: record.id,
  reason: record.reason,
  startDate: record.start_date,
  status: record.status
});

const listTimeOff = async (staffProfileId) => {
  const waitingResult = await query(
    `
      SELECT id, start_date::text AS start_date, end_date::text AS end_date,
             status, reason
      FROM leave_requests
      WHERE staff_profile_id = $1
        AND (
          status = 'PENDING'
          OR (status = 'APPROVED' AND end_date >= CURRENT_DATE)
        )
      ORDER BY start_date ASC, created_at ASC
    `,
    [staffProfileId]
  );
  const completedResult = await query(
    `
      SELECT id, start_date::text AS start_date, end_date::text AS end_date,
             status, reason
      FROM leave_requests
      WHERE staff_profile_id = $1
        AND (
          status = 'REJECTED'
          OR (status = 'APPROVED' AND end_date < CURRENT_DATE)
        )
      ORDER BY COALESCE(decided_at, updated_at, created_at) DESC, id DESC
      LIMIT 10
    `,
    [staffProfileId]
  );

  return {
    completed: completedResult.rows.map(mapTimeOff),
    waitingOrActive: waitingResult.rows.map(mapTimeOff)
  };
};

const swapSelect = `
  SELECT
    requests.id,
    requests.status,
    requests.reason,
    requests.requester_staff_profile_id,
    requests.target_staff_profile_id,
    requests.accepted_by_staff_profile_id,
    shifts.shift_date::text AS shift_date,
    shifts.start_time::text AS start_time,
    shifts.end_time::text AS end_time,
    shifts.required_role,
    requester.full_name AS requester_name,
    target.full_name AS target_name,
    accepted.full_name AS accepted_name
  FROM shift_swap_requests requests
  INNER JOIN shift_assignments assignments
    ON assignments.id = requests.assignment_id
  INNER JOIN shifts
    ON shifts.id = assignments.shift_id
  INNER JOIN staff_profiles requester
    ON requester.id = requests.requester_staff_profile_id
  LEFT JOIN staff_profiles target
    ON target.id = requests.target_staff_profile_id
  LEFT JOIN staff_profiles accepted
    ON accepted.id = requests.accepted_by_staff_profile_id
`;

const mapSwap = (record, staffProfileId) => {
  const employeeIsRequester = record.requester_staff_profile_id === staffProfileId;
  const otherEmployee = employeeIsRequester
    ? record.accepted_name || record.target_name || null
    : record.requester_name;

  return {
    department: record.required_role,
    endTime: String(record.end_time).slice(0, 5),
    id: record.id,
    otherEmployee,
    reason: record.reason,
    shiftDate: record.shift_date,
    startTime: String(record.start_time).slice(0, 5),
    status: record.status
  };
};

const listSwapHistory = async (staffProfileId) => {
  const staffCondition = `
    (
      requests.requester_staff_profile_id = $1
      OR requests.target_staff_profile_id = $1
      OR requests.accepted_by_staff_profile_id = $1
    )
  `;
  const waitingResult = await query(
    `${swapSelect}
      WHERE ${staffCondition}
        AND requests.status IN ('PENDING', 'ACCEPTED')
      ORDER BY shifts.shift_date ASC, shifts.start_time ASC, requests.created_at ASC
    `,
    [staffProfileId]
  );
  const completedResult = await query(
    `${swapSelect}
      WHERE ${staffCondition}
        AND requests.status IN ('APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED')
      ORDER BY COALESCE(requests.decided_at, requests.created_at) DESC, requests.id DESC
      LIMIT 10
    `,
    [staffProfileId]
  );

  return {
    completed: completedResult.rows.map((record) => mapSwap(record, staffProfileId)),
    waitingOrActive: waitingResult.rows.map((record) => mapSwap(record, staffProfileId))
  };
};

const getEmployeeSummary = async (staffProfileId, filters) => {
  const employee = await findEmployeeSummaryProfile(staffProfileId);

  if (!employee) {
    return null;
  }

  const selectedWeekEnd = addDays(filters.selectedWeekStart, 6);
  const currentWeekEnd = addDays(filters.currentWeekStart, 6);
  const futureEndDate = addDays(filters.currentDate, 30);
  const previousWeekStarts = [1, 2, 3, 4].map((weekOffset) => {
    return addDays(filters.currentWeekStart, weekOffset * -7);
  });
  const hoursStartDate = [filters.selectedWeekStart, previousWeekStarts[3]].sort()[0];
  const hoursEndDate = [selectedWeekEnd, currentWeekEnd].sort().reverse()[0];

  const [
    selectedAssignments,
    laterUpcomingAssignments,
    inactiveAssignmentsForHours,
    recentInactiveAssignments,
    timeOff,
    swapRequests
  ] = await Promise.all([
    listActiveAssignments(staffProfileId, filters.selectedWeekStart, selectedWeekEnd),
    listLaterUpcomingAssignments(
      staffProfileId,
      filters.currentDate,
      futureEndDate,
      filters.selectedWeekStart,
      selectedWeekEnd
    ),
    listInactiveAssignments(staffProfileId, {
      endDate: hoursEndDate,
      startDate: hoursStartDate
    }),
    listInactiveAssignments(staffProfileId, { limit: 10 }),
    listTimeOff(staffProfileId),
    listSwapHistory(staffProfileId)
  ]);

  const weekStarts = [
    filters.selectedWeekStart,
    filters.currentWeekStart,
    ...previousWeekStarts
  ];
  const weekHours = await Promise.all(
    [...new Set(weekStarts)].map((weekStart) => {
      return buildWeekHours(
        staffProfileId,
        employee.contractedWeeklyHours,
        weekStart,
        inactiveAssignmentsForHours
      );
    })
  );
  const hoursByWeek = new Map(weekHours.map((week) => [week.weekStart, week]));
  const previousCompletedWeeks = previousWeekStarts.map((weekStart) => {
    return hoursByWeek.get(weekStart);
  });
  const fourWeekAverage = roundHours(
    previousCompletedWeeks.reduce((total, week) => {
      return total + week.activeAssignmentHours;
    }, 0) / 4
  );

  return {
    assignments: {
      laterUpcoming: {
        endDate: futureEndDate,
        shifts: laterUpcomingAssignments,
        startDate: filters.currentDate
      },
      selectedWeek: {
        shifts: selectedAssignments,
        weekEnd: selectedWeekEnd,
        weekStart: filters.selectedWeekStart
      }
    },
    deletedOrCancelledAssignments: recentInactiveAssignments,
    employee,
    hours: {
      currentCalendarWeek:
        filters.currentWeekStart === filters.selectedWeekStart
          ? null
          : hoursByWeek.get(filters.currentWeekStart),
      fourPreviousCompletedWeekAverage: fourWeekAverage,
      previousCompletedWeeks,
      selectedRotaWeek: hoursByWeek.get(filters.selectedWeekStart)
    },
    swapRequests,
    timeOff
  };
};

module.exports = {
  allowedSummarySources,
  buildEmployeeSummaryFilters,
  findEmployeeSummaryProfile,
  getCurrentIsoDate,
  getEmployeeSummary,
  getMondayForDate,
  normalizeSource
};
