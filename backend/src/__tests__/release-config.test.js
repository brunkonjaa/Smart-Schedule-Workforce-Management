const { getReleaseCommit } = require('../config/release');

describe('release identification', () => {
  test('returns the exact normalized Render commit SHA', () => {
    expect(getReleaseCommit({
      RENDER_GIT_COMMIT: ' D354E5D5221B13F61F802F570A33AE6C54DF8390 '
    })).toBe('d354e5d5221b13f61f802f570a33ae6c54df8390');
  });

  test.each([
    {},
    { RENDER_GIT_COMMIT: '' },
    { RENDER_GIT_COMMIT: 'main' },
    { RENDER_GIT_COMMIT: '1234567' },
    { RENDER_GIT_COMMIT: 'z'.repeat(40) }
  ])('does not expose a missing or malformed commit value', (environment) => {
    expect(getReleaseCommit(environment)).toBeNull();
  });
});
