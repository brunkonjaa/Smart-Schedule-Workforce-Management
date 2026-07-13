const { query } = require('../config/db');
const {
  allowedWorkRoles,
  isMondayDate,
  parseIsoDate
} = require('./workflow-service-utils');

const listFilterFieldNames = ['department', 'weekStart'];

const dayLabels = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];
const allowedRotaDepartments = [...allowedWorkRoles, 'ALL'];

const buildWeekDays = (weekStart) => {
  const startDate = new Date(`${weekStart}T00:00:00Z`);

  return dayLabels.map((label, index) => {
    const date = new Date(startDate.getTime());
    date.setUTCDate(date.getUTCDate() + index);

    return {
      date: date.toISOString().slice(0, 10),
      dayOfWeek: index + 1,
      label
    };
  });
};

const getWeekEnd = (weekStart) => {
  const weekEndDate = new Date(`${weekStart}T00:00:00Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  return weekEndDate.toISOString().slice(0, 10);
};

const validateWeekStart = (value, details) => {
  const parsedDate = parseIsoDate(value);

  if (!parsedDate) {
    details.push('weekStart must be a valid YYYY-MM-DD date');
    return null;
  }

  if (!isMondayDate(parsedDate)) {
    details.push('weekStart must be a Monday date');
    return null;
  }

  return parsedDate;
};

const buildRotaFilters = (queryParams) => {
  const details = [];
  const unexpectedFilters = Object.keys(queryParams || {}).filter((fieldName) => {
    return !listFilterFieldNames.includes(fieldName);
  });

  if (unexpectedFilters.length > 0) {
    details.push(`unsupported filters: ${unexpectedFilters.join(', ')}`);
  }

  const weekStart = validateWeekStart(queryParams?.weekStart, details);
  const department = String(queryParams?.department || 'BAR').trim().toUpperCase();

  if (!allowedRotaDepartments.includes(department)) {
    details.push(`department must be one of: ${allowedRotaDepartments.join(', ')}`);
  }

  return {
    details,
    filters: {
      department,
      weekStart
    }
  };
};

const listRotaStaff = async (department) => {
  const filterByDepartment = department !== 'ALL';
  const result = await query(
    `
      SELECT
        staff_profiles.id,
        staff_profiles.full_name,
        staff_profiles.primary_role,
        staff_profiles.contract_hours::text AS contract_hours,
        staff_profiles.is_active AS staff_profile_is_active,
        users.is_active AS user_is_active
      FROM staff_profiles
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE staff_profiles.is_active = TRUE
        AND users.is_active = TRUE
        ${filterByDepartment ? 'AND staff_profiles.primary_role = $1' : ''}
      ORDER BY staff_profiles.primary_role ASC, staff_profiles.full_name ASC
    `,
    filterByDepartment ? [department] : []
  );

  return result.rows.map((row) => ({
    contractHours: Number(row.contract_hours),
    fullName: row.full_name,
    id: row.id,
    primaryRole: row.primary_role
  }));
};

const listRotaShifts = async (weekStart, weekEnd, department) => {
  const filterByDepartment = department !== 'ALL';
  const result = await query(
    `
      SELECT
        shifts.id AS shift_id,
        shifts.shift_date::text AS shift_date,
        shifts.start_time::text AS start_time,
        shifts.end_time::text AS end_time,
        shifts.required_role,
        shifts.status,
        shifts.notes,
        shift_assignments.id AS assignment_id,
        shift_assignments.staff_profile_id,
        staff_profiles.full_name
      FROM shifts
      LEFT JOIN shift_assignments
        ON shift_assignments.shift_id = shifts.id
      LEFT JOIN staff_profiles
        ON staff_profiles.id = shift_assignments.staff_profile_id
      WHERE shifts.shift_date BETWEEN $1 AND $2
        AND shifts.status <> 'CANCELLED'
        ${filterByDepartment ? 'AND shifts.required_role = $3' : ''}
      ORDER BY shifts.shift_date ASC, shifts.start_time ASC
    `,
    filterByDepartment ? [weekStart, weekEnd, department] : [weekStart, weekEnd]
  );

  return result.rows;
};

const listApprovedLeaveMarkers = async (weekStart, weekEnd, department) => {
  const filterByDepartment = department !== 'ALL';
  const result = await query(
    `
      SELECT
        leave_requests.id,
        leave_requests.staff_profile_id,
        leave_requests.start_date::text AS start_date,
        leave_requests.end_date::text AS end_date,
        staff_profiles.full_name
      FROM leave_requests
      INNER JOIN staff_profiles
        ON staff_profiles.id = leave_requests.staff_profile_id
      INNER JOIN users
        ON users.id = staff_profiles.user_id
      WHERE leave_requests.status = 'APPROVED'
        AND leave_requests.start_date <= $2::date
        AND leave_requests.end_date >= $1::date
        AND staff_profiles.is_active = TRUE
        AND users.is_active = TRUE
        ${filterByDepartment ? 'AND staff_profiles.primary_role = $3' : ''}
      ORDER BY leave_requests.start_date ASC
    `,
    filterByDepartment ? [weekStart, weekEnd, department] : [weekStart, weekEnd]
  );

  return result.rows;
};

const createEmptyDayCells = (days) => {
  return days.reduce((cellsByDate, day) => {
    cellsByDate[day.date] = [];
    return cellsByDate;
  }, {});
};

const mapShiftCell = (row, authUser) => {
  const isAssigned = Boolean(row.assignment_id);
  const cell = {
    assignmentId: row.assignment_id || null,
    department: row.required_role,
    endTime: row.end_time ? row.end_time.slice(0, 5) : null,
    shiftDate: row.shift_date,
    shiftId: row.shift_id,
    staffName: row.full_name || null,
    staffProfileId: row.staff_profile_id || null,
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    state: isAssigned ? 'ASSIGNED' : 'OPEN'
  };

  if (authUser.role === 'MANAGER') {
    cell.notes = row.notes || null;
    cell.status = row.status;
  }

  return cell;
};

const mapLeaveCell = (leaveMarker, date) => {
  return {
    assignmentId: null,
    department: null,
    endTime: null,
    leaveRequestId: leaveMarker.id,
    shiftDate: date,
    shiftId: null,
    staffName: leaveMarker.full_name,
    staffProfileId: leaveMarker.staff_profile_id,
    startTime: null,
    state: 'APPROVED_LEAVE'
  };
};

const addLeaveMarkersToRows = (staffRows, leaveMarkers, days) => {
  leaveMarkers.forEach((leaveMarker) => {
    const staffRow = staffRows.find((row) => row.staffProfileId === leaveMarker.staff_profile_id);

    if (!staffRow) {
      return;
    }

    days.forEach((day) => {
      if (day.date < leaveMarker.start_date || day.date > leaveMarker.end_date) {
        return;
      }

      const alreadyHasLeave = staffRow.days[day.date].some((cell) => {
        return cell.state === 'APPROVED_LEAVE' && cell.leaveRequestId === leaveMarker.id;
      });

      if (!alreadyHasLeave) {
        staffRow.days[day.date].push(mapLeaveCell(leaveMarker, day.date));
      }
    });
  });
};

const mapSanitizedStaffCell = (cell) => {
  return {
    department: cell.department,
    endTime: cell.endTime,
    shiftDate: cell.shiftDate,
    staffName: cell.staffName,
    startTime: cell.startTime,
    state: cell.state
  };
};

const addShiftCellsToRows = (staffRows, openShiftRows, shiftRows, days, authUser) => {
  shiftRows.forEach((shiftRow) => {
    const cell = mapShiftCell(shiftRow, authUser);

    if (cell.staffProfileId) {
      let staffRow = staffRows.find((row) => row.staffProfileId === cell.staffProfileId);

      if (!staffRow) {
        staffRow = {
          contractHours: null,
          days: createEmptyDayCells(days),
          primaryRole: shiftRow.required_role,
          staffName: shiftRow.full_name,
          staffProfileId: cell.staffProfileId
        };
        staffRows.push(staffRow);
      }

      staffRow.days[shiftRow.shift_date].push(cell);
      return;
    }

    openShiftRows[shiftRow.shift_date].push(cell);
  });
};

const sortCells = (cells) => {
  return cells.sort((left, right) => {
    const leftTime = left.startTime || '99:99';
    const rightTime = right.startTime || '99:99';
    return leftTime.localeCompare(rightTime);
  });
};

const formatRows = (staffRows, openShiftRows, days) => {
  staffRows.forEach((row) => {
    days.forEach((day) => {
      row.days[day.date] = sortCells(row.days[day.date]);
    });
  });

  const openRowHasCells = days.some((day) => openShiftRows[day.date].length > 0);

  if (openRowHasCells) {
    staffRows.push({
      contractHours: null,
      days: days.reduce((cellsByDate, day) => {
        cellsByDate[day.date] = sortCells(openShiftRows[day.date]);
        return cellsByDate;
      }, {}),
      primaryRole: null,
      staffName: 'Open shifts',
      staffProfileId: null,
      systemRow: 'OPEN_SHIFTS'
    });
  }

  return staffRows;
};

const buildSummary = (rows, days) => {
  return rows.reduce(
    (summary, row) => {
      days.forEach((day) => {
        row.days[day.date].forEach((cell) => {
          if (cell.state === 'ASSIGNED') {
            summary.assignedShifts += 1;
          }

          if (cell.state === 'OPEN') {
            summary.openShifts += 1;
          }

          if (cell.state === 'APPROVED_LEAVE') {
            summary.approvedLeave += 1;
          }
        });
      });

      return summary;
    },
    {
      approvedLeave: 0,
      assignedShifts: 0,
      openShifts: 0
    }
  );
};

const sanitizeRowsForStaff = (rows, days) => {
  return rows.map((row) => {
  const sanitizedRow = {
      days: days.reduce((cellsByDate, day) => {
        cellsByDate[day.date] = (row.days[day.date] || []).map((cell) => {
          return mapSanitizedStaffCell(cell);
        });
        return cellsByDate;
      }, {}),
      primaryRole: row.primaryRole,
      staffName: row.staffName,
      staffProfileId: row.staffProfileId
    };

    if (row.systemRow) {
      sanitizedRow.systemRow = row.systemRow;
    }

    return sanitizedRow;
  });
};

const getRota = async (authUser, filters) => {
  const weekEnd = getWeekEnd(filters.weekStart);
  const days = buildWeekDays(filters.weekStart);
  const staff = await listRotaStaff(filters.department);
  const staffRows = staff.map((staffMember) => ({
    contractHours: staffMember.contractHours,
    days: createEmptyDayCells(days),
    primaryRole: staffMember.primaryRole,
    staffName: staffMember.fullName,
    staffProfileId: staffMember.id
  }));
  const openShiftRows = createEmptyDayCells(days);

  const [shiftRows, leaveMarkers] = await Promise.all([
    listRotaShifts(filters.weekStart, weekEnd, filters.department),
    listApprovedLeaveMarkers(filters.weekStart, weekEnd, filters.department)
  ]);

  addShiftCellsToRows(staffRows, openShiftRows, shiftRows, days, authUser);
  addLeaveMarkersToRows(staffRows, leaveMarkers, days);

  const rows = formatRows(staffRows, openShiftRows, days);
  const visibleRows =
    authUser.role === 'STAFF'
      ? sanitizeRowsForStaff(rows, days)
      : rows;

  return {
    days,
    department: filters.department,
    rows: visibleRows,
    summary: buildSummary(visibleRows, days),
    weekEnd,
    weekStart: filters.weekStart
  };
};

module.exports = {
  buildRotaFilters,
  getRota
};
