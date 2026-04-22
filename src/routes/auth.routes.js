/**
 * Rutas de Autenticación
 *
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación y gestión de sesión
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const authController   = require('../controllers/auth.controller');
const { validate }     = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: >
 *       Autentica al usuario con username y password.
 *       El username es **case-insensitive** (admin = ADMIN = Admin).
 *       Devuelve un token JWT válido por 8 horas.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/login',
  [
    body('username').notEmpty().trim().withMessage('Username requerido.'),
    body('password').notEmpty().withMessage('Contraseña requerida.'),
    validate,
  ],
  authController.login
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 *     description: Logout stateless — el cliente debe descartar el token.
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil del usuario autenticado
 *     description: Devuelve la información del usuario que emite el token JWT.
 *     responses:
 *       200:
 *         description: Datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/UsuarioPublico'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', authenticate, authController.me);

module.exports = router;
