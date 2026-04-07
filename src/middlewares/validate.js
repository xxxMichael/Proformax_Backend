/**
 * Middleware de validación con express-validator
 * ISO/IEC 25010 - Protección de datos (LOPDP)
 */

'use strict';

const { validationResult } = require('express-validator');

/**
 * Ejecuta las reglas de validación y devuelve un 422 si hay errores
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      code:    'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos.',
      errors:  errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
        value:   e.value,
      })),
    });
  }
  next();
};

module.exports = { validate };
