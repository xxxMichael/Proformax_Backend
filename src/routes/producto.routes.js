/**
 * Rutas de Productos / Servicios (tabla: productos_servicios)
 * Sin categorías — modelo plano alineado al schema Prisma real
 *
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión de productos y servicios (inventario)
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const productoController              = require('../controllers/producto.controller');
const { authenticate, authorize }     = require('../middlewares/auth');
const { validate }                    = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

const TIPOS_VALIDOS = ['producto', 'servicio', 'material', 'acabado', 'accesorio'];

// ── Validaciones ────────────────────────────────────────────────────────────

const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('ID debe ser un entero positivo.'),
  validate,
];

const createRules = [
  body('codigo').trim().notEmpty().withMessage('El código es requerido.').isLength({ max: 50 }),
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido.').isLength({ max: 150 }),
  body('descripcion').optional({ nullable: true, checkFalsy: true }).isString(),
  body('tipo').trim().notEmpty().withMessage('El tipo es requerido.')
    .isIn(TIPOS_VALIDOS).withMessage(`Tipo inválido. Opciones: ${TIPOS_VALIDOS.join(', ')}.`),
  body('precioBase').isFloat({ gt: 0 }).withMessage('El precio base debe ser mayor a 0.'),
  body('stockActual').optional().isInt({ min: 0 }),
  body('aplicaIva').optional().isBoolean(),
  body('estado').optional().isBoolean(),
  validate,
];

const updateRules = [
  body('codigo').optional().trim().notEmpty().isLength({ max: 50 }),
  body('nombre').optional().trim().notEmpty().isLength({ max: 150 }),
  body('tipo').optional().isIn(TIPOS_VALIDOS),
  body('precioBase').optional().isFloat({ gt: 0 }),
  body('stockActual').optional().isInt({ min: 0 }),
  body('aplicaIva').optional().isBoolean(),
  body('estado').optional().isBoolean(),
  validate,
];

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /productos:
 *   get:
 *     tags: [Productos]
 *     summary: Listar productos
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchParam'
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [producto, servicio, material, acabado, accesorio]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: estado
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *     responses:
 *       200:
 *         description: Lista paginada de productos
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginationMeta'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Producto'
 */
router.get('/', productoController.getAll);

/**
 * @swagger
 * /productos/{id}:
 *   get:
 *     tags: [Productos]
 *     summary: Obtener producto por ID
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Producto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Producto'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, productoController.getById);

/**
 * @swagger
 * /productos:
 *   post:
 *     tags: [Productos]
 *     summary: Crear producto
 *     description: Requiere rol ADMIN o bodeguero. precioBase acepta hasta 6 decimales.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoCreate'
 *     responses:
 *       201:
 *         description: Producto creado
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authorize('ADMIN', 'bodeguero'), createRules, productoController.create);

/**
 * @swagger
 * /productos/{id}:
 *   put:
 *     tags: [Productos]
 *     summary: Actualizar producto completo
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoCreate'
 *     responses:
 *       200:
 *         description: Producto actualizado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authorize('ADMIN', 'bodeguero'), [...idParam, ...updateRules], productoController.update);

/**
 * @swagger
 * /productos/{id}:
 *   patch:
 *     tags: [Productos]
 *     summary: Actualizar producto parcialmente
 *     description: >
 *       También puede usarse para ajustes manuales de stock.
 *       Pasar solo los campos a modificar.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stockActual: { type: integer }
 *               precioBase:  { type: number }
 *               estado:      { type: boolean }
 *     responses:
 *       200:
 *         description: Producto actualizado parcialmente
 */
router.patch('/:id', authorize('ADMIN', 'bodeguero'), [...idParam, ...updateRules], productoController.patch);

/**
 * @swagger
 * /productos/{id}:
 *   delete:
 *     tags: [Productos]
 *     summary: Desactivar producto (baja lógica)
 *     description: >
 *       No elimina el registro. Cambia `estado` a `false`.
 *       Solo ADMIN puede desactivar productos.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Producto desactivado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authorize('ADMIN'), idParam, productoController.disable);

module.exports = router;
