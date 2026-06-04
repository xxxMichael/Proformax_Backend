'use strict';

/**
 * clientes.api.test.js
 * Suite de pruebas de API para el modulo de clientes.
 * Tecnologia : Jest + Supertest
 * Capa probada: ClienteController + rutas Express (mock de ClienteService)
 *
 * Estrategia de autenticacion:
 *   Se firma un JWT valido con el secreto de prueba definido en tests/setup.js.
 *   Se mockea prisma.usuario.findUnique para que el middleware authenticate
 *   encuentre al usuario sin necesidad de base de datos.
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const app     = require('../../src/app');

// ── Mocks globales ────────────────────────────────────────────────────────────

jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  http:  jest.fn(),
  debug: jest.fn(),
}));

// Mock del ORM: el middleware authenticate necesita prisma.usuario.findUnique
jest.mock('../../src/config/database', () => ({
  usuario: { findUnique: jest.fn() },
  configuracionEmpresa: { findFirst: jest.fn() },
}));

// Mock del servicio de clientes: aislamos completamente la capa de BD
jest.mock('../../src/services/cliente.service');

const prisma         = require('../../src/config/database');
const clienteService = require('../../src/services/cliente.service');

// ── Helpers de autenticacion ──────────────────────────────────────────────────

const USUARIO_ADMIN = {
  id:       1,
  username: 'admin',
  rol:      'ADMIN',
  estado:   true,
};

const USUARIO_VENDEDOR = {
  id:       2,
  username: 'vendedor01',
  rol:      'vendedor',
  estado:   true,
};

const makeToken = (usuario) =>
  jwt.sign(
    { sub: usuario.id, username: usuario.username, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

const tokenAdmin    = makeToken(USUARIO_ADMIN);
const tokenVendedor = makeToken(USUARIO_VENDEDOR);

// ── Datos de prueba ───────────────────────────────────────────────────────────

const CLIENTE_MOCK = {
  id:                    1,
  identificacion:        '1713175071',
  nombres:               'Juan',
  apellidosRazonSocial:  'Perez Lopez',
  email:                 'juan@example.com',
  telefono:              '0991234567',
  direccion:             'Quito, Ecuador',
};

const LISTA_CLIENTES = {
  data:       [CLIENTE_MOCK],
  total:      1,
  page:       1,
  limit:      20,
  totalPages: 1,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('API /api/v1/clientes', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Por defecto, el middleware de autenticacion valida al admin
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/clientes', () => {

    // CP-CLI-API-001
    test('CP-CLI-API-001: devuelve HTTP 200 y lista paginada para usuario autenticado', async () => {
      clienteService.getAll.mockResolvedValue(LISTA_CLIENTES);

      const res = await request(app)
        .get('/api/v1/clientes')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.headers['x-total-count']).toBe('1');
    });

    // CP-CLI-API-002
    test('CP-CLI-API-002: devuelve HTTP 401 si no se provee token de autenticacion', async () => {
      const res = await request(app).get('/api/v1/clientes');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('MISSING_TOKEN');
    });

    // CP-CLI-API-003
    test('CP-CLI-API-003: reenvía parametros de paginacion al servicio correctamente', async () => {
      clienteService.getAll.mockResolvedValue({ ...LISTA_CLIENTES, page: 2, limit: 5 });

      const res = await request(app)
        .get('/api/v1/clientes?page=2&limit=5&search=Juan')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(clienteService.getAll).toHaveBeenCalledWith({
        page: 2, limit: 5, search: 'Juan',
      });
    });
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/clientes/:id', () => {

    // CP-CLI-API-004
    test('CP-CLI-API-004: devuelve HTTP 200 y el cliente cuando el ID existe', async () => {
      clienteService.getById.mockResolvedValue(CLIENTE_MOCK);

      const res = await request(app)
        .get('/api/v1/clientes/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(1);
    });

    // CP-CLI-API-005
    test('CP-CLI-API-005: devuelve HTTP 422 si el ID no es un entero positivo', async () => {
      const res = await request(app)
        .get('/api/v1/clientes/abc')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(422);
    });

    // CP-CLI-API-006
    test('CP-CLI-API-006: propaga HTTP 404 cuando el servicio lanza NOT_FOUND', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      clienteService.getById.mockRejectedValue(
        new AppError('Cliente no encontrado.', 404, 'NOT_FOUND')
      );

      const res = await request(app)
        .get('/api/v1/clientes/999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/clientes', () => {

    const PAYLOAD_VALIDO = {
      identificacion:       '1713175071',
      nombres:              'Juan',
      apellidosRazonSocial: 'Perez Lopez',
      email:                'juan@example.com',
      telefono:             '0991234567',
    };

    // CP-CLI-API-007
    test('CP-CLI-API-007: devuelve HTTP 201 y el recurso creado con datos validos', async () => {
      clienteService.create.mockResolvedValue({ id: 1, ...PAYLOAD_VALIDO });

      const res = await request(app)
        .post('/api/v1/clientes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
      expect(res.body.message).toBe('Cliente creado exitosamente.');
    });

    // CP-CLI-API-008
    test('CP-CLI-API-008: devuelve HTTP 422 si falta el campo nombres', async () => {
      const { nombres: _, ...sinNombres } = PAYLOAD_VALIDO;

      const res = await request(app)
        .post('/api/v1/clientes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(sinNombres);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    // CP-CLI-API-009
    test('CP-CLI-API-009: devuelve HTTP 422 si el email tiene formato invalido', async () => {
      const res = await request(app)
        .post('/api/v1/clientes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, email: 'email-invalido' });

      expect(res.status).toBe(422);
    });

    // CP-CLI-API-010
    test('CP-CLI-API-010: propaga HTTP 409 cuando la identificacion ya existe', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      clienteService.create.mockRejectedValue(
        new AppError('Identificacion duplicada.', 409, 'DUPLICATE_IDENTIFICACION')
      );

      const res = await request(app)
        .post('/api/v1/clientes')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_IDENTIFICACION');
    });
  });

  // ── PUT /:id ───────────────────────────────────────────────────────────────

  describe('PUT /api/v1/clientes/:id', () => {

    // CP-CLI-API-011
    test('CP-CLI-API-011: devuelve HTTP 200 con el cliente actualizado', async () => {
      const actualizado = { ...CLIENTE_MOCK, nombres: 'Juan Carlos' };
      clienteService.update.mockResolvedValue(actualizado);

      const res = await request(app)
        .put('/api/v1/clientes/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombres: 'Juan Carlos', apellidosRazonSocial: 'Perez Lopez', identificacion: '1713175071' });

      expect(res.status).toBe(200);
      expect(res.body.data.nombres).toBe('Juan Carlos');
    });
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/clientes/:id', () => {

    // CP-CLI-API-012
    test('CP-CLI-API-012: devuelve HTTP 200 con actualizacion parcial correcta', async () => {
      clienteService.patch.mockResolvedValue({ ...CLIENTE_MOCK, telefono: '0999999999' });

      const res = await request(app)
        .patch('/api/v1/clientes/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ telefono: '0999999999' });

      expect(res.status).toBe(200);
      expect(res.body.data.telefono).toBe('0999999999');
    });
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/clientes/:id', () => {

    // CP-CLI-API-013
    test('CP-CLI-API-013: devuelve HTTP 200 cuando el cliente es eliminado exitosamente', async () => {
      clienteService.remove.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/v1/clientes/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    // CP-CLI-API-014
    test('CP-CLI-API-014: devuelve HTTP 403 si el rol no tiene permiso para eliminar', async () => {
      // Usuario sin rol autorizado (no es ADMIN ni vendedor para este endpoint)
      prisma.usuario.findUnique.mockResolvedValue({
        id: 3, username: 'otro', rol: 'OTRO', estado: true,
      });
      const tokenOtro = makeToken({ id: 3, username: 'otro', rol: 'OTRO' });

      const res = await request(app)
        .delete('/api/v1/clientes/1')
        .set('Authorization', `Bearer ${tokenOtro}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
