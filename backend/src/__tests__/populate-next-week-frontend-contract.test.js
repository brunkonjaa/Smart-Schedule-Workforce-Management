const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const rotaSource = fs.readFileSync(
  path.join(repositoryRoot, 'frontend/src/services/rota-ui.js'),
  'utf8'
);
const overviewSource = fs.readFileSync(
  path.join(repositoryRoot, 'frontend/src/services/overview-ui.js'),
  'utf8'
);

const getFunctionSection = (startMarker, endMarker) => {
  const startIndex = rotaSource.indexOf(startMarker);
  const endIndex = rotaSource.indexOf(endMarker, startIndex);

  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);

  return rotaSource.slice(startIndex, endIndex);
};

describe('Populate next week frontend contract', () => {
  test('describes population as a reviewable draft instead of autonomous scheduling', () => {
    expect(rotaSource).toContain("className: 'action-button button-primary rota-populate-button'");
    expect(rotaSource).toContain("populateButton.addEventListener('click', actions.generateDraft)");
    expect(rotaSource).toContain('Nothing is saved until approval.');
    expect(overviewSource).toContain('Populate next week creates a draft for review before anything is saved.');
  });

  test('moves the source pattern forward seven days without saving during generation', () => {
    const generateDraft = getFunctionSection('const generateDraft = async () => {', 'const approveDraft = async () => {');

    expect(generateDraft).toContain('collectShiftTemplates(state.rota)');
    expect(generateDraft).toContain('state.weekStart = addDays(sourceWeekStart, 7)');
    expect(generateDraft).toContain('state.draft = buildDraftRota(state, shiftTemplates)');
    expect(generateDraft).not.toContain('apiClient.post(');
  });

  test('keeps role, leave, conflict and weekly limits inside the draft rules', () => {
    const buildDraft = getFunctionSection('const buildDraftRota = (state, shiftTemplates = []) => {', 'const getCellsForDay =');

    expect(buildDraft).toContain('staff.primaryRole === shift.requiredRole');
    expect(buildDraft).toContain("cell.state === 'APPROVED_LEAVE'");
    expect(buildDraft).toContain('!hasConflict');
    expect(buildDraft).toContain('workload.shifts < 5');
    expect(buildDraft).toContain('workload.hours + getCellHours(shift) <= 40');
    expect(buildDraft).toContain("status: 'SUGGESTED'");
  });

  test('saves generated shifts and assignments only through explicit approval', () => {
    const approveDraft = getFunctionSection('const approveDraft = async () => {', 'const openEntryContext = async');

    expect(approveDraft).toContain("apiClient.post('/api/v1/shifts'");
    expect(approveDraft).toContain("apiClient.post('/api/v1/assignments'");
    expect(approveDraft).toContain('approved and saved.');
  });
});
