'use strict';

/**
 * facturaAzure.test.js
 * Suite de pruebas de integracion para el modulo de facturas de compra.
 * Tecnologia: Jest con mock del SDK de Azure AI Document Intelligence.
 * Capa testeada: Service + Repository (con Azure AI mockeado)
 */

// ── Mock del SDK de Azure AI ───────────────────────────────────────────────────

jest.mock('@azure/ai-form-recognizer', () => ({
  DocumentAnalysisClient: jest.fn().mockImplementation(() => ({
    beginAnalyzeDocument: jest.fn(),
  })),
  AzureKeyCredential: jest.fn(),
}));

jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockClient = {
  beginAnalyzeDocument: jest.fn()
};

jest.mock('../../src/config/azureDocumentAI', () => ({
  getClient: () => mockClient,
  isConfigured: () => true
}));

jest.mock('../../src/config/database', () => ({
  proveedor: {
    findMany:           jest.fn(),
    findUnique:         jest.fn(),
    findFirst:          jest.fn(),
  },
  facturaCompra: {
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    create:     jest.fn(),
  },
  producto: {
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    update:     jest.fn(),
  },
  detalleCompra: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = 'https://mock-endpoint.cognitiveservices.azure.com/';
process.env.AZURE_FORM_RECOGNIZER_API_KEY  = 'mock-api-key-32chars-xxxxxxxxxxxxxxx';

const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const prisma                     = require('../../src/config/database');
const facturaService             = require('../../src/services/facturaCompra.service');

// ── Respuesta simulada de Azure AI ────────────────────────────────────────────

const AZURE_RESPONSE_VALIDA = {
  documents: [
    {
      confidence: 0.95,
      fields: {
        VendorName:    { content: 'Distribuidora Pisos SA', kind: 'string',  value: 'Distribuidora Pisos SA' },
        VendorTaxId:   { content: '1790012345001',          kind: 'string',  value: '1790012345001' },
        InvoiceId:     { content: '001-001-000123456',       kind: 'string',  value: '001-001-000123456' },
        InvoiceDate:   { content: '2026-05-15',              kind: 'date',    value: new Date('2026-05-15') },
        InvoiceTotal:  { content: '$580.00',                 kind: 'currency', value: { amount: 580.00, currencySymbol: '$' } },
        Items: {
          kind: 'array',
          values: [
            {
              properties: {
                Description:  { value: 'Parquet Roble 120x20x1.5cm', kind: 'string' },
                Quantity:     { value: 50,    kind: 'number' },
                ProductCode:  { value: 'PRQ-001', kind: 'string' },
                UnitPrice:    { value: 8.00,  kind: 'currency', content: '$8.00' },
                Amount:       { value: 400.00, kind: 'currency', content: '$400.00' },
              },
            },
            {
              properties: {
                Description:  { value: 'Adhesivo para parquet 5kg', kind: 'string' },
                Quantity:     { value: 10,    kind: 'number' },
                ProductCode:  { value: 'ADH-001', kind: 'string' },
                UnitPrice:    { value: 18.00, kind: 'currency', content: '$18.00' },
                Amount:       { value: 180.00, kind: 'currency', content: '$180.00' },
              },
            },
          ],
        },
      },
    },
  ],
};

const AZURE_RESPONSE_VACIA = { documents: [] };

// ── Proveedor candidato en BD ─────────────────────────────────────────────────

const PROVEEDOR_MOCK = {
  id:             1,
  identificacion: '1790012345001',
  razonSocial:    'Distribuidora Pisos SA',
  nombreComercial:'Pisos SA',
  estado:         true,
};

const PRODUCTOS_MOCK = [
  { id: 10, codigo: 'PRQ-001', nombre: 'Parquet Roble 120x20x1.5cm', stockActual: 200 },
  { id: 11, codigo: 'ADH-001', nombre: 'Adhesivo para parquet 5kg',  stockActual: 30  },
];

// ── Suite: Analisis de documento ──────────────────────────────────────────────

describe('facturaService.analizar - Integracion Azure AI (mock)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Por defecto, findProveedorByIdentificacion (findUnique) devuelve null, y findMany devuelve []
    // para evitar candidatos fantasmas, a menos que el test lo especifique.
    prisma.proveedor.findUnique.mockResolvedValue(null);
    prisma.proveedor.findMany.mockResolvedValue([]);
  });

  // CP-AZ-001
  test('CP-AZ-001: extrae correctamente los campos clave del documento con confianza >= 0.90', async () => {
    const poller = { pollUntilDone: jest.fn().mockResolvedValue(AZURE_RESPONSE_VALIDA) };
    mockClient.beginAnalyzeDocument.mockResolvedValue(poller);

    const fakePdf = Buffer.from('%PDF-1.4 mock content');
    const resultado = await facturaService.analizar(fakePdf);

    expect(resultado).toHaveProperty('datosExtraidos');
    expect(resultado.datosExtraidos.vendorName).toBe('Distribuidora Pisos SA');
    expect(resultado.datosExtraidos.vendorRuc).toBe('1790012345001');
    expect(resultado.datosExtraidos.numeroFactura).toBe('001-001-000123456');
    expect(resultado.datosExtraidos.total).toBe(580.00);
    expect(resultado.datosExtraidos.items).toHaveLength(2);
  });

  // CP-AZ-002
  test('CP-AZ-002: retorna candidatos de proveedor con score 100 cuando el RUC coincide exactamente', async () => {
    const poller = { pollUntilDone: jest.fn().mockResolvedValue(AZURE_RESPONSE_VALIDA) };
    mockClient.beginAnalyzeDocument.mockResolvedValue(poller);
    
    // Para match exacto de RUC, findProveedorByIdentificacion (findUnique) debe retornar el proveedor
    prisma.proveedor.findUnique.mockResolvedValue(PROVEEDOR_MOCK);
    prisma.proveedor.findMany.mockResolvedValue([]); // No retornar candidatos parciales redundantes en findMany

    const fakePdf   = Buffer.from('%PDF-1.4 mock');
    const resultado = await facturaService.analizar(fakePdf);

    expect(resultado.candidatosProveedor).toHaveLength(1);
    expect(resultado.candidatosProveedor[0]._score).toBe(100);
    expect(resultado.candidatosProveedor[0].id).toBe(1);
  });

  // CP-AZ-003
  test('CP-AZ-003: lanza un error descriptivo cuando Azure no detecta ninguna factura', async () => {
    const poller = { pollUntilDone: jest.fn().mockResolvedValue(AZURE_RESPONSE_VACIA) };
    mockClient.beginAnalyzeDocument.mockResolvedValue(poller);

    await expect(
      facturaService.analizar(Buffer.from('imagen invalida'))
    ).rejects.toThrow('Azure AI no detectó ninguna factura en el documento proporcionado.');
  });

  // CP-AZ-004
  test('CP-AZ-004: reporta avisos cuando la confianza de Azure es inferior a 0.80', async () => {
    const respBajaConfianza = {
      documents: [{ ...AZURE_RESPONSE_VALIDA.documents[0], confidence: 0.65 }],
    };
    const poller = { pollUntilDone: jest.fn().mockResolvedValue(respBajaConfianza) };
    mockClient.beginAnalyzeDocument.mockResolvedValue(poller);

    const fakePdf   = Buffer.from('%PDF-1.4 baja calidad');
    const resultado = await facturaService.analizar(fakePdf);

    expect(resultado.avisos).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Confianza de Azure baja'),
      ])
    );
  });
});

// ── Suite: Confirmacion y guardado transaccional ──────────────────────────────

describe('facturaService.confirmar - Guardado transaccional (mock BD)', () => {
  beforeEach(() => jest.clearAllMocks());

  const PAYLOAD_VALIDO = {
    proveedorId:    1,
    numeroFactura:  '001-001-000123456',
    fechaEmision:   '2026-05-15',
    total:          580.00,
    items: [
      { descripcion: 'Parquet Roble 120x20x1.5cm', codigoProducto: 'PRQ-001', cantidad: 50, precioUnitario: 8.00,  totalItem: 400.00 },
      { descripcion: 'Adhesivo para parquet 5kg',  codigoProducto: 'ADH-001', cantidad: 10, precioUnitario: 18.00, totalItem: 180.00 },
    ],
  };

  // CP-AZ-005
  test('CP-AZ-005: guarda la factura y actualiza el stock de productos reconocidos', async () => {
    prisma.proveedor.findUnique.mockResolvedValue(PROVEEDOR_MOCK);
    prisma.facturaCompra.findUnique.mockResolvedValue(null); // No es duplicado
    prisma.producto.findMany.mockResolvedValue(PRODUCTOS_MOCK);
    
    // Mockear findFirst de producto para el matching automático
    prisma.producto.findFirst.mockImplementation(({ where }) => {
      const codigo = where.OR[0]?.codigo?.equals;
      const desc = where.OR[1]?.nombre?.contains;
      const match = PRODUCTOS_MOCK.find(p => 
        (codigo && p.codigo.toLowerCase() === codigo.toLowerCase()) || 
        (desc && p.nombre.toLowerCase().includes(desc.toLowerCase()))
      );
      return Promise.resolve(match || null);
    });

    const FACTURA_CREADA = {
      id:            1,
      numeroFactura: '001-001-000123456',
      total:         580.00,
      proveedorId:   1,
      detalles:      [],
    };

    prisma.$transaction.mockImplementation(async (callback) => {
      const txMock = {
        facturaCompra:  { 
          create: jest.fn().mockResolvedValue(FACTURA_CREADA),
          findUnique: jest.fn().mockResolvedValue({ ...FACTURA_CREADA, proveedor: PROVEEDOR_MOCK, detalles: [] }),
        },
        detalleCompra:  { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        producto:       { update: jest.fn().mockResolvedValue({}) },
      };
      return callback(txMock);
    });

    const resultado = await facturaService.confirmar(PAYLOAD_VALIDO);

    expect(resultado).toHaveProperty('factura');
    expect(resultado).toHaveProperty('itemsReconocidos');
    expect(resultado).toHaveProperty('itemsNoReconocidos');
    expect(resultado.itemsReconocidos).toHaveLength(2);
    expect(resultado.itemsNoReconocidos).toHaveLength(0);
  });

  // CP-AZ-006
  test('CP-AZ-006: lanza AppError 409 si la factura con ese numero ya existe en BD', async () => {
    prisma.proveedor.findUnique.mockResolvedValue(PROVEEDOR_MOCK);
    prisma.facturaCompra.findUnique.mockResolvedValue({ id: 99, numeroFactura: '001-001-000123456' });

    const { AppError } = require('../../src/middlewares/errorHandler');

    await expect(
      facturaService.confirmar(PAYLOAD_VALIDO)
    ).rejects.toThrow(AppError);

    await expect(
      facturaService.confirmar(PAYLOAD_VALIDO)
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
