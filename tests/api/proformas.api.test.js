'use strict';

/**
 * proformas.api.test.js
 * Suite de pruebas de API para el modulo de proformas comerciales.
 * Tecnologia : Jest + Supertest
 * Capa probada: ProformaController + rutas Express (mock de ProformaService)
 *
 * Cubre: listado, detalle, creacion, actualizacion y cambio de estado.
 * La exportacion a PDF (Puppeteer) se excluye de esta suite por su dependencia
 * de un proceso de navegador headless.
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
  usuario:              { findUnique: jest.fn() },
  configuracionEmpresa: { findFirst:  jest.fn() },
}));

jest.mock('../../src/services/proforma.service');

const prisma          = require('../../src/config/database');
const proformaService = require('../../src/services/proforma.service');

// ── Helpers de autenticacion ──────────────────────────────────────────────────

const USUARIO_ADMIN    = { id: 1, username: 'admin',      rol: 'ADMIN',    estado: true };
const USUARIO_VENDEDOR = { id: 2, username: 'vendedor01', rol: 'vendedor', estado: true };

const makeToken = (u) =>
  jwt.sign({ sub: u.id, username: u.username, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: '1h' });

const tokenAdmin    = makeToken(USUARIO_ADMIN);
const tokenVendedor = makeToken(USUARIO_VENDEDOR);

// ── Datos de prueba ───────────────────────────────────────────────────────────

const DETALLE_MOCK = {
  productoServicioId: 1,
  cantidad:           10,
  precioUnitario:     45.50,
  subtotal:           455.00,
  descuento:          0,
  aplicaIva:          true,
};

const PROFORMA_MOCK = {
  id:               1,
  numeroProforma:   'PRF-202606-0001',
  clienteId:        1,
  usuarioId:        1,
  estado:           'EMITIDA',
  fechaEmision:     '2026-06-01T00:00:00.000Z',
  fechaValidez:     '2026-06-30',
  subtotalSinIva:   455.00,
  totalDescuento:   0,
  totalIva:         68.25,
  totalFinal:       523.25,
  observaciones:    null,
  detalles:         [DETALLE_MOCK],
};

const LISTA_PROFORMAS = {
  data:       [PROFORMA_MOCK],
  total:      1,
  page:       1,
  limit:      20,
  totalPages: 1,
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('API /api/v1/proformas', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_ADMIN);
  });

  // ── GET / ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/proformas', () => {

    // CP-PRF-API-001
    test('CP-PRF-API-001: devuelve HTTP 200 y lista paginada de proformas', async () => {
      proformaService.getAll.mockResolvedValue(LISTA_PROFORMAS);

      const res = await request(app)
        .get('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.headers['x-total-count']).toBe('1');
    });

    // CP-PRF-API-002
    test('CP-PRF-API-002: devuelve HTTP 401 sin token de autenticacion', async () => {
      const res = await request(app).get('/api/v1/proformas');
      expect(res.status).toBe(401);
    });

    // CP-PRF-API-003
    test('CP-PRF-API-003: reenvía filtros de estado y clienteId al servicio', async () => {
      proformaService.getAll.mockResolvedValue({ ...LISTA_PROFORMAS, data: [] });

      const res = await request(app)
        .get('/api/v1/proformas?estado=EMITIDA&clienteId=1&page=1&limit=5')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(proformaService.getAll).toHaveBeenCalledWith({
        page: 1, limit: 5, estado: 'EMITIDA', clienteId: '1', usuarioId: undefined, search: undefined,
      });
    });
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/proformas/:id', () => {

    // CP-PRF-API-004
    test('CP-PRF-API-004: devuelve HTTP 200 con la proforma completa solicitada', async () => {
      proformaService.getById.mockResolvedValue(PROFORMA_MOCK);

      const res = await request(app)
        .get('/api/v1/proformas/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.numeroProforma).toBe('PRF-202606-0001');
      expect(res.body.data.estado).toBe('EMITIDA');
    });

    // CP-PRF-API-005
    test('CP-PRF-API-005: devuelve HTTP 422 si el ID no es un entero positivo', async () => {
      const res = await request(app)
        .get('/api/v1/proformas/invalido')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(422);
    });

    // CP-PRF-API-006
    test('CP-PRF-API-006: propaga HTTP 404 cuando la proforma no existe', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      proformaService.getById.mockRejectedValue(
        new AppError('Proforma no encontrada.', 404, 'NOT_FOUND')
      );

      const res = await request(app)
        .get('/api/v1/proformas/999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/proformas', () => {

    const PAYLOAD_VALIDO = {
      clienteId:   1,
      fechaValidez: '2026-06-30',
      detalles: [
        { productoServicioId: 1, cantidad: 10, precioUnitario: 45.50 },
      ],
      porcentajeDescuento: 0,
    };

    // CP-PRF-API-007
    test('CP-PRF-API-007: devuelve HTTP 201 con la proforma creada (rol ADMIN)', async () => {
      proformaService.create.mockResolvedValue(PROFORMA_MOCK);

      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
      expect(res.body.data.numeroProforma).toBe('PRF-202606-0001');
      expect(res.body.message).toBe('Proforma creada exitosamente.');
    });

    // CP-PRF-API-008
    test('CP-PRF-API-008: devuelve HTTP 201 con la proforma creada (rol vendedor)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(USUARIO_VENDEDOR);
      proformaService.create.mockResolvedValue(PROFORMA_MOCK);

      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenVendedor}`)
        .send(PAYLOAD_VALIDO);

      expect(res.status).toBe(201);
    });

    // CP-PRF-API-009
    test('CP-PRF-API-009: devuelve HTTP 422 si detalles es un array vacio', async () => {
      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, detalles: [] });

      expect(res.status).toBe(422);
    });

    // CP-PRF-API-010
    test('CP-PRF-API-010: devuelve HTTP 422 si fechaValidez no es una fecha ISO 8601 valida', async () => {
      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, fechaValidez: 'treinta-de-junio' });

      expect(res.status).toBe(422);
    });

    // CP-PRF-API-011
    test('CP-PRF-API-011: devuelve HTTP 422 si un detalle tiene cantidad menor o igual a 0', async () => {
      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          ...PAYLOAD_VALIDO,
          detalles: [{ productoServicioId: 1, cantidad: 0, precioUnitario: 10 }],
        });

      expect(res.status).toBe(422);
    });

    // CP-PRF-API-012
    test('CP-PRF-API-012: devuelve HTTP 422 si porcentajeDescuento supera 100', async () => {
      const res = await request(app)
        .post('/api/v1/proformas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ ...PAYLOAD_VALIDO, porcentajeDescuento: 110 });

      expect(res.status).toBe(422);
    });
  });

  // ── PUT /:id ───────────────────────────────────────────────────────────────

  describe('PUT /api/v1/proformas/:id', () => {

    // CP-PRF-API-013
    test('CP-PRF-API-013: devuelve HTTP 200 con la proforma actualizada', async () => {
      proformaService.update.mockResolvedValue({ ...PROFORMA_MOCK, observaciones: 'Actualizada' });

      const res = await request(app)
        .put('/api/v1/proformas/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          fechaValidez: '2026-07-31',
          detalles: [{ productoServicioId: 1, cantidad: 5, precioUnitario: 45.50 }],
        });

      expect(res.status).toBe(200);
    });
  });

  // ── PATCH /:id/estado ─────────────────────────────────────────────────────

  describe('PATCH /api/v1/proformas/:id/estado', () => {

    // CP-PRF-API-014
    test('CP-PRF-API-014: devuelve HTTP 200 al aceptar una proforma', async () => {
      proformaService.changeStatus.mockResolvedValue({ ...PROFORMA_MOCK, estado: 'ACEPTADA' });

      const res = await request(app)
        .patch('/api/v1/proformas/1/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'ACEPTADA' });

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('ACEPTADA');
      expect(res.body.message).toContain('ACEPTADA');
    });

    // CP-PRF-API-015
    test('CP-PRF-API-015: devuelve HTTP 200 al anular una proforma con motivo', async () => {
      proformaService.changeStatus.mockResolvedValue({ ...PROFORMA_MOCK, estado: 'ANULADA' });

      const res = await request(app)
        .patch('/api/v1/proformas/1/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'ANULADA', observaciones: 'Solicitud del cliente' });

      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('ANULADA');
    });

    // CP-PRF-API-016
    test('CP-PRF-API-016: devuelve HTTP 422 si el estado enviado no es un valor permitido', async () => {
      const res = await request(app)
        .patch('/api/v1/proformas/1/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'PENDIENTE' });

      expect(res.status).toBe(422);
    });

    // CP-PRF-API-017
    test('CP-PRF-API-017: propaga HTTP 400 cuando la transicion de estado es invalida', async () => {
      const { AppError } = require('../../src/middlewares/errorHandler');
      proformaService.changeStatus.mockRejectedValue(
        new AppError('Transicion invalida.', 400, 'INVALID_TRANSITION')
      );

      const res = await request(app)
        .patch('/api/v1/proformas/1/estado')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ estado: 'ANULADA' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });
  });
});
