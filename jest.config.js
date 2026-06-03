// jest.config.js
// Configuracion de Jest para el backend de Proformax

'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment:   'node',
  testMatch:         ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/bootstrap.js',
    '!src/config/swagger.js',
  ],
  coverageDirectory:  'coverage',
  coverageReporters:  ['text', 'lcov', 'html'],
  coverageThresholds: {
    global: {
      branches:  70,
      functions: 75,
      lines:     75,
      statements: 75,
    },
  },
  setupFiles: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose:     true,
};
