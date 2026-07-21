const {
  getCurrentIsoDate,
  getCurrentWeekStart,
  isMondayDate,
  isPlainObject,
  listUnexpectedFields,
  normalizeText,
  parseIsoDate,
  parseTimeValue
} = require('../services/workflow-service-utils');

describe('shared workflow validation boundaries', () => {
  test('plain-object checks reject missing values and arrays', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject({})).toBe(true);
    expect(listUnexpectedFields(null, ['known'])).toEqual([]);
    expect(listUnexpectedFields({ known: 1, extra: 2 }, ['known'])).toEqual(['extra']);
  });

  test('text normalization handles non-text and repeated whitespace', () => {
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('  rota   note  ')).toBe('rota note');
  });

  test('date and time parsing reject malformed and impossible values', () => {
    expect(parseIsoDate('21/07/2026')).toBeNull();
    expect(parseIsoDate('2026-99-99')).toBeNull();
    expect(parseIsoDate('2026-07-21')).toBe('2026-07-21');
    expect(parseTimeValue('24:00')).toBeNull();
    expect(parseTimeValue('09:30')).toBe('09:30');
  });

  test('Monday checks and current date helpers return ISO dates', () => {
    expect(isMondayDate('not-a-date')).toBe(false);
    expect(isMondayDate('2026-07-20')).toBe(true);
    expect(getCurrentIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getCurrentWeekStart()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isMondayDate(getCurrentWeekStart())).toBe(true);
  });
});
