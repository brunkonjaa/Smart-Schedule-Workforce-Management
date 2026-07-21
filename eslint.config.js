const globals = require('./backend/node_modules/globals');

const defectRules = {
  eqeqeq: ['error', 'always'],
  'no-case-declarations': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-global-assign': 'error',
  'no-unreachable': 'error',
  'no-undef': 'error',
  'no-unused-vars': [
    'warn',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      caughtErrors: 'none',
      varsIgnorePattern: '^_'
    }
  ]
};

module.exports = [
  {
    ignores: ['**/coverage/**', '**/node_modules/**']
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: 'commonjs'
    },
    rules: defectRules
  },
  {
    files: ['backend/**/*.test.js', 'backend/jest.*.js'],
    languageOptions: {
      globals: globals.jest
    }
  },
  {
    files: ['backend/src/scripts/run-admin-browser-checks.js'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    files: ['frontend/src/**/*.js', 'frontend/public/service-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.serviceworker
      },
      sourceType: 'script'
    },
    rules: defectRules
  }
];
