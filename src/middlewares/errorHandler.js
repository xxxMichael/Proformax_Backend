/**
 * Middleware de manejo global de errores
 * ISO/IEC 25010 - Fiabilidad y Mantenibilidad
 */

'use strict';

const logger = require('../config/logger');

/**
 * Clase base para errores operacionales conocidos
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode  = statusCode;
    this.code        = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware de error global para Express
 */
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Error interno del servidor.';
  let code       = err.code       || 'INTERNAL_ERROR';

  // Errores de Prisma conocidos
  if (err.code === 'P2002') {
    statusCode = 409;
    message    = 'Ya existe un registro con ese valor único.';
    code       = 'DUPLICATE_ENTRY';
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message    = 'Registro no encontrado.';
    code       = 'NOT_FOUND';
  }

  // Errores de validación de Express
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message    = 'JSON mal formado en la petición.';
    code       = 'INVALID_JSON';
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Token inválido.';
    code       = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Token expirado.';
    code       = 'EXPIRED_TOKEN';
  }

  // Log de error
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} → ${statusCode}: ${message}`, {
      stack: err.stack,
      body:  req.body,
    });
  } else {
    logger.warn(`[${req.method}] ${req.path} → ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    success:   false,
    code,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
module.exports.AppError = AppError;
