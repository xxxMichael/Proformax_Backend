/**
 * Rutas de Facturas de Compra
 * Tabla: facturas_compra + detalles_compra
 *
 * Flujo recomendado (dos pasos):
 *   POST /facturas/analizar    → Paso 1: extrae sin guardar
 *   POST /facturas/confirmar   → Paso 2: guarda con proveedor confirmado
 *
 * @swagger
 * tags:
 *   name: Facturas
 *   description: >
 *     Gestión de facturas de compra con Azure AI Document Intelligence.
 *     Flujo de dos pasos para garantizar asociación correcta de proveedor.
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');
const multer          = require('multer');

const facturaController               = require('../controllers/facturaCompra.controller');
const { authenticate, authorize }     = require('../middlewares/auth');
const { AppError }                    = require('../middlewares/errorHandler');
const { validate }                    = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

// ── Multer: archivos en memoria ──────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (MIME_PERMITIDOS.includes(file.mimetype)) return cb(null, true);
    cb(new AppError(
      `Tipo de archivo no soportado: ${file.mimetype}. Use PDF, JPEG, PNG o TIFF.`,
      400, 'INVALID_FILE_TYPE'
    ));
  },
});

// ── Validaciones ─────────────────────────────────────────────────────────────

const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('ID debe ser un entero positivo.'),
  validate,
];

const confirmarRules = [
  body('proveedorId')
    .isInt({ gt: 0 }).withMessage('proveedorId es requerido y debe ser un entero positivo.'),
  body('numeroFactura')
    .trim().notEmpty().withMessage('numeroFactura es requerido.')
    .isLength({ max: 50 }).withMessage('Máximo 50 caracteres.'),
  body('fechaEmision')
    .isISO8601().withMessage('fechaEmision inválida. Use formato ISO 8601 (YYYY-MM-DD).'),
  body('total')
    .isFloat({ min: 0 }).withMessage('total debe ser un número mayor o igual a 0.'),
  body('items')
    .isArray().withMessage('items debe ser un arreglo (puede estar vacío).'),
  body('items.*.descripcion')
    .optional().isString(),
  body('items.*.cantidad')
    .optional().isFloat({ min: 0 }),
  body('items.*.precioUnitario')
    .optional().isFloat({ min: 0 }),
  body('items.*.totalItem')
    .optional().isFloat({ min: 0 }),
  body('items.*.productoId')
    .optional({ nullable: true }).isInt({ gt: 0 }),
  validate,
];

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /facturas:
 *   get:
 *     tags: [Facturas]
 *     summary: Listar facturas de compra
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: proveedorId
 *         schema: { type: integer }
 *         description: Filtrar por proveedor
 *     responses:
 *       200:
 *         description: Lista paginada de facturas
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:    { type: boolean }
 *                 data:       { type: array, items: { type: object } }
 *                 total:      { type: integer }
 *                 totalPages: { type: integer }
 */
router.get('/', facturaController.getAll);

/**
 * @swagger
 * /facturas/{id}:
 *   get:
 *     tags: [Facturas]
 *     summary: Obtener factura por ID con detalles
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Factura con proveedor y líneas de detalle
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, facturaController.getById);

/**
 * @swagger
 * /facturas/analizar:
 *   post:
 *     tags: [Facturas]
 *     summary: "[Paso 1] Analizar factura con Azure AI (sin guardar)"
 *     description: >
 *       Envía el archivo al modelo **prebuilt-invoice** de Azure AI Document Intelligence.
 *
 *       **Qué devuelve:**
 *       - `datosExtraidos`: todos los campos detectados (proveedor, número, fecha, totales, ítems)
 *       - `candidatosProveedor`: proveedores existentes ordenados por score de coincidencia
 *         - score 100: RUC exacto
 *         - score 70: nombre parcial
 *         - score 40: palabra clave
 *       - `avisos`: advertencias de calidad (confianza baja, campos faltantes, etc.)
 *
 *       **No guarda nada.** Usar `POST /facturas/confirmar` como segundo paso.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [factura]
 *             properties:
 *               factura:
 *                 type: string
 *                 format: binary
 *                 description: PDF, JPEG, PNG o TIFF (máx 10 MB)
 *     responses:
 *       200:
 *         description: Extracción exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 datosExtraidos:
 *                   type: object
 *                   properties:
 *                     vendorName:    { type: string, nullable: true }
 *                     vendorRuc:     { type: string, nullable: true }
 *                     vendorAddress: { type: string, nullable: true }
 *                     numeroFactura: { type: string, nullable: true }
 *                     fechaEmision:  { type: string, format: date-time, nullable: true }
 *                     subtotal:      { type: number }
 *                     totalTax:      { type: number }
 *                     total:         { type: number }
 *                     rawConfidence: { type: number, description: 'Confianza Azure 0-1' }
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           descripcion:    { type: string }
 *                           cantidad:       { type: number }
 *                           codigoProducto: { type: string, nullable: true }
 *                           precioUnitario: { type: number }
 *                           totalItem:      { type: number }
 *                 candidatosProveedor:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:             { type: integer }
 *                       identificacion: { type: string }
 *                       razonSocial:    { type: string }
 *                       _matchTipo:     { type: string }
 *                       _score:         { type: integer }
 *                 avisos:
 *                   type: array
 *                   items: { type: string }
 *       400:
 *         description: Archivo no enviado o tipo no soportado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/analizar',
  authorize('ADMIN', 'bodeguero'),
  upload.single('factura'),
  (req, _res, next) => {
    if (!req.file) return next(new AppError('Se requiere un archivo de factura.', 400, 'MISSING_FILE'));
    next();
  },
  facturaController.analizar,
);

/**
 * @swagger
 * /facturas/confirmar:
 *   post:
 *     tags: [Facturas]
 *     summary: "[Paso 2] Confirmar y guardar factura"
 *     description: >
 *       Guarda definitivamente la factura en `facturas_compra`.
 *       Para cada ítem con match de producto, actualiza `stockActual` automáticamente.
 *
 *       **Campos de cada ítem:**
 *       - `productoId` (opcional): si el usuario ya lo identificó, se usa directo
 *       - Si no, el sistema intenta match automático por `codigoProducto` o `descripcion`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [proveedorId, numeroFactura, fechaEmision, total]
 *             properties:
 *               proveedorId:
 *                 type: integer
 *                 example: 1
 *                 description: ID del proveedor confirmado por el usuario desde candidatosProveedor
 *               numeroFactura:
 *                 type: string
 *                 example: "001-001-000099930"
 *               fechaEmision:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-21"
 *               total:
 *                 type: number
 *                 example: 400.00
 *               items:
 *                 type: array
 *                 description: Ítems devueltos por /analizar (con productoId opcional)
 *                 items:
 *                   type: object
 *                   properties:
 *                     descripcion:    { type: string }
 *                     cantidad:       { type: number }
 *                     codigoProducto: { type: string, nullable: true }
 *                     precioUnitario: { type: number }
 *                     totalItem:      { type: number }
 *                     productoId:     { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Factura guardada con stock actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     factura:            { type: object }
 *                     itemsReconocidos:   { type: array }
 *                     itemsNoReconocidos: { type: array }
 *       404:
 *         description: Proveedor no encontrado
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Factura duplicada
 *         $ref: '#/components/responses/Conflict'
 */
router.post(
  '/confirmar',
  authorize('ADMIN', 'bodeguero'),
  confirmarRules,
  facturaController.confirmar,
);

module.exports = router;
