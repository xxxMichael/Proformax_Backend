/**
 * Rutas de Proformas
 *
 * @swagger
 * tags:
 *   name: Proformas
 *   description: Creación y gestión del ciclo de vida de proformas comerciales
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const proformaController              = require('../controllers/proforma.controller');
const { authenticate, authorize }     = require('../middlewares/auth');
const { validate }                    = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

// ── Validaciones ────────────────────────────────────────────────────────────

const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('ID debe ser un entero positivo.'),
  validate,
];

const createValidation = [
  // clienteId es Int (serial) — no UUID
  body('clienteId')
    .isInt({ gt: 0 }).withMessage('clienteId debe ser un entero positivo.'),
  body('fechaValidez')
    .isISO8601().withMessage('Fecha de vigencia inválida (formato ISO 8601: YYYY-MM-DD).'),
  body('detalles')
    .isArray({ min: 1 }).withMessage('Se requiere al menos un ítem en detalles.'),
  // productoServicioId es Int (serial) — no UUID
  body('detalles.*.productoServicioId')
    .isInt({ gt: 0 }).withMessage('productoServicioId debe ser un entero positivo.'),
  body('detalles.*.cantidad')
    .isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0.'),
  body('detalles.*.precioUnitario')
    .isFloat({ gt: 0 }).withMessage('Precio unitario debe ser mayor a 0.'),
  body('porcentajeDescuento')
    .optional().isFloat({ min: 0, max: 100 }).withMessage('El descuento debe estar entre 0 y 100.'),
  body('observaciones')
    .optional({ nullable: true, checkFalsy: true }).isString(),
  validate,
];

const updateValidation = [
  body('fechaValidez')
    .optional().isISO8601().withMessage('Fecha de vigencia inválida.'),
  body('detalles')
    .optional().isArray({ min: 1 }).withMessage('Se requiere al menos un ítem en detalles.'),
  body('detalles.*.productoServicioId')
    .if(body('detalles').exists())
    .isInt({ gt: 0 }).withMessage('productoServicioId debe ser un entero positivo.'),
  body('detalles.*.cantidad')
    .if(body('detalles').exists())
    .isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0.'),
  body('detalles.*.precioUnitario')
    .if(body('detalles').exists())
    .isFloat({ gt: 0 }).withMessage('Precio unitario debe ser mayor a 0.'),
  body('porcentajeDescuento')
    .optional().isFloat({ min: 0, max: 100 }).withMessage('El descuento debe estar entre 0 y 100.'),
  body('observaciones')
    .optional({ nullable: true, checkFalsy: true }).isString(),
  validate,
];

const statusValidation = [
  body('estado')
    .isIn(['EMITIDA', 'ACEPTADA', 'ANULADA']).withMessage('Estado inválido. Opciones: EMITIDA, ACEPTADA, ANULADA.'),
  body('observaciones')
    .optional({ nullable: true, checkFalsy: true }).isString(),
  validate,
];

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /proformas:
 *   get:
 *     tags: [Proformas]
 *     summary: Listar proformas
 *     description: >
 *       Los vendedores solo ven sus propias proformas.
 *       ADMIN ve todas. Los vendedores solo ven las suyas.
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchParam'
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [EMITIDA, ACEPTADA, ANULADA]
 *         description: Filtrar por estado
 *       - in: query
 *         name: clienteId
 *         schema: { type: integer }
 *         description: Filtrar por cliente
 *       - in: query
 *         name: usuarioId
 *         schema: { type: integer }
 *         description: Filtrar por vendedor (solo ADMIN)
 *     responses:
 *       200:
 *         description: Lista paginada de proformas
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Proforma'
 *                 total:      { type: integer }
 *                 totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', proformaController.getAll);

/**
 * @swagger
 * /proformas/{id}:
 *   get:
 *     tags: [Proformas]
 *     summary: Obtener proforma por ID
 *     description: Devuelve la proforma con sus detalles, cliente y vendedor.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Proforma encontrada con detalle completo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Proforma'
 *                     - type: object
 *                       properties:
 *                         cliente:   { $ref: '#/components/schemas/Cliente' }
 *                         usuario:   { $ref: '#/components/schemas/UsuarioPublico' }
 *                         detalles:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DetalleProformaItem'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, proformaController.getById);

/**
 * @swagger
 * /proformas/{id}/pdf:
 *   get:
 *     tags: [Proformas]
 *     summary: Exportar proforma como PDF
 *     description: >
 *       Genera y descarga la proforma en formato PDF usando Puppeteer.
 *       Los datos de la empresa (RUC, razón social, etc.) se obtienen de
 *       `configuracion_empresa`. El porcentaje de IVA aplicado se toma de
 *       `porcentaje_iva_vigente` al momento de la generación.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Archivo PDF generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/pdf', idParam, proformaController.exportPdf);

/**
 * @swagger
 * /proformas:
 *   post:
 *     tags: [Proformas]
 *     summary: Crear proforma
 *     description: >
 *       Crea una nueva proforma con cálculo automático de totales.
 *
 *       **Lógica de cálculo:**
 *       - `subtotalSinIva` = Σ (cantidad × precioUnitario)
 *       - `totalDescuento` = subtotalSinIva × (porcentajeDescuento / 100)
 *       - `totalIva` = base afecta IVA × (porcentajeIvaVigente / 100)
 *       - `totalFinal` = subtotalSinIva - totalDescuento + totalIva
 *
 *       El porcentaje de IVA se lee automáticamente de `configuracion_empresa`.
 *       Requiere rol **ADMIN** o **vendedor**.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clienteId, fechaValidez, detalles]
 *             properties:
 *               clienteId:
 *                 type: integer
 *                 example: 1
 *               fechaValidez:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-31"
 *               porcentajeDescuento:
 *                 type: number
 *                 example: 5.00
 *                 description: Porcentaje de descuento global (0-100)
 *               observaciones:
 *                 type: string
 *                 nullable: true
 *               detalles:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productoServicioId, cantidad, precioUnitario]
 *                   properties:
 *                     productoServicioId:
 *                       type: integer
 *                       example: 3
 *                     cantidad:
 *                       type: number
 *                       example: 10
 *                     precioUnitario:
 *                       type: number
 *                       example: 45.250000
 *                       description: Precio con hasta 6 decimales
 *     responses:
 *       201:
 *         description: Proforma creada con totales calculados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Proforma'
 *                 message: { type: string }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', authorize('ADMIN', 'vendedor'), createValidation, proformaController.create);

/**
 * @swagger
 * /proformas/{id}:
 *   put:
 *     tags: [Proformas]
 *     summary: Actualizar proforma
 *     description: >
 *       Solo se puede actualizar si la proforma está en estado **EMITIDA**.
 *       Recalcula automáticamente todos los totales.
 *       Requiere rol **ADMIN** o **vendedor**.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fechaValidez:        { type: string, format: date }
 *               porcentajeDescuento: { type: number, minimum: 0, maximum: 100 }
 *               observaciones:       { type: string, nullable: true }
 *               detalles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productoServicioId: { type: integer }
 *                     cantidad:           { type: number }
 *                     precioUnitario:     { type: number }
 *     responses:
 *       200:
 *         description: Proforma actualizada con totales recalculados
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: La proforma no puede modificarse en su estado actual
 *         $ref: '#/components/responses/Conflict'
 */
router.put('/:id', authorize('ADMIN', 'vendedor'), [...idParam, ...updateValidation], proformaController.update);

/**
 * @swagger
 * /proformas/{id}/estado:
 *   patch:
 *     tags: [Proformas]
 *     summary: Cambiar estado de proforma
 *     description: >
 *       Máquina de estados permitida:
 *       - `EMITIDA` → `ACEPTADA`
 *       - `EMITIDA` → `ANULADA`
 *
 *       Una proforma ACEPTADA o ANULADA no puede cambiar de estado.
 *       Requiere rol **ADMIN** o **vendedor**.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [EMITIDA, ACEPTADA, ANULADA]
 *                 example: ACEPTADA
 *               observaciones:
 *                 type: string
 *                 nullable: true
 *                 description: Motivo del cambio de estado (recomendado para ANULADA)
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/Proforma' }
 *                 message: { type: string }
 *       409:
 *         description: Transición de estado no permitida
 *         $ref: '#/components/responses/Conflict'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id/estado', authorize('ADMIN', 'vendedor'), [...idParam, ...statusValidation], proformaController.changeStatus);

module.exports = router;
