/**
 * Rutas de Clientes (CRUD completo)
 *
 * @swagger
 * tags:
 *   name: Clientes
 *   description: Gestión de clientes
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');
const { validarRucEcuatoriano } = require('../utils/rucValidator');

const clienteController               = require('../controllers/cliente.controller');
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
  body('identificacion')
    .trim().notEmpty().withMessage('La identificación es requerida.')
    .isLength({ max: 20 }).withMessage('La identificación no puede superar 20 caracteres.')
    .custom((value) => {
      if (value && value.length === 13) {
        const result = validarRucEcuatoriano(value);
        if (!result.valido) {
          throw new Error(`RUC Inválido: ${result.mensaje}`);
        }
      }
      return true;
    }),
  body('nombres')
    .trim().notEmpty().withMessage('El nombre es requerido.')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres.'),
  body('apellidosRazonSocial')
    .trim().notEmpty().withMessage('Los apellidos / razón social son requeridos.')
    .isLength({ max: 150 }).withMessage('Máximo 150 caracteres.'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('Email inválido.')
    .isLength({ max: 100 }),
  body('telefono')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 20 }),
  body('direccion')
    .optional({ nullable: true, checkFalsy: true })
    .isString(),
  validate,
];

const updateRules = [
  body('identificacion').optional().trim().notEmpty().isLength({ max: 20 })
    .custom((value) => {
      if (value && value.length === 13) {
        const result = validarRucEcuatoriano(value);
        if (!result.valido) {
          throw new Error(`RUC Inválido: ${result.mensaje}`);
        }
      }
      return true;
    }),
  body('nombres').optional().trim().notEmpty().isLength({ max: 100 }),
  body('apellidosRazonSocial').optional().trim().notEmpty().isLength({ max: 150 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('telefono').optional({ nullable: true, checkFalsy: true }).isLength({ max: 20 }),
  validate,
];

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /clientes:
 *   get:
 *     tags: [Clientes]
 *     summary: Listar clientes
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchParam'
 *     responses:
 *       200:
 *         description: Lista paginada de clientes
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 *             description: Total de registros
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
 *                         $ref: '#/components/schemas/Cliente'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', clienteController.getAll);

/**
 * @swagger
 * /clientes/{id}:
 *   get:
 *     tags: [Clientes]
 *     summary: Obtener cliente por ID
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Cliente'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, clienteController.getById);

/**
 * @swagger
 * /clientes:
 *   post:
 *     tags: [Clientes]
 *     summary: Crear cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClienteCreate'
 *     responses:
 *       201:
 *         description: Cliente creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Cliente'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', createRules, clienteController.create);

/**
 * @swagger
 * /clientes/{id}:
 *   put:
 *     tags: [Clientes]
 *     summary: Actualizar cliente (reemplazo completo)
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClienteCreate'
 *     responses:
 *       200:
 *         description: Cliente actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.put('/:id', [...idParam, ...updateRules], clienteController.update);

/**
 * @swagger
 * /clientes/{id}:
 *   patch:
 *     tags: [Clientes]
 *     summary: Actualizar cliente parcialmente
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClienteUpdate'
 *     responses:
 *       200:
 *         description: Cliente actualizado parcialmente
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', [...idParam, ...updateRules], clienteController.patch);

/**
 * @swagger
 * /clientes/{id}:
 *   delete:
 *     tags: [Clientes]
 *     summary: Eliminar cliente
 *     description: Solo si no tiene proformas asociadas. Requiere rol ADMIN o vendedor.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Cliente eliminado
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/:id', authorize('ADMIN', 'vendedor'), idParam, clienteController.remove);

module.exports = router;
