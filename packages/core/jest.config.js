/** @type {import('jest').Config} */
module.exports = {
  displayName: 'core',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/providers/real/**',
  ],
  coverageThreshold: {
    './src/trading/': { statements: 95, branches: 90, functions: 95, lines: 95 },
    './src/money.ts': { statements: 95, lines: 95 },
  },
};
