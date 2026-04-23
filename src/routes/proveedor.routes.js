/**
 * Rutas de Proveedores (CRUD completo)
 * Tabla real: proveedores
 *
 * @swagger
 * tags:
 *   name: Proveedores
 *   description: Gestión de proveedores
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const proveedorController             = require('../controllers/proveedor.controller');
const { authenticate, authorize }     = require('../middlewares/auth');
const { validate }                    = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

// ── Validaciones ────────────────────────────────────────────────────────────

const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('ID debe ser un entero positivo.'),
  validate,
];

const createRules = [
  body('identificacion').trim().notEmpty().withMessage('La identificación (RUC/cédula) es requerida.').isLength({ max: 20 }),
  body('razonSocial').trim().notEmpty().withMessage('La razón social es requerida.').isLength({ max: 150 }),
  body('nombreComercial').optional({ nullable: true, checkFalsy: true }).isLength({ max: 150 }),
  body('direccion').optional({ nullable: true, checkFalsy: true }).isString(),
  body('telefono').optional({ nullable: true, checkFalsy: true }).isLength({ max: 20 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().isLength({ max: 100 }),
  body('estado').optional().isBoolean(),
  validate,
];

const updateRules = [
  body('identificacion').optional().trim().notEmpty().isLength({ max: 20 }),
  body('razonSocial').optional().trim().notEmpty().isLength({ max: 150 }),
  body('nombreComercial').optional({ nullable: true, checkFalsy: true }).isLength({ max: 150 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('telefono').optional({ nullable: true, checkFalsy: true }).isLength({ max: 20 }),
  body('estado').optional().isBoolean(),
  validate,
];

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /proveedores:
 *   get:
 *     tags: [Proveedores]
 *     summary: Listar proveedores
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchParam'
 *       - in: query
 *         name: estado
 *         schema: { type: boolean }
 *         description: Filtrar por activos (true) o inactivos (false)
 *     responses:
 *       200:
 *         description: Lista paginada de proveedores
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
 *                         $ref: '#/components/schemas/Proveedor'
 */
router.get('/', proveedorController.getAll);

/**
 * @swagger
 * /proveedores/{id}:
 *   get:
 *     tags: [Proveedores]
 *     summary: Obtener proveedor por ID
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Proveedor encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Proveedor'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, proveedorController.getById);

/**
 * @swagger
 * /proveedores:
 *   post:
 *     tags: [Proveedores]
 *     summary: Crear proveedor
 *     description: Requiere rol ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorCreate'
 *     responses:
 *       201:
 *         description: Proveedor creado
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', authorize('ADMIN'), createRules, proveedorController.create);

/**
 * @swagger
 * /proveedores/{id}:
 *   put:
 *     tags: [Proveedores]
 *     summary: Actualizar proveedor completo
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorCreate'
 *     responses:
 *       200:
 *         description: Proveedor actualizado
 */
router.put('/:id', authorize('ADMIN'), [...idParam, ...updateRules], proveedorController.update);

/**
 * @swagger
 * /proveedores/{id}:
 *   patch:
 *     tags: [Proveedores]
 *     summary: Actualizar proveedor parcialmente
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               razonSocial:     { type: string }
 *               nombreComercial: { type: string }
 *               email:           { type: string }
 *               telefono:        { type: string }
 *               estado:          { type: boolean }
 *     responses:
 *       200:
 *         description: Proveedor actualizado parcialmente
 */
router.patch('/:id', authorize('ADMIN'), [...idParam, ...updateRules], proveedorController.patch);

/**
 * @swagger
 * /proveedores/{id}:
 *   delete:
 *     tags: [Proveedores]
 *     summary: Desactivar proveedor (baja lógica)
 *     description: Solo ADMIN. Cambia estado a false, no elimina el registro.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Proveedor desactivado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/:id', authorize('ADMIN'), idParam, proveedorController.disable);

module.exports = router;
