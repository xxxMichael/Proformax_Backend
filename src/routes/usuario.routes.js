/**
 * Rutas de Usuarios — Solo ADMIN
 *
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Administración de usuarios del sistema (requiere rol ADMIN)
 */

'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const usuarioController               = require('../controllers/usuario.controller');
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
  body('username')
    .notEmpty().trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username válido requerido (3-50 caracteres).'),
  body('password')
    .isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres.'),
  body('rol')
    .isIn(['ADMIN', 'vendedor']).withMessage('Rol inválido. Opciones: ADMIN, vendedor.'),
  body('email')
    .optional({ nullable: true })
    .isEmail().normalizeEmail().withMessage('El email no tiene un formato válido.'),
  validate,
];

const updateValidation = [
  body('username').optional().trim().isLength({ min: 3, max: 50 }),
  body('password').optional().isLength({ min: 8 }),
  body('rol').optional().isIn(['ADMIN', 'vendedor']),
  body('email')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true; // Permite borrar el email
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }).withMessage('El email no tiene un formato válido.'),
  validate,
];

const statusValidation = [
  body('estado').isBoolean().withMessage('El campo estado es requerido y debe ser booleano.'),
  validate,
];

// ── Endpoints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /usuarios:
 *   get:
 *     tags: [Usuarios]
 *     summary: Listar usuarios
 *     description: Solo ADMIN.
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [ADMIN, vendedor]
 *         description: Filtrar por rol
 *       - in: query
 *         name: estado
 *         schema: { type: boolean }
 *         description: Filtrar por estado activo/inactivo
 *     responses:
 *       200:
 *         description: Lista paginada de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UsuarioPublico'
 *                 total: { type: integer }
 *                 totalPages: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', authorize('ADMIN'), usuarioController.getAll);

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     tags: [Usuarios]
 *     summary: Obtener usuario por ID
 *     description: Solo ADMIN.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/UsuarioPublico'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', authorize('ADMIN'), idParam, usuarioController.getById);

/**
 * @swagger
 * /usuarios:
 *   post:
 *     tags: [Usuarios]
 *     summary: Crear usuario
 *     description: Solo ADMIN. El username se almacena en minúsculas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsuarioCreate'
 *           example:
 *             username: vendedor01
 *             password: Passw0rd!
 *             rol: vendedor
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/UsuarioPublico'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', authorize('ADMIN'), createValidation, usuarioController.create);

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     tags: [Usuarios]
 *     summary: Actualizar datos de usuario
 *     description: Solo ADMIN. No permite cambiar el estado desde este endpoint — usar PATCH /estado.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, minLength: 3, maxLength: 50 }
 *               password: { type: string, minLength: 8 }
 *               rol:
 *                 type: string
 *                 enum: [ADMIN, vendedor]
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', authorize('ADMIN'), [...idParam, ...updateValidation], usuarioController.update);

/**
 * @swagger
 * /usuarios/{id}/estado:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Activar o desactivar usuario
 *     description: Solo ADMIN. Permite bloquear acceso sin eliminar el usuario.
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
 *                 type: boolean
 *                 example: false
 *                 description: true = activo, false = bloqueado
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/UsuarioPublico'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/estado', authorize('ADMIN'), [...idParam, ...statusValidation], usuarioController.changeStatus);

module.exports = router;
