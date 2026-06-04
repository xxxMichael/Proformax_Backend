'use strict';

/**
 * health.api.test.js
 * Suite de pruebas de API para el endpoint de verificacion de estado del sistema.
 * Tecnologia : Jest + Supertest
 * Capa probada: Controlador inline en app.js (GET /api/v1/health)
 */

const request = require('supertest');
const app     = require('../../src/app');

// ── Mock del logger ──────────────────────────────────────────────────────────
jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  http:  jest.fn(),
  debug: jest.fn(),
}));

// ── Suite ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/health', () => {

  // CP-HEALTH-001
  test('CP-HEALTH-001: devuelve HTTP 200 y la estructura de respuesta esperada', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('Proformax API');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
  });

  // CP-HEALTH-002
  test('CP-HEALTH-002: el campo timestamp contiene una fecha ISO 8601 valida', async () => {
    const res = await request(app).get('/api/v1/health');
    const ts  = new Date(res.body.timestamp);
    expect(isNaN(ts.getTime())).toBe(false);
  });

  // CP-HEALTH-003
  test('CP-HEALTH-003: el Content-Type de la respuesta es application/json', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
