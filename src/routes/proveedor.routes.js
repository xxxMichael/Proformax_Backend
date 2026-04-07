/**
 * Rutas de Proveedores
 */
'use strict';
const { Router } = require('express');
const prisma     = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');
const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = search ? { OR: [{ razonSocial: { contains: search, mode: 'insensitive' } }, { ruc: { contains: search } }] } : {};
    const [data, total] = await Promise.all([
      prisma.proveedor.findMany({ where, skip, take: parseInt(limit), orderBy: { razonSocial: 'asc' } }),
      prisma.proveedor.count({ where }),
    ]);
    return res.status(200).json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.proveedor.findUnique({ where: { id: req.params.id } });
    if (!data) return res.status(404).json({ success: false, message: 'Proveedor no encontrado.' });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN', 'BODEGUERO'), async (req, res, next) => {
  try {
    const data = await prisma.proveedor.create({ data: req.body });
    return res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN', 'BODEGUERO'), async (req, res, next) => {
  try {
    const data = await prisma.proveedor.update({ where: { id: req.params.id }, data: req.body });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
