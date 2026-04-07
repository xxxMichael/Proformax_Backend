/**
 * Rutas de Clientes
 */
'use strict';
const { Router } = require('express');
const prisma     = require('../config/database');
const { authenticate } = require('../middlewares/auth');
const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = search ? {
      OR: [
        { nombres:   { contains: search, mode: 'insensitive' } },
        { apellidos: { contains: search, mode: 'insensitive' } },
        { ruc:       { contains: search } },
        { cedula:    { contains: search } },
      ],
    } : { activo: true };
    const [data, total] = await Promise.all([
      prisma.cliente.findMany({ where, skip, take: parseInt(limit), orderBy: { nombres: 'asc' } }),
      prisma.cliente.count({ where }),
    ]);
    return res.status(200).json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!data) return res.status(404).json({ success: false, message: 'Cliente no encontrado.' });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = await prisma.cliente.create({ data: req.body });
    return res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = await prisma.cliente.update({ where: { id: req.params.id }, data: req.body });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
