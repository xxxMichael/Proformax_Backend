'use strict';

/**
 * auth.test.js
 * Suite de pruebas de integracion para el modulo de autenticacion.
 * Tecnologia: Jest + Supertest
 * Capa testeada: API REST → POST /api/v1/auth/login
 */

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const app     = require('../../src/app');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/database', () => ({
  usuario: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
  },
  configuracionEmpresa: {
    findFirst: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  http:  jest.fn(),
  debug: jest.fn(),
}));

const prisma = require('../../src/config/database');

// ── Datos de prueba ────────────────────────────────────────────────────────────

const HASH_VALIDO = bcrypt.hashSync('Password123!', 12);

const USUARIO_ADMIN = {
  id:           1,
  username:     'admin',
  passwordHash: HASH_VALIDO,
  rol:          'admin',
  estado:       true,
  email:        'admin@arteParquet.com',
};

const USUARIO_VENDEDOR = {
  id:           2,
  username:     'vendedor01',
  passwordHash: HASH_VALIDO,
  rol:          'vendedor',
  estado:       true,
  email:        'vendedor@arteParquet.com',
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // CP-AUTH-001
  test('CP-AUTH-001: devuelve 200 y un token JWT para credenciales validas (rol admin)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(USUARIO_ADMIN);
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.usuario.rol).toBe('admin');
    expect(res.body.data.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // formato JWT
  });

  // CP-AUTH-002
  test('CP-AUTH-002: devuelve 200 y un token JWT para credenciales validas (rol vendedor)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(USUARIO_VENDEDOR);
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_VENDEDOR);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'vendedor01', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.usuario.rol).toBe('vendedor');
  });

  // CP-AUTH-003
  test('CP-AUTH-003: devuelve 401 cuando la contrasena es incorrecta', async () => {
    prisma.usuario.findFirst.mockResolvedValue(USUARIO_ADMIN);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'ContrasenaMala' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  // CP-AUTH-004
  test('CP-AUTH-004: devuelve 401 cuando el usuario no existe', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'noexiste', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  // CP-AUTH-005
  test('CP-AUTH-005: devuelve 401 cuando el usuario esta desactivado (estado: false)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ ...USUARIO_ADMIN, estado: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  // CP-AUTH-006
  test('CP-AUTH-006: devuelve 422 cuando el campo username esta vacio', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: '', password: 'Password123!' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors[0].field).toBe('username');
  });

  // CP-AUTH-007
  test('CP-AUTH-007: devuelve 422 cuando el campo password esta vacio', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: '' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  // CP-AUTH-008
  test('CP-AUTH-008: el login es case-insensitive para el username', async () => {
    prisma.usuario.findFirst.mockResolvedValue(USUARIO_ADMIN);
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'ADMIN', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── GET /api/v1/auth/me ────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  // CP-AUTH-009
  test('CP-AUTH-009: devuelve 401 si no se provee el token Authorization', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_TOKEN');
  });

  // CP-AUTH-010
  test('CP-AUTH-010: devuelve 401 si el token JWT esta malformado', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});
