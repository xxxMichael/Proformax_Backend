'use strict';

/**
 * usuarios.api.test.js
 * Suite de pruebas de API para el modulo de usuarios.
 * Tecnologia : Jest + Supertest
 * Capa probada: UsuarioController + rutas Express (mock de UsuarioService)
 *
 * Nota: todos los endpoints de usuarios requieren rol ADMIN.
 * Se verifica tambien el rechazo para rol vendedor (HTTP 403).
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

jest.mock('../../src/config/database', () => ({
  usuario: { findUnique: jest.fn() },
  configuracionEmpresa: { findFirst: jest.fn() },
}));

jest.mock('../../src/services/usuario.service');

const prisma          = require('../../src/config/database');
const usuarioService  = require('../../src/services/usuario.service');

// ── Helpers de autenticacion ──────────────────────────────────────────────────

const USUARIO_ADMIN    = { id: 1, username: 'admin',      rol: 'ADMIN',    estado: true };
const USUARIO_VENDEDOR = { id: 2, username: 'vendedor01', rol: 'vendedor', estado: true };

const makeToken = (u) =>
  jwt.sign({ sub: u.id, username: u.username, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

const tokenAdmin    = makeToken(USUARIO_ADMIN);
const tokenVendedor = makeToken(USUARIO_VENDEDOR);

// ── Datos de prueba ───────────────────────────────────────────────────────────

const USUARIO_PUBLICO = {
  id:       3,
  username: 'vendedor02',
  rol:      'vendedor',
  email:    'vendedor02@arteParquet.com',
  estado:   true,
};

const LISTA_USUARIOS = {
  data:       [USUARIO_PUBLICO],
  total:      1,
  page:       1,
  limit:      20,
  totalPages: 1,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('API /api/v1/usuarios', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/usuarios', () => {

    // CP-USR-API-001
    test('CP-USR-API-001: devuelve HTTP 200 con la lista de usuarios (rol ADMIN)', async () => {
      usuarioService.getAll.mockResolvedValue(LISTA_USUARIOS);

      const res = await request(app)
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    // CP-USR-API-002
    test('CP-USR-API-002: devuelve HTTP 403 si el usuario tiene rol vendedor', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO_VENDEDOR);

      const res = await request(app)
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenVendedor}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    // CP-USR-API-003
    test('CP-USR-API-003: devuelve HTTP 401 sin token de autenticacion', async () => {
      const res = await request(app).get('/api/v1/usuarios');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/usuarios/:id', () => {

    // CP-USR-API-004
    test('CP-USR-API-004: devuelve HTTP 200 con el usuario solicitado (rol ADMIN)', async () => {
      usuarioService.getById.mockResolvedValue(USUARIO_PUBLICO);

      const res = await request(app)
        .get('/api/v1/usuarios/3')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('vendedor02');
    });

    // CP-USR-API-005
    test('CP-USR-API-005: devuelve HTTP 422 si el ID no es un entero positivo', async () => {
      const res = await request(app)
        .get('/api/v1/usuarios/cero')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(422);
    });

    // CP-USR-API-006
    test('CP-USR-API-006: propaga HTTP 404 cuando el usuario no existe', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      usuarioService.getById.mockRejectedValue(
        new AppError('Usuario no encontrado.', 404, 'NOT_FOUND')
      );

      const res = await request(app)
        .get('/api/v1/usuarios/999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/usuarios', () => {

    const PAYLOAD_VALIDO = {
      username: 'nuevovendedor',
      password: 'SecurePass1!',
      rol:      'vendedor',
      email:    'nuevovendedor@arteParquet.com',
    };

    // CP-USR-API-007
    test('CP-USR-API-007: devuelve HTTP 201 con el usuario creado (rol ADMIN)', async () => {
      usuarioService.create.mockResolvedValue({ id: 4, ...PAYLOAD_VALIDO });

      const res = await request(app)
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
      expect(res.body.data.username).toBe('nuevovendedor');
      expect(res.body.message).toBe('Usuario creado exitosamente.');
    });

    // CP-USR-API-008
    test('CP-USR-API-008: devuelve HTTP 403 si el usuario tiene rol vendedor', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO_VENDEDOR);

      const res = await request(app)
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenVendedor}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(403);
    });

    // CP-USR-API-009
    test('CP-USR-API-009: devuelve HTTP 422 si la contrasena tiene menos de 8 caracteres', async () => {
      const res = await request(app)
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, password: 'corta' });

      expect(res.status).toBe(422);
    });

    // CP-USR-API-010
    test('CP-USR-API-010: devuelve HTTP 422 si el rol es invalido', async () => {
      const res = await request(app)
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, rol: 'superusuario' });

      expect(res.status).toBe(422);
    });

    // CP-USR-API-011
    test('CP-USR-API-011: propaga HTTP 409 cuando el username ya esta en uso', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      usuarioService.create.mockRejectedValue(
        new AppError('Username en uso.', 409, 'DUPLICATE_USERNAME')
      );

      const res = await request(app)
        .post('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(409);
    });
  });

  // ── PUT /:id ───────────────────────────────────────────────────────────────

  describe('PUT /api/v1/usuarios/:id', () => {

    // CP-USR-API-012
    test('CP-USR-API-012: devuelve HTTP 200 con el usuario actualizado', async () => {
      usuarioService.update.mockResolvedValue({ ...USUARIO_PUBLICO, email: 'nuevo@arteParquet.com' });

      const res = await request(app)
        .put('/api/v1/usuarios/3')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: 'nuevo@arteParquet.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('nuevo@arteParquet.com');
    });
  });

  // ── PATCH /:id/estado ─────────────────────────────────────────────────────

  describe('PATCH /api/v1/usuarios/:id/estado', () => {

    // CP-USR-API-013
    test('CP-USR-API-013: devuelve HTTP 200 al desactivar un usuario', async () => {
      usuarioService.changeStatus.mockResolvedValue({ ...USUARIO_PUBLICO, estado: false });

      const res = await request(app)
        .patch('/api/v1/usuarios/3/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: false });

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe(false);
      expect(res.body.message).toBe('Usuario desactivado.');
    });

    // CP-USR-API-014
    test('CP-USR-API-014: devuelve HTTP 422 si el campo estado no es booleano', async () => {
      const res = await request(app)
        .patch('/api/v1/usuarios/3/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'activo' });

      expect(res.status).toBe(422);
    });
  });
});
