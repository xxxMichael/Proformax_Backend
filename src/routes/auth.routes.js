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

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar recuperación de contraseña
 *     description: >
 *       Envía un correo electrónico con un enlace de recuperación al email registrado.
 *       Por seguridad, siempre responde 200 sin revelar si el email existe.
 *       El enlace expira en **1 hora**.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@ejemplo.com
 *     responses:
 *       200:
 *         description: Correo enviado (si el email está registrado)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/forgot-password',
  [
    body('email')
      .notEmpty().withMessage('El email es requerido.')
      .isEmail().normalizeEmail().withMessage('El email no tiene un formato válido.'),
    validate,
  ],
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Restablecer contraseña
 *     description: >
 *       Establece una nueva contraseña usando el token recibido por correo.
 *       El token es de un solo uso y expira en 1 hora.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token recibido en el correo de recuperación
 *                 example: a3f8c2...
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Nueva contraseña (mínimo 8 caracteres)
 *                 example: NuevaPass123!
 *     responses:
 *       200:
 *         description: Contraseña restablecida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       400:
 *         description: Token inválido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/reset-password',
  [
    body('token')
      .notEmpty().withMessage('El token es requerido.')
      .isHexadecimal().withMessage('El token no es válido.')
      .isLength({ min: 64, max: 64 }).withMessage('El token no tiene el formato esperado.'),
    body('password')
      .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres.'),
    validate,
  ],
  authController.resetPassword
);

module.exports = router;
