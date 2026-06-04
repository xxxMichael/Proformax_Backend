'use strict';

/**
 * productos.api.test.js
 * Suite de pruebas de API para el modulo de productos y servicios.
 * Tecnologia : Jest + Supertest
 * Capa probada: ProductoController + rutas Express (mock de ProductoService)
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

jest.mock('../../src/services/producto.service');

const prisma          = require('../../src/config/database');
const productoService = require('../../src/services/producto.service');

// ── Helpers de autenticacion ──────────────────────────────────────────────────

const USUARIO_ADMIN    = { id: 1, username: 'admin',      rol: 'ADMIN',    estado: true };
const USUARIO_VENDEDOR = { id: 2, username: 'vendedor01', rol: 'vendedor', estado: true };

const makeToken = (u) =>
  jwt.sign({ sub: u.id, username: u.username, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

const tokenAdmin    = makeToken(USUARIO_ADMIN);
const tokenVendedor = makeToken(USUARIO_VENDEDOR);

// ── Datos de prueba ───────────────────────────────────────────────────────────

const PRODUCTO_MOCK = {
  id:          1,
  codigo:      'PRD-001',
  nombre:      'Parquet Eucalipto 90x15',
  descripcion: 'Piso de eucalipto para interiores',
  tipo:        'PRODUCTO',
  precioBase:  45.50,
  stockActual: 200,
  aplicaIva:   true,
  estado:      true,
};

const LISTA_PRODUCTOS = {
  data:       [PRODUCTO_MOCK],
  total:      1,
  page:       1,
  limit:      20,
  totalPages: 1,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('API /api/v1/productos', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/productos', () => {

    // CP-PRD-API-001
    test('CP-PRD-API-001: devuelve HTTP 200 y lista paginada de productos', async () => {
      productoService.getAll.mockResolvedValue(LISTA_PRODUCTOS);

      const res = await request(app)
        .get('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.headers['x-total-count']).toBe('1');
    });

    // CP-PRD-API-002
    test('CP-PRD-API-002: devuelve HTTP 401 si no se provee token', async () => {
      const res = await request(app).get('/api/v1/productos');
      expect(res.status).toBe(401);
    });

    // CP-PRD-API-003
    test('CP-PRD-API-003: reenvía parametros de filtrado (tipo, estado) al servicio', async () => {
      productoService.getAll.mockResolvedValue({ ...LISTA_PRODUCTOS, data: [] });

      const res = await request(app)
        .get('/api/v1/productos?tipo=producto&estado=true&page=1&limit=10')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(productoService.getAll).toHaveBeenCalledWith({
        page: 1, limit: 10, search: undefined, tipo: 'producto', estado: 'true',
      });
    });
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/productos/:id', () => {

    // CP-PRD-API-004
    test('CP-PRD-API-004: devuelve HTTP 200 con el producto solicitado', async () => {
      productoService.getById.mockResolvedValue(PRODUCTO_MOCK);

      const res = await request(app)
        .get('/api/v1/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.codigo).toBe('PRD-001');
    });

    // CP-PRD-API-005
    test('CP-PRD-API-005: devuelve HTTP 422 si el ID no es un entero positivo', async () => {
      const res = await request(app)
        .get('/api/v1/productos/cero')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(422);
    });

    // CP-PRD-API-006
    test('CP-PRD-API-006: propaga HTTP 404 cuando el producto no existe', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      productoService.getById.mockRejectedValue(
        new AppError('Producto no encontrado.', 404, 'NOT_FOUND')
      );

      const res = await request(app)
        .get('/api/v1/productos/999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/productos', () => {

    const PAYLOAD_VALIDO = {
      codigo:     'PRD-002',
      nombre:     'Adhesivo Parquet 5kg',
      tipo:       'material',
      precioBase: 18.00,
      aplicaIva:  true,
    };

    // CP-PRD-API-007
    test('CP-PRD-API-007: devuelve HTTP 201 con el producto creado (rol ADMIN)', async () => {
      productoService.create.mockResolvedValue({ id: 2, ...PAYLOAD_VALIDO, tipo: 'MATERIAL' });

      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(2);
      expect(res.body.message).toBe('Producto creado exitosamente.');
    });

    // CP-PRD-API-008
    test('CP-PRD-API-008: devuelve HTTP 201 con el producto creado (rol vendedor)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO_VENDEDOR);
      productoService.create.mockResolvedValue({ id: 3, ...PAYLOAD_VALIDO });

      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenVendedor}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
    });

    // CP-PRD-API-009
    test('CP-PRD-API-009: devuelve HTTP 422 si falta el campo codigo', async () => {
      const { codigo: _, ...sinCodigo } = PAYLOAD_VALIDO;

      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(sinCodigo);

      expect(res.status).toBe(422);
    });

    // CP-PRD-API-010
    test('CP-PRD-API-010: devuelve HTTP 422 si el tipo no es un valor permitido', async () => {
      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, tipo: 'invalido' });

      expect(res.status).toBe(422);
    });

    // CP-PRD-API-011
    test('CP-PRD-API-011: devuelve HTTP 422 si precioBase no es mayor a 0', async () => {
      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, precioBase: -5 });

      expect(res.status).toBe(422);
    });

    // CP-PRD-API-012
    test('CP-PRD-API-012: propaga HTTP 409 cuando el codigo de producto ya existe', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      productoService.create.mockRejectedValue(
        new AppError('Codigo duplicado.', 409, 'DUPLICATE_CODIGO')
      );

      const res = await request(app)
        .post('/api/v1/productos')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(409);
    });
  });

  // ── PUT /:id ───────────────────────────────────────────────────────────────

  describe('PUT /api/v1/productos/:id', () => {

    // CP-PRD-API-013
    test('CP-PRD-API-013: devuelve HTTP 200 con el producto actualizado', async () => {
      productoService.update.mockResolvedValue({ ...PRODUCTO_MOCK, precioBase: 50.00 });

      const res = await request(app)
        .put('/api/v1/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Parquet Eucalipto 90x15', precioBase: 50.00 });

      expect(res.status).toBe(200);
      expect(res.body.data.precioBase).toBe(50.00);
    });
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/productos/:id', () => {

    // CP-PRD-API-014
    test('CP-PRD-API-014: devuelve HTTP 200 actualizando solo el stock', async () => {
      productoService.patch.mockResolvedValue({ ...PRODUCTO_MOCK, stockActual: 350 });

      const res = await request(app)
        .patch('/api/v1/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ stockActual: 350 });

      expect(res.status).toBe(200);
      expect(res.body.data.stockActual).toBe(350);
    });
  });

  // ── DELETE /:id (baja logica) ──────────────────────────────────────────────

  describe('DELETE /api/v1/productos/:id', () => {

    // CP-PRD-API-015
    test('CP-PRD-API-015: devuelve HTTP 200 con el producto desactivado (baja logica)', async () => {
      productoService.disable.mockResolvedValue({ ...PRODUCTO_MOCK, estado: false });

      const res = await request(app)
        .delete('/api/v1/productos/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe(false);
    });
  });
});
