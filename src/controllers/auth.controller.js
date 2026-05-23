/**
 * AuthController - Controlador de autenticación
 * Gestión de peticiones HTTP para login/logout/perfil/recuperación de contraseña
 */

'use strict';

const authService = require('../services/auth.service');
const logger      = require('../config/logger');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip        = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(username, password, ip, userAgent);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await authService.logout(token);
    return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

/**
 * POST /auth/forgot-password
 * Inicia el flujo de recuperación de contraseña enviando un correo al usuario.
 * Siempre responde 200 por seguridad (no revela si el email existe).
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    return res.status(200).json({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password
 * Restablece la contraseña usando el token recibido por correo.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    return res.status(200).json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, me, forgotPassword, resetPassword };
