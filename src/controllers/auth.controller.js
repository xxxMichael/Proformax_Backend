/**
 * AuthController - Controlador de autenticación
 * Gestión de peticiones HTTP para login/logout/perfil
 */

'use strict';

const authService = require('../services/auth.service');
const logger      = require('../config/logger');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ip        = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ip, userAgent);
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

module.exports = { login, logout, me };
