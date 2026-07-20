module.exports = {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/scripts/**'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 80,
      lines: 70,
      statements: 70
    }
  },
  testEnvironment: 'node'
};
