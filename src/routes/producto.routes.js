/**
 * Rutas de Productos/Inventario
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const prisma     = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const productoRepo = require('../repositories/producto.repository');

const router = Router();
router.use(authenticate);

const createValidation = [
  body('codigo').notEmpty().trim().withMessage('Código requerido.'),
  body('nombre').notEmpty().trim().withMessage('Nombre requerido.'),
  body('precioCompra').isFloat({ gt: 0 }).withMessage('Precio de compra inválido.'),
  body('precioVenta').isFloat({ gt: 0 }).withMessage('Precio de venta inválido.'),
  body('unidadMedida').notEmpty().withMessage('Unidad de medida requerida.'),
  validate,
];

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, categoriaId, activo, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      productoRepo.findAll({ skip, take: parseInt(limit), categoriaId, activo: activo !== undefined ? activo === 'true' : undefined, search }),
      productoRepo.count({ categoriaId, activo: activo !== undefined ? activo === 'true' : undefined, search }),
    ]);
    res.set('X-Total-Count', total);
    return res.status(200).json({ success: true, data, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await productoRepo.findById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN', 'BODEGUERO'), createValidation, async (req, res, next) => {
  try {
    const existente = await productoRepo.findByCodigo(req.body.codigo);
    if (existente) return res.status(409).json({ success: false, message: 'Código de producto ya existe.' });
    const data = await productoRepo.create(req.body);
    return res.status(201).json({ success: true, data, message: 'Producto creado exitosamente.' });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN', 'BODEGUERO'), async (req, res, next) => {
  try {
    const data = await productoRepo.update(req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const data = await productoRepo.softDelete(req.params.id);
    return res.status(200).json({ success: true, data, message: 'Producto desactivado.' });
  } catch (err) { next(err); }
});

// Categorías
router.get('/categorias/all', async (_req, res, next) => {
  try {
    const data = await prisma.categoria.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
