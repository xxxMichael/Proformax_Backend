/**
 * AuthService - Lógica de negocio de autenticación
 * Gestión de login, tokens JWT y refresh tokens
 */

'use strict';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const usuarioRepo = require('../repositories/usuario.repository');
const prisma  = require('../config/database');
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
const login = async (email, password, ip, userAgent) => {
  const usuario = await usuarioRepo.findByEmail(email);

  if (!usuario || !usuario.activo) {
    throw new AppError('Credenciales incorrectas.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordValido = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordValido) {
    logger.warn(`[Auth] Intento fallido para ${email} desde ${ip}`);
    throw new AppError('Credenciales incorrectas.', 401, 'INVALID_CREDENTIALS');
  }

  const token = generateToken(usuario.id, usuario.rol);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

  // Guardar sesión (auditoría LOPDP)
  await prisma.sesion.create({
    data: {
      usuarioId: usuario.id,
      token,
      ipAddress: ip,
      userAgent,
      expiraEn:  expiresAt,
    },
  });

  await usuarioRepo.updateLastAccess(usuario.id);

  logger.info(`[Auth] Login exitoso: ${email} desde ${ip}`);

  return {
    token,
    expiresAt,
    usuario: {
      id:       usuario.id,
      nombre:   usuario.nombre,
      apellido: usuario.apellido,
      email:    usuario.email,
      rol:      usuario.rol,
    },
  };
};

/**
 * Cierra la sesión invalidando el token
 */
const logout = async (token) => {
  await prisma.sesion.deleteMany({ where: { token } });
};

/**
 * Hashea una contraseña
 */
const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

module.exports = { login, logout, hashPassword, generateToken };
