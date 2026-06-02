'use strict';

/**
 * proforma.service.test.js
 * Suite de pruebas unitarias para ProformaService.
 * Tecnologia: Jest
 * Capa testeada: Service (calcularTotales, changeStatus, generateNumero)
 */

const { calcularTotales } = require('../../src/services/proforma.service');
const { AppError }        = require('../../src/middlewares/errorHandler');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/database', () => ({
  proforma: {
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
  },
  configuracionEmpresa: {
    findFirst: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/repositories/proforma.repository', () => ({
  findById:     jest.fn(),
  findAll:      jest.fn(),
  count:        jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
  changeStatus: jest.fn(),
}));

const proformaRepo = require('../../src/repositories/proforma.repository');
const prisma       = require('../../src/config/database');
const proformaService = require('../../src/services/proforma.service');

// ── CP-CALC: Calculo de totales con IVA 15% ───────────────────────────────────

describe('calcularTotales - Motor de calculo fiscal (IVA 15%)', () => {
  // CP-CALC-001
  test('CP-CALC-001: calcula correctamente el IVA del 15% sobre un item gravado simple', () => {
    const detalles = [
      { cantidad: 10, precioUnitario: 100.00, aplicaIva: true, descuento: 0 },
    ];
    const resultado = calcularTotales(detalles, 0.15, 0);

    expect(resultado.subtotal).toBe(1000.00);
    expect(resultado.baseIva).toBe(1000.00);
    expect(resultado.valorIva).toBe(150.00);
    expect(resultado.total).toBe(1150.00);
    expect(resultado.descuento).toBe(0);
  });

  // CP-CALC-002
  test('CP-CALC-002: calcula correctamente multiples items gravados', () => {
    const detalles = [
      { cantidad: 5,  precioUnitario: 200.00, aplicaIva: true, descuento: 0 },
      { cantidad: 10, precioUnitario:  50.00, aplicaIva: true, descuento: 0 },
    ];
    const resultado = calcularTotales(detalles, 0.15, 0);

    // Subtotal: 5*200 + 10*50 = 1000 + 500 = 1500
    expect(resultado.subtotal).toBe(1500.00);
    expect(resultado.valorIva).toBe(225.00); // 1500 * 0.15
    expect(resultado.total).toBe(1725.00);
  });

  // CP-CALC-003
  test('CP-CALC-003: no aplica IVA sobre items exentos (aplicaIva: false)', () => {
    const detalles = [
      { cantidad: 10, precioUnitario: 100.00, aplicaIva: false, descuento: 0 },
    ];
    const resultado = calcularTotales(detalles, 0.15, 0);

    expect(resultado.subtotal).toBe(1000.00);
    expect(resultado.baseIva).toBe(0);
    expect(resultado.valorIva).toBe(0);
    expect(resultado.total).toBe(1000.00);
  });

  // CP-CALC-004
  test('CP-CALC-004: calcula correctamente un mix de items gravados y exentos', () => {
    const detalles = [
      { cantidad: 10, precioUnitario: 100.00, aplicaIva: true,  descuento: 0 }, // gravado: 1000
      { cantidad:  5, precioUnitario: 100.00, aplicaIva: false, descuento: 0 }, // exento:   500
    ];
    const resultado = calcularTotales(detalles, 0.15, 0);

    expect(resultado.subtotal).toBe(1500.00);
    expect(resultado.baseIva).toBe(1000.00);
    expect(resultado.valorIva).toBe(150.00);
    expect(resultado.total).toBe(1650.00);
  });

  // CP-CALC-005
  test('CP-CALC-005: aplica descuento global del 10% correctamente sobre items gravados', () => {
    const detalles = [
      { cantidad: 10, precioUnitario: 100.00, aplicaIva: true, descuento: 0 },
    ];
    // Descuento del 10% sobre subtotal de 1000 -> descuento = 100, base = 900
    const resultado = calcularTotales(detalles, 0.15, 10);

    expect(resultado.descuento).toBe(100.00);
    expect(resultado.subtotal).toBe(900.00);
    expect(resultado.baseIva).toBe(900.00);
    expect(resultado.valorIva).toBe(135.00); // 900 * 0.15
    expect(resultado.total).toBe(1035.00);
  });

  // CP-CALC-006
  test('CP-CALC-006: aplica descuento por linea (item descuento) correctamente', () => {
    const detalles = [
      { cantidad: 10, precioUnitario: 100.00, aplicaIva: true, descuento: 5 }, // 5% por linea
    ];
    // Linea = 10 * 100 * (1 - 0.05) = 950
    const resultado = calcularTotales(detalles, 0.15, 0);

    expect(resultado.subtotal).toBe(950.00);
    expect(resultado.valorIva).toBe(142.50); // 950 * 0.15
    expect(resultado.total).toBe(1092.50);
  });

  // CP-CALC-007
  test('CP-CALC-007: retorna ceros para una lista de detalles vacia', () => {
    const resultado = calcularTotales([], 0.15, 0);
    expect(resultado.subtotal).toBe(0);
    expect(resultado.valorIva).toBe(0);
    expect(resultado.total).toBe(0);
  });

  // CP-CALC-008
  test('CP-CALC-008: redondea correctamente a 2 decimales para evitar errores de punto flotante', () => {
    const detalles = [
      { cantidad: 3, precioUnitario: 33.33, aplicaIva: true, descuento: 0 },
    ];
    // 3 * 33.33 = 99.99 (no 99.99000000000001)
    const resultado = calcularTotales(detalles, 0.15, 0);
    expect(resultado.subtotal).toBe(99.99);
    expect(Number.isFinite(resultado.total)).toBe(true);
  });
});

// ── CP-FSM: Maquina de estados de la proforma ─────────────────────────────────

describe('changeStatus - Maquina de estados (FSM)', () => {
  const PROFORMA_EMITIDA = {
    id:            1,
    numeroProforma: 'PRF-202601-0001',
    estado:        'EMITIDA',
    totalFinal:    1150.00,
  };

  beforeEach(() => jest.clearAllMocks());

  // CP-FSM-001
  test('CP-FSM-001: transicion EMITIDA → ACEPTADA es valida', async () => {
    proformaRepo.findById.mockResolvedValue(PROFORMA_EMITIDA);
    proformaRepo.changeStatus.mockResolvedValue({ ...PROFORMA_EMITIDA, estado: 'ACEPTADA' });

    const resultado = await proformaService.changeStatus(1, 'ACEPTADA', 'Cliente confirma');
    expect(resultado.estado).toBe('ACEPTADA');
    expect(proformaRepo.changeStatus).toHaveBeenCalledWith(1, 'ACEPTADA', 'Cliente confirma', 'EMITIDA');
  });

  // CP-FSM-002
  test('CP-FSM-002: transicion EMITIDA → ANULADA es valida', async () => {
    proformaRepo.findById.mockResolvedValue(PROFORMA_EMITIDA);
    proformaRepo.changeStatus.mockResolvedValue({ ...PROFORMA_EMITIDA, estado: 'ANULADA' });

    const resultado = await proformaService.changeStatus(1, 'ANULADA', 'Solicitud del cliente');
    expect(resultado.estado).toBe('ANULADA');
  });

  // CP-FSM-003
  test('CP-FSM-003: la transicion ACEPTADA → ANULADA lanza AppError (estado terminal)', async () => {
    proformaRepo.findById.mockResolvedValue({ ...PROFORMA_EMITIDA, estado: 'ACEPTADA' });

    await expect(
      proformaService.changeStatus(1, 'ANULADA', '')
    ).rejects.toThrow(AppError);

    await expect(
      proformaService.changeStatus(1, 'ANULADA', '')
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TRANSITION' });
  });

  // CP-FSM-004
  test('CP-FSM-004: lanza AppError 404 cuando la proforma no existe', async () => {
    proformaRepo.findById.mockResolvedValue(null);

    await expect(
      proformaService.changeStatus(999, 'ACEPTADA', '')
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});

// ── CP-NUM: Numeracion de proformas ───────────────────────────────────────────

describe('generateNumero - Numeracion secuencial', () => {
  beforeEach(() => jest.clearAllMocks());

  // CP-NUM-001
  test('CP-NUM-001: genera el numero 0001 cuando no existen proformas en el mes actual', async () => {
    prisma.proforma.findFirst.mockResolvedValue(null);
    const numero = await proformaService.generateNumero();
    const now    = new Date();
    const prefix = `PRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

    expect(numero).toBe(`${prefix}0001`);
  });

  // CP-NUM-002
  test('CP-NUM-002: incrementa correctamente el correlativo cuando ya existen proformas', async () => {
    const now    = new Date();
    const prefix = `PRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
    prisma.proforma.findFirst.mockResolvedValue({ numeroProforma: `${prefix}0005` });

    const numero = await proformaService.generateNumero();
    expect(numero).toBe(`${prefix}0006`);
  });
});
