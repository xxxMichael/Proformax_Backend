/**
 * swagger.js — Configuración de OpenAPI 3.0 para Proformax API
 * Documentación disponible en /api/docs
 */

'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Proformax API',
      version:     '1.0.0',
      description: 'API REST para el sistema de gestión de proformas de Arte Parquet G&G. ' +
                   'Proporciona endpoints para autenticación, clientes, productos, proveedores, ' +
                   'proformas, facturas con Azure AI y configuración de empresa.',
      contact: {
        name:  'Arte Parquet G&G',
        email: 'info@arteparquet.com',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Token JWT obtenido en POST /auth/login',
        },
      },
      // ── Schemas reutilizables ──────────────────────────────────────────────
      schemas: {

        // ─── Respuestas genéricas ──────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string'  },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: 'Mensaje de error descriptivo.' },
            code:    { type: 'string',  example: 'NOT_FOUND' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 100 },
            page:       { type: 'integer', example: 1   },
            limit:      { type: 'integer', example: 20  },
            totalPages: { type: 'integer', example: 5   },
          },
        },

        // ─── Auth ──────────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'secret123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token:     { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5...' },
                expiresAt: { type: 'string', format: 'date-time' },
                usuario: { $ref: '#/components/schemas/UsuarioPublico' },
              },
            },
          },
        },

        // ─── Usuario ───────────────────────────────────────────────────────
        UsuarioPublico: {
          type: 'object',
          properties: {
            id:            { type: 'integer', example: 1 },
            username:      { type: 'string',  example: 'admin' },
            rol:           { type: 'string',  enum: ['ADMIN', 'vendedor'], example: 'ADMIN' },
            estado:        { type: 'boolean', example: true },
            email:         { type: 'string',  format: 'email', nullable: true, example: 'admin@empresa.com' },
            creadoEn:      { type: 'string',  format: 'date-time' },
            actualizadoEn: { type: 'string',  format: 'date-time' },
          },
        },
        UsuarioCreate: {
          type: 'object',
          required: ['username', 'password', 'rol'],
          properties: {
            username: { type: 'string', example: 'vendedor01' },
            password: { type: 'string', example: 'Passw0rd!' },
            rol:      { type: 'string', enum: ['ADMIN', 'vendedor'] },
            email:    { type: 'string', format: 'email', nullable: true, example: 'vendedor01@empresa.com' },
          },
        },

        // ─── Cliente ───────────────────────────────────────────────────────
        Cliente: {
          type: 'object',
          properties: {
            id:                   { type: 'integer', example: 1 },
            identificacion:       { type: 'string',  example: '0912345678001' },
            nombres:              { type: 'string',  example: 'Juan Carlos' },
            apellidosRazonSocial: { type: 'string',  example: 'Pérez Torres' },
            email:                { type: 'string',  format: 'email', nullable: true },
            telefono:             { type: 'string',  nullable: true, example: '+593 99 999 9999' },
            direccion:            { type: 'string',  nullable: true },
            creadoEn:             { type: 'string',  format: 'date-time' },
            actualizadoEn:        { type: 'string',  format: 'date-time' },
          },
        },
        ClienteCreate: {
          type: 'object',
          required: ['identificacion', 'nombres', 'apellidosRazonSocial'],
          properties: {
            identificacion:       { type: 'string', maxLength: 20, example: '0912345678001' },
            nombres:              { type: 'string', maxLength: 100 },
            apellidosRazonSocial: { type: 'string', maxLength: 150 },
            email:                { type: 'string', format: 'email',  nullable: true },
            telefono:             { type: 'string', maxLength: 20,    nullable: true },
            direccion:            { type: 'string', nullable: true },
          },
        },
        ClienteUpdate: {
          type: 'object',
          properties: {
            identificacion:       { type: 'string', maxLength: 20 },
            nombres:              { type: 'string', maxLength: 100 },
            apellidosRazonSocial: { type: 'string', maxLength: 150 },
            email:                { type: 'string', format: 'email', nullable: true },
            telefono:             { type: 'string', maxLength: 20,   nullable: true },
            direccion:            { type: 'string', nullable: true },
          },
        },

        // ─── Producto ──────────────────────────────────────────────────────
        Producto: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            codigo:      { type: 'string',  example: 'PROD-001' },
            nombre:      { type: 'string',  example: 'Piso de madera roble 90cm' },
            descripcion: { type: 'string',  nullable: true },
            tipo:        { type: 'string',  enum: ['producto', 'servicio', 'material', 'acabado', 'accesorio'] },
            precioBase:  { type: 'number',  format: 'decimal', example: 45.250000, description: '6 decimales' },
            stockActual: { type: 'integer', example: 120 },
            aplicaIva:   { type: 'boolean', example: true },
            estado:      { type: 'boolean', example: true },
          },
        },
        ProductoCreate: {
          type: 'object',
          required: ['codigo', 'nombre', 'tipo', 'precioBase'],
          properties: {
            codigo:      { type: 'string',  maxLength: 50 },
            nombre:      { type: 'string',  maxLength: 150 },
            descripcion: { type: 'string',  nullable: true },
            tipo:        { type: 'string',  enum: ['producto', 'servicio', 'material', 'acabado', 'accesorio'] },
            precioBase:  { type: 'number',  example: 45.25 },
            stockActual: { type: 'integer', default: 0 },
            aplicaIva:   { type: 'boolean', default: true },
            estado:      { type: 'boolean', default: true },
          },
        },

        // ─── Proveedor ─────────────────────────────────────────────────────
        Proveedor: {
          type: 'object',
          properties: {
            id:              { type: 'integer', example: 1 },
            identificacion:  { type: 'string',  example: '0912345678001' },
            razonSocial:     { type: 'string',  example: 'Maderas del Sur S.A.' },
            nombreComercial: { type: 'string',  nullable: true },
            direccion:       { type: 'string',  nullable: true },
            telefono:        { type: 'string',  nullable: true },
            email:           { type: 'string',  format: 'email', nullable: true },
            estado:          { type: 'boolean', example: true },
            creadoEn:        { type: 'string',  format: 'date-time' },
            actualizadoEn:   { type: 'string',  format: 'date-time' },
          },
        },
        ProveedorCreate: {
          type: 'object',
          required: ['identificacion', 'razonSocial'],
          properties: {
            identificacion:  { type: 'string', maxLength: 20 },
            razonSocial:     { type: 'string', maxLength: 150 },
            nombreComercial: { type: 'string', maxLength: 150, nullable: true },
            direccion:       { type: 'string', nullable: true },
            telefono:        { type: 'string', maxLength: 20, nullable: true },
            email:           { type: 'string', format: 'email', nullable: true },
            estado:          { type: 'boolean', default: true },
          },
        },

        // ─── ConfiguracionEmpresa ──────────────────────────────────────────
        ConfigEmpresa: {
          type: 'object',
          properties: {
            id:                   { type: 'integer', example: 1 },
            ruc:                  { type: 'string',  example: '1234567890001' },
            razonSocial:          { type: 'string',  example: 'Arte Parquet G&G' },
            direccion:            { type: 'string',  nullable: true },
            telefono:             { type: 'string',  nullable: true },
            email:                { type: 'string',  format: 'email', nullable: true },
            porcentajeIvaVigente: { type: 'number',  example: 15.00, description: 'Porcentaje IVA vigente (0-100)' },
          },
        },
        ConfigEmpresaUpdate: {
          type: 'object',
          properties: {
            ruc:                  { type: 'string', maxLength: 20 },
            razonSocial:          { type: 'string', maxLength: 150 },
            direccion:            { type: 'string', nullable: true },
            telefono:             { type: 'string', maxLength: 20, nullable: true },
            email:                { type: 'string', format: 'email', nullable: true },
            porcentajeIvaVigente: { type: 'number', minimum: 0, maximum: 100 },
          },
        },

        // ─── Proforma ─────────────────────────────────────────────────────
        DetalleProformaItem: {
          type: 'object',
          properties: {
            id:                 { type: 'integer' },
            productoServicioId: { type: 'integer' },
            cantidad:           { type: 'number',  example: 10 },
            precioUnitario:     { type: 'number',  example: 45.250000, description: '6 decimales' },
            subtotal:           { type: 'number',  example: 452.500000 },
          },
        },
        Proforma: {
          type: 'object',
          properties: {
            id:                  { type: 'integer' },
            numeroProforma:      { type: 'string',  example: 'PRO-2024-00001' },
            clienteId:           { type: 'integer' },
            usuarioId:           { type: 'integer' },
            fechaEmision:        { type: 'string',  format: 'date' },
            fechaValidez:        { type: 'string',  format: 'date' },
            subtotalSinIva:      { type: 'number' },
            porcentajeDescuento: { type: 'number' },
            totalDescuento:      { type: 'number' },
            totalIva:            { type: 'number' },
            totalFinal:          { type: 'number' },
            estado:              { type: 'string',  enum: ['EMITIDA', 'ACEPTADA', 'ANULADA'] },
            observaciones:       { type: 'string',  nullable: true },
            creadoEn:            { type: 'string',  format: 'date-time' },
          },
        },
      },
      // ── Parámetros reutilizables ───────────────────────────────────────────
      parameters: {
        pageParam: {
          in:          'query',
          name:        'page',
          schema:      { type: 'integer', default: 1, minimum: 1 },
          description: 'Número de página',
        },
        limitParam: {
          in:          'query',
          name:        'limit',
          schema:      { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          description: 'Registros por página',
        },
        searchParam: {
          in:          'query',
          name:        'search',
          schema:      { type: 'string'  },
          description: 'Texto de búsqueda',
        },
        idParam: {
          in:       'path',
          name:     'id',
          required: true,
          schema:   { type: 'integer' },
          description: 'ID del recurso',
        },
      },
      // ── Respuestas comunes ─────────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: '401 — Token ausente o inválido',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        Forbidden: {
          description: '403 — Sin permisos para este recurso',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        NotFound: {
          description: '404 — Recurso no encontrado',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        Conflict: {
          description: '409 — Conflicto de unicidad o integridad referencial',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        ValidationError: {
          description: '422 — Error de validación de campos',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Archivos donde buscar anotaciones @swagger / JSDoc
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
