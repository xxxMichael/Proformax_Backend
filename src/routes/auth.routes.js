/**
 * Rutas de Autenticación
 * POST /api/v1/auth/login
 * POST /api/v1/auth/logout
 * GET  /api/v1/auth/me
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const authController = require('../controllers/auth.controller');
const { validate }   = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');

const router = Router();

router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email válido requerido.'),
    body('password').notEmpty().withMessage('Contraseña requerida.'),
    validate,
  ],
  authController.login
);

router.post('/logout', authenticate, authController.logout);
router.get('/me',      authenticate, authController.me);

module.exports = router;
