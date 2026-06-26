const allowedWorkRoles = ['FLOOR', 'BAR', 'KITCHEN', 'OTHER'];

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const listUnexpectedFields = (payload, allowedFields) => {
  if (!isPlainObject(payload)) {
    return [];
  }

  return Object.keys(payload).filter((fieldName) => {
    return !allowedFields.includes(fieldName);
  });
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ');
};

const parseIsoDate = (value) => {
  const normalizedValue = String(value || '').trim();

  if (!isoDatePattern.test(normalizedValue)) {
    return null;
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return normalizedValue;
};

const parseTimeValue = (value) => {
  const normalizedValue = String(value || '').trim();

  if (!timePattern.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
};

const compareTimes = (leftTime, rightTime) => {
  return leftTime.localeCompare(rightTime);
};

const isMondayDate = (dateValue) => {
  const parsedDate = parseIsoDate(dateValue);

  if (!parsedDate) {
    return false;
  }

  const weekday = new Date(`${parsedDate}T00:00:00Z`).getUTCDay();
  return weekday === 1;
};

const getCurrentIsoDate = () => {
  const currentDate = new Date();
  const year = currentDate.getUTCFullYear();
  const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCurrentWeekStart = () => {
  const currentDate = new Date();
  const weekday = currentDate.getUTCDay() || 7;
  currentDate.setUTCDate(currentDate.getUTCDate() - (weekday - 1));

  const year = currentDate.getUTCFullYear();
  const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

module.exports = {
  allowedWorkRoles,
  compareTimes,
  getCurrentIsoDate,
  getCurrentWeekStart,
  isMondayDate,
  isPlainObject,
  listUnexpectedFields,
  normalizeText,
  parseIsoDate,
  parseTimeValue
};
