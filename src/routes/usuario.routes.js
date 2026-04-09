/**
 * Rutas de Usuarios (Administración y Seguridad)
 * GET    /api/v1/usuarios
 * GET    /api/v1/usuarios/:id
 * POST   /api/v1/usuarios
 * PUT    /api/v1/usuarios/:id
 * PATCH  /api/v1/usuarios/:id/estado
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const usuarioController = require('../controllers/usuario.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }   = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

const createValidation = [
  body('username').notEmpty().trim().isLength({ min: 3, max: 50 }).withMessage('Username válido requerido (3-50 caracteres).'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres.'),
  body('rol').isIn(['ADMIN', 'VENDEDOR', 'BODEGUERO']).withMessage('Rol inválido.'),
  validate,
];

const statusValidation = [
  body('estado').isBoolean().withMessage('El campo estado es requerido y debe ser booleano.'),
  validate,
];

router.get('/',     authorize('ADMIN'), usuarioController.getAll);
router.get('/:id',  authorize('ADMIN'), usuarioController.getById);
router.post('/',    authorize('ADMIN'), createValidation, usuarioController.create);
router.put('/:id',  authorize('ADMIN'), usuarioController.update);
router.patch('/:id/estado', authorize('ADMIN'), statusValidation, usuarioController.changeStatus);

module.exports = router;
