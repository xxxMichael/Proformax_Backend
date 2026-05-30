/**
 * Middleware de Autenticación JWT
 * Verifica el token Bearer y adjunta el usuario al request
 */

'use strict';

const jwt    = require('jsonwebtoken');
const prisma = require('../config/database');
const { AppError } = require('./errorHandler');

/**
 * Verifica y decodifica el token JWT del header Authorization
 */
const authenticate = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Token de autenticación requerido.', 401, 'MISSING_TOKEN'));
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario aún existe y está activo
    const usuario = await prisma.usuario.findUnique({
      where:  { id: decoded.sub },
      select: { id: true, username: true, rol: true, estado: true },
    });

    if (!usuario || !usuario.estado) {
      return next(new AppError('Usuario no encontrado o inactivo.', 401, 'INVALID_USER'));
    }

    req.user = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware de autorización basado en roles
 * @param {...string} roles - Roles permitidos
 */
const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return next(new AppError('No tienes permisos para esta acción.', 403, 'FORBIDDEN'));
  }
  next();
};

module.exports = { authenticate, authorize };
