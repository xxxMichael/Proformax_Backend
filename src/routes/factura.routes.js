/**
 * Rutas de Facturas - Integración con Azure AI Document Intelligence
 * POST /api/v1/facturas/procesar - Procesa una factura con Azure AI
 * GET  /api/v1/facturas          - Lista facturas procesadas
 * GET  /api/v1/facturas/:id      - Obtiene detalle de factura
 */
'use strict';

const { Router } = require('express');
const multer     = require('multer');
const prisma     = require('../config/database');
const { analyzeInvoice } = require('../config/azureDocumentAI');
const { authenticate, authorize } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');
const logger       = require('../config/logger');

const router = Router();
router.use(authenticate);

// Configurar multer para memoria (sin guardar en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Tipo de archivo no soportado. Use PDF, JPEG, PNG o TIFF.', 400, 'INVALID_FILE_TYPE'));
  },
});

// Procesar factura con Azure AI
router.post('/procesar', authorize('ADMIN', 'BODEGUERO'), upload.single('factura'), async (req, res, next) => {
  try {
    if (!req.file && !req.body.url) throw new AppError('Se requiere un archivo o URL de factura.', 400, 'MISSING_FILE');

    const source = req.file ? req.file.buffer : req.body.url;
    const datosExtraidos = await analyzeInvoice(source);

    // Guardar en BD
    const factura = await prisma.factura.create({
      data: {
        numeroFactura:  datosExtraidos.invoiceId,
        fechaEmision:   datosExtraidos.invoiceDate ? new Date(datosExtraidos.invoiceDate) : null,
        subtotal:       datosExtraidos.subtotal,
        iva:            datosExtraidos.totalTax,
        total:          datosExtraidos.total,
        procesadoAzure: true,
        datosExtraidos,
      },
    });

    logger.info(`[Azure] Factura procesada: ${datosExtraidos.invoiceId} | Total: ${datosExtraidos.total}`);
    return res.status(201).json({ success: true, data: factura, message: 'Factura procesada con Azure AI.' });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      prisma.factura.findMany({ skip, take: parseInt(limit), orderBy: { creadoEn: 'desc' }, include: { proveedor: { select: { id: true, razonSocial: true } } } }),
      prisma.factura.count(),
    ]);
    return res.status(200).json({ success: true, data, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await prisma.factura.findUnique({ where: { id: req.params.id }, include: { proveedor: true } });
    if (!data) return res.status(404).json({ success: false, message: 'Factura no encontrada.' });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
