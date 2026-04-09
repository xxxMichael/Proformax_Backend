/**
 * AuthService - Lógica de negocio de autenticación
 * Gestión de login stateless con JWT
 */

'use strict';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const usuarioRepo = require('../repositories/usuario.repository');
const logger  = require('../config/logger');
const { AppError } = require('../middlewares/errorHandler');

const SALT_ROUNDS = 12;

/**
 * Genera un token JWT firmado
 */
const generateToken = (userId, rol) =>
  jwt.sign({ sub: userId, rol }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer:    'proformax-api',
  });

/**
 * Autentica a un usuario y retorna tokens
 */
const login = async (username, password, ip, _userAgent) => {
  const usuario = await usuarioRepo.findByUsername(username);

  if (!usuario || !usuario.estado) {
    throw new AppError('Usuario no encontrado o inactivo.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    logger.warn(`[Auth] Intento fallido para ${username} desde ${ip}`);
    throw new AppError('Credenciales incorrectas.', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken(usuario.id, usuario.rol);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  logger.info(`[Auth] Login exitoso: ${username} desde ${ip}`);

  return {
    token,
    expiresAt,
    usuario: {
      id:       usuario.id,
      username: usuario.username,
      rol:      usuario.rol,
      estado:   usuario.estado,
    },
  };
};

/**
 * Logout stateless: el cliente descarta el token.
 */
const logout = async (_token) => {
  return true;
};

/**
 * Hashea una contraseña
 */
const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

module.exports = { login, logout, hashPassword, generateToken };
