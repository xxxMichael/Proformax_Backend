/**
 * Rutas de Usuarios (Administración y Seguridad)
 * GET    /api/v1/usuarios
 * GET    /api/v1/usuarios/:id
 * POST   /api/v1/usuarios
 * PUT    /api/v1/usuarios/:id
 * DELETE /api/v1/usuarios/:id
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
  body('nombre').notEmpty().trim().withMessage('Nombre requerido.'),
  body('apellido').notEmpty().trim().withMessage('Apellido requerido.'),
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido.'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres.'),
  body('rol').isIn(['ADMIN', 'VENDEDOR', 'BODEGUERO']).withMessage('Rol inválido.'),
  validate,
];

router.get('/',     authorize('ADMIN'), usuarioController.getAll);
router.get('/:id',  authorize('ADMIN'), usuarioController.getById);
router.post('/',    authorize('ADMIN'), createValidation, usuarioController.create);
router.put('/:id',  authorize('ADMIN'), usuarioController.update);
router.delete('/:id', authorize('ADMIN'), usuarioController.deactivate);

module.exports = router;
