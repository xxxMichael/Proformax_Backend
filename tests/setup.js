'use strict';

/**
 * tests/setup.js
 * Configuracion global de Jest para el backend de Proformax.
 * Se ejecuta antes de cada suite de pruebas.
 */

// Variables de entorno para el entorno de pruebas
process.env.NODE_ENV     = 'test';
process.env.PORT         = '3001';
process.env.JWT_SECRET   = 'test-secret-key-proformax-unit-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SENDGRID_API_KEY = 'SG.test-api-key-mock';
process.env.SENDGRID_FROM    = 'test@arteParquet.com';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.LOG_LEVEL    = 'silent';

// Silenciar el logger de Winston durante los tests
jest.mock('./src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  http:  jest.fn(),
  debug: jest.fn(),
}), { virtual: true });
