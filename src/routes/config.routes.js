/**
 * Rutas de Configuración de Empresa (IVA, datos corporativos)
 * Administración y Seguridad - Configuración de datos de empresa
 */
'use strict';
const { Router } = require('express');
const prisma     = require('../config/database');
const { authenticate, authorize } = require('../middlewares/auth');
const router = Router();
router.use(authenticate);

// Obtener toda la configuración
router.get('/', async (_req, res, next) => {
  try {
    const data = await prisma.configuracionEmpresa.findMany({ orderBy: { clave: 'asc' } });
    // Convertir array a objeto clave:valor para fácil uso en frontend
    const config = data.reduce((acc, item) => ({ ...acc, [item.clave]: item.valor }), {});
    return res.status(200).json({ success: true, data: config });
  } catch (err) { next(err); }
});

// Actualizar una clave de configuración
router.put('/:clave', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { valor, descripcion } = req.body;
    const data = await prisma.configuracionEmpresa.upsert({
      where:  { clave: req.params.clave },
      update: { valor, ...(descripcion && { descripcion }) },
      create: { clave: req.params.clave, valor, descripcion },
    });
    return res.status(200).json({ success: true, data, message: 'Configuración actualizada.' });
  } catch (err) { next(err); }
});

// Actualización masiva de configuración
router.post('/bulk', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { config } = req.body; // { clave: valor, ... }
    const operations = Object.entries(config).map(([clave, valor]) =>
      prisma.configuracionEmpresa.upsert({
        where:  { clave },
        update: { valor: String(valor) },
        create: { clave, valor: String(valor) },
      })
    );
    await prisma.$transaction(operations);
    return res.status(200).json({ success: true, message: 'Configuración actualizada exitosamente.' });
  } catch (err) { next(err); }
});

module.exports = router;
