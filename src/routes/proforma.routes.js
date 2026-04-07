/**
 * Rutas de Proformas
 * GET    /api/v1/proformas
 * GET    /api/v1/proformas/:id
 * POST   /api/v1/proformas
 * PUT    /api/v1/proformas/:id
 * PATCH  /api/v1/proformas/:id/estado
 * GET    /api/v1/proformas/:id/pdf
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const proformaController = require('../controllers/proforma.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

const createValidation = [
  body('clienteId').isUUID().withMessage('clienteId inválido.'),
  body('fechaVigencia').isISO8601().withMessage('Fecha de vigencia inválida.'),
  body('detalles').isArray({ min: 1 }).withMessage('Se requiere al menos un ítem.'),
  body('detalles.*.productoId').isUUID().withMessage('productoId inválido.'),
  body('detalles.*.cantidad').isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0.'),
  body('detalles.*.precioUnitario').isFloat({ gt: 0 }).withMessage('Precio unitario debe ser mayor a 0.'),
  body('detalles.*.descripcion').notEmpty().withMessage('Descripción del ítem requerida.'),
  validate,
];

const statusValidation = [
  body('estado').isIn(['EMITIDA', 'ACEPTADA', 'RECHAZADA', 'EXPIRADA']).withMessage('Estado inválido.'),
  validate,
];

router.get('/',             proformaController.getAll);
router.get('/:id',          proformaController.getById);
router.get('/:id/pdf',      proformaController.exportPdf);
router.post('/',            authorize('ADMIN', 'VENDEDOR'), createValidation, proformaController.create);
router.put('/:id',          authorize('ADMIN', 'VENDEDOR'), proformaController.update);
router.patch('/:id/estado', authorize('ADMIN', 'VENDEDOR'), statusValidation, proformaController.changeStatus);

module.exports = router;
