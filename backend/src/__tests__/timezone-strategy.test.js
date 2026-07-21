const {
  getDateDetails,
  getShiftHours
} = require('../services/assignment-service');

const formatDublinTime = (value) => {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: 'Europe/Dublin'
  }).format(new Date(value));
};

describe('Ireland-local rota time strategy', () => {
  test('Monday boundaries remain date based across both 2026 DST transition weeks', () => {
    expect(getDateDetails('2026-03-29').weekStart).toBe('2026-03-23');
    expect(getDateDetails('2026-03-30').weekStart).toBe('2026-03-30');
    expect(getDateDetails('2026-10-25').weekStart).toBe('2026-10-19');
    expect(getDateDetails('2026-10-26').weekStart).toBe('2026-10-26');
  });

  test('Europe/Dublin display skips and repeats the expected DST hour', () => {
    expect(formatDublinTime('2026-03-29T00:30:00Z')).toBe('00:30');
    expect(formatDublinTime('2026-03-29T01:30:00Z')).toBe('02:30');
    expect(formatDublinTime('2026-10-25T00:30:00Z')).toBe('01:30');
    expect(formatDublinTime('2026-10-25T01:30:00Z')).toBe('01:30');
  });

  test('shift totals use Ireland-local wall-clock values, including overnight shifts', () => {
    expect(getShiftHours({ start_time: '01:00', end_time: '03:00' })).toBe(2);
    expect(getShiftHours({ start_time: '22:00', end_time: '02:00' })).toBe(4);
  });
});
