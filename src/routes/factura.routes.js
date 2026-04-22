/**
 * Rutas de Facturas de Compra — Integración Azure AI Document Intelligence
 * Tabla real: facturas_compra + detalles_compra
 *
 * Flujo de dos pasos para procesamiento confiable:
 *   1. POST /facturas/analizar  → extrae datos con Azure AI (NO guarda nada)
 *                                  devuelve datos extraídos + candidatos de proveedor
 *   2. POST /facturas/confirmar → usuario confirma el proveedorId correcto y guarda
 *
 * @swagger
 * tags:
 *   name: Facturas
 *   description: >
 *     Gestión de facturas de compra a proveedores con Azure AI Document Intelligence.
 *     Flujo recomendado: **analizar** primero para revisar datos y luego **confirmar** para guardar.
 */

'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const multer = require('multer');

const prisma             = require('../config/database');
const { analyzeInvoice } = require('../config/azureDocumentAI');
const { authenticate, authorize } = require('../middlewares/auth');
const { AppError }       = require('../middlewares/errorHandler');
const { validate }       = require('../middlewares/validate');
const logger             = require('../config/logger');

const router = Router();
router.use(authenticate);

// ── Multer: archivos en memoria (PDF / imágenes) ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Tipo de archivo no soportado. Use PDF, JPEG, PNG o TIFF.', 400, 'INVALID_FILE_TYPE'));
  },
});

const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('ID debe ser un entero positivo.'),
  validate,
];

// ── Helper: buscar candidatos de proveedor por texto ─────────────────────────

/**
 * Dado un identificacion y/o un nombre del vendedor extraído por Azure,
 * devuelve los mejores candidatos de proveedor existentes en BD.
 * También devuelve los datos crudos de Azure para que el usuario pueda decidir.
 */
const buscarCandidatosProveedor = async (identificacion, nombre) => {
  const candidatos = [];

  // 1. Match exacto por identificación (RUC/cédula)
  if (identificacion) {
    const exact = await prisma.proveedor.findUnique({
      where: { identificacion },
    });
    if (exact) candidatos.push({ ...exact, _matchTipo: 'identificacion_exacta', _score: 100 });
  }

  // 2. Match parcial por nombre/razón social (top 5)
  if (nombre && nombre.length >= 2) {
    const porNombre = await prisma.proveedor.findMany({
      where: {
        razonSocial: { contains: nombre, mode: 'insensitive' },
        id: { notIn: candidatos.map((c) => c.id) }, // ya encontrados
      },
      take: 5,
      orderBy: { razonSocial: 'asc' },
    });
    porNombre.forEach((p) => candidatos.push({ ...p, _matchTipo: 'nombre_parcial', _score: 70 }));
  }

  // 3. Match por palabras individuales del nombre (ampliar búsqueda)
  if (nombre && candidatos.length < 3) {
    const palabras = nombre.split(/\s+/).filter((p) => p.length >= 3);
    for (const palabra of palabras) {
      const porPalabra = await prisma.proveedor.findMany({
        where: {
          OR: [
            { razonSocial:    { contains: palabra, mode: 'insensitive' } },
            { nombreComercial:{ contains: palabra, mode: 'insensitive' } },
          ],
          id: { notIn: candidatos.map((c) => c.id) },
        },
        take: 3,
        orderBy: { razonSocial: 'asc' },
      });
      porPalabra.forEach((p) => candidatos.push({ ...p, _matchTipo: 'palabra_clave', _score: 40 }));
    }
  }

  // Ordenar por score descendente y quitar duplicados
  const vistos = new Set();
  return candidatos
    .filter((c) => { if (vistos.has(c.id)) return false; vistos.add(c.id); return true; })
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /facturas:
 *   get:
 *     tags: [Facturas]
 *     summary: Listar facturas de compra
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: proveedorId
 *         schema: { type: integer }
 *         description: Filtrar por proveedor
 *     responses:
 *       200:
 *         description: Lista paginada de facturas de compra
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { type: array, items: { type: object } }
 *                 total:   { type: integer }
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, proveedorId } = req.query;
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const where = proveedorId ? { proveedorId: parseInt(proveedorId) } : {};

    const [data, total] = await Promise.all([
      prisma.facturaCompra.findMany({
        where,
        skip,
        take:    parseInt(limit),
        orderBy: { creadoEn: 'desc' },
        include: {
          proveedor: { select: { id: true, razonSocial: true, identificacion: true } },
        },
      }),
      prisma.facturaCompra.count({ where }),
    ]);

    return res.status(200).json({
      success: true, data, total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /facturas/{id}:
 *   get:
 *     tags: [Facturas]
 *     summary: Obtener factura de compra por ID
 *     description: Devuelve la factura con sus detalles (ítems y productos) y proveedor.
 *     parameters:
 *       - $ref: '#/components/parameters/idParam'
 *     responses:
 *       200:
 *         description: Factura encontrada con detalles
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, async (req, res, next) => {
  try {
    const data = await prisma.facturaCompra.findUnique({
      where:   { id: parseInt(req.params.id) },
      include: {
        proveedor: true,
        detalles:  { include: { producto: true } },
      },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Factura no encontrada.' });
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1: ANALIZAR (extrae con Azure AI, NO guarda nada)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /facturas/analizar:
 *   post:
 *     tags: [Facturas]
 *     summary: "[PASO 1] Analizar factura con Azure AI (sin guardar)"
 *     description: >
 *       **Primer paso del flujo de dos pasos.**
 *
 *       Envía el archivo al Azure AI Document Intelligence y devuelve:
 *       - Los datos extraídos (número, fecha, proveedor, ítems, totales)
 *       - Lista de **candidatos de proveedor** ordenados por probabilidad de match
 *
 *       **No guarda nada en la base de datos.**
 *       Usa la respuesta para revisar los datos y luego llama a `POST /facturas/confirmar`.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [factura]
 *             properties:
 *               factura:
 *                 type: string
 *                 format: binary
 *                 description: Archivo PDF, JPEG, PNG o TIFF (máx 10 MB)
 *     responses:
 *       200:
 *         description: Datos extraídos por Azure AI con candidatos de proveedor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 datosExtraidos:
 *                   type: object
 *                   description: Datos crudos devueltos por Azure AI
 *                   properties:
 *                     vendorName:    { type: string, nullable: true }
 *                     vendorRuc:     { type: string, nullable: true }
 *                     invoiceId:     { type: string, nullable: true }
 *                     invoiceDate:   { type: string, nullable: true }
 *                     subtotal:      { type: number, nullable: true }
 *                     totalTax:      { type: number, nullable: true }
 *                     total:         { type: number, nullable: true }
 *                     rawConfidence: { type: number }
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           description: { type: string }
 *                           quantity:    { type: number }
 *                           unitPrice:   { type: number }
 *                           amount:      { type: number }
 *                 candidatosProveedor:
 *                   type: array
 *                   description: Proveedores existentes ordenados por probabilidad de coincidencia
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:           { type: integer }
 *                       identificacion: { type: string }
 *                       razonSocial:  { type: string }
 *                       _matchTipo:   { type: string, enum: [identificacion_exacta, nombre_parcial, palabra_clave] }
 *                       _score:       { type: integer, description: Puntuación del match (0-100) }
 *                 aviso:
 *                   type: string
 *                   description: Mensaje de advertencia si la confianza de Azure es baja
 *       400:
 *         description: Archivo no enviado o tipo no soportado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/analizar',
  authorize('ADMIN', 'bodeguero'),
  upload.single('factura'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('Se requiere un archivo de factura.', 400, 'MISSING_FILE');
      }

      // 1. Extracción con Azure AI
      const datosExtraidos = await analyzeInvoice(req.file.buffer);

      logger.info(`[Azure/Analizar] vendorName="${datosExtraidos.vendorName}" vendorRuc="${datosExtraidos.vendorRuc}" confidence=${datosExtraidos.rawConfidence}`);

      // 2. Buscar candidatos de proveedor sin guardar nada
      const candidatosProveedor = await buscarCandidatosProveedor(
        datosExtraidos.vendorRuc,
        datosExtraidos.vendorName,
      );

      // 3. Advertir si la confianza de Azure es baja
      const aviso = datosExtraidos.rawConfidence < 0.7
        ? `Azure detectó esta factura con baja confianza (${(datosExtraidos.rawConfidence * 100).toFixed(0)}%). Revisa los datos antes de confirmar.`
        : null;

      return res.status(200).json({
        success: true,
        datosExtraidos,
        candidatosProveedor,
        ...(aviso && { aviso }),
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2: CONFIRMAR (guarda con el proveedorId confirmado por el usuario)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /facturas/confirmar:
 *   post:
 *     tags: [Facturas]
 *     summary: "[PASO 2] Confirmar y guardar factura"
 *     description: >
 *       **Segundo paso del flujo de dos pasos.**
 *
 *       Recibe los datos (previamente analizados y revisados) y los guarda definitivamente.
 *       - `proveedorId` es **obligatorio** — debe ser el ID confirmado por el usuario.
 *       - Actualiza automáticamente el `stockActual` de los productos reconocidos.
 *       - Los ítems no reconocidos se devuelven en `itemsNoReconocidos` para revisión manual.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [proveedorId, numeroFactura, fechaEmision, total, items]
 *             properties:
 *               proveedorId:
 *                 type: integer
 *                 description: ID del proveedor confirmado por el usuario
 *               numeroFactura:
 *                 type: string
 *               fechaEmision:
 *                 type: string
 *                 format: date
 *               total:
 *                 type: number
 *               items:
 *                 type: array
 *                 description: Ítems extraídos por Azure (se intentará match automático a productos)
 *                 items:
 *                   type: object
 *                   properties:
 *                     description: { type: string }
 *                     quantity:    { type: number }
 *                     unitPrice:   { type: number }
 *                     amount:      { type: number }
 *                     productoId:
 *                       type: integer
 *                       nullable: true
 *                       description: Si el usuario ya lo identificó, pasarlo directamente
 *     responses:
 *       201:
 *         description: Factura guardada en BD con detalles de stock actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:            { type: boolean }
 *                 message:            { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     factura:             { type: object }
 *                     itemsReconocidos:    { type: array }
 *                     itemsNoReconocidos:  { type: array }
 *       409:
 *         description: Factura duplicada
 *         $ref: '#/components/responses/Conflict'
 */
router.post(
  '/confirmar',
  authorize('ADMIN', 'bodeguero'),
  [
    body('proveedorId').isInt({ gt: 0 }).withMessage('proveedorId es requerido y debe ser un entero positivo.'),
    body('numeroFactura').notEmpty().withMessage('numeroFactura es requerido.'),
    body('fechaEmision').isISO8601().withMessage('fechaEmision inválida (ISO 8601).'),
    body('total').isFloat({ min: 0 }).withMessage('total debe ser un número >= 0.'),
    body('items').isArray().withMessage('items debe ser un array.'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { proveedorId, numeroFactura, fechaEmision, total, items = [] } = req.body;

      // Verificar que el proveedor existe
      const proveedor = await prisma.proveedor.findUnique({ where: { id: parseInt(proveedorId) } });
      if (!proveedor) {
        throw new AppError(`Proveedor con id ${proveedorId} no encontrado.`, 404, 'NOT_FOUND');
      }

      // Proteger contra facturas duplicadas
      const facturaExistente = await prisma.facturaCompra.findUnique({
        where: { numeroFactura: numeroFactura.trim() },
      });
      if (facturaExistente) {
        return res.status(409).json({
          success: false,
          message: `La factura "${numeroFactura}" ya fue registrada anteriormente.`,
          code:    'DUPLICATE_INVOICE',
          data:    { facturaId: facturaExistente.id },
        });
      }

      // Guardar la factura
      const factura = await prisma.facturaCompra.create({
        data: {
          numeroFactura: numeroFactura.trim(),
          fechaEmision:  new Date(fechaEmision),
          total:         parseFloat(total),
          proveedorId:   parseInt(proveedorId),
        },
      });

      // Procesar ítems y actualizar stock
      const itemsReconocidos   = [];
      const itemsNoReconocidos = [];

      for (const item of items) {
        // Si el usuario ya identificó el producto, usar ese id directamente
        let producto = item.productoId
          ? await prisma.producto.findUnique({ where: { id: parseInt(item.productoId) } })
          : null;

        // Si no, intentar match automático por descripción o código
        if (!producto && item.description) {
          producto = await prisma.producto.findFirst({
            where: {
              OR: [
                { nombre: { contains: item.description, mode: 'insensitive' } },
                { codigo: { equals: item.description,   mode: 'insensitive' } },
              ],
              estado: true,
            },
          });
        }

        if (producto) {
          const cantidad       = parseFloat(item.quantity)  || 1;
          const precioCosto    = parseFloat(item.unitPrice) || 0;
          const subtotalItem   = parseFloat(item.amount)    || +(cantidad * precioCosto).toFixed(6);

          await prisma.detalleCompra.create({
            data: {
              facturaId:  factura.id,
              productoId: producto.id,
              cantidad:   Math.round(cantidad), // DetalleCompra.cantidad es Int
              precioCosto,
              subtotal:   subtotalItem,
            },
          });

          // Incrementar stock
          await prisma.producto.update({
            where: { id: producto.id },
            data:  { stockActual: { increment: Math.round(cantidad) } },
          });

          itemsReconocidos.push({
            ...item,
            productoId:     producto.id,
            productoNombre: producto.nombre,
            productoCodigo: producto.codigo,
          });
        } else {
          itemsNoReconocidos.push(item);
        }
      }

      logger.info(`[Facturas] Confirmada: "${factura.numeroFactura}" | Proveedor id=${proveedorId} | Reconocidos: ${itemsReconocidos.length} | Sin match: ${itemsNoReconocidos.length}`);

      return res.status(201).json({
        success: true,
        message: `Factura guardada. ${itemsReconocidos.length} ítem(s) reconocidos, ${itemsNoReconocidos.length} sin match.`,
        data: { factura, itemsReconocidos, itemsNoReconocidos },
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY: endpoint anterior (mantener por retrocompatibilidad con nota de deprecación)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /facturas/procesar:
 *   post:
 *     tags: [Facturas]
 *     summary: "[DEPRECADO] Procesar factura en un solo paso"
 *     description: >
 *       ⚠️ **Deprecado.** Usar el flujo de dos pasos: `POST /analizar` + `POST /confirmar`.
 *
 *       Este endpoint sigue disponible pero puede asociar el proveedor incorrectamente
 *       si Azure AI no reconoce bien el vendedor desde el layout de la factura.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [factura]
 *             properties:
 *               factura:
 *                 type: string
 *                 format: binary
 *               proveedorId:
 *                 type: integer
 *                 description: Si se conoce el proveedor, pasarlo para evitar auto-creación
 *     responses:
 *       201:
 *         description: Factura procesada (proveedor auto-detectado o creado)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/procesar',
  authorize('ADMIN', 'bodeguero'),
  upload.single('factura'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('Se requiere un archivo de factura (PDF, JPEG, PNG o TIFF).', 400, 'MISSING_FILE');
      }

      const datosExtraidos = await analyzeInvoice(req.file.buffer);

      let proveedorId = req.body.proveedorId ? parseInt(req.body.proveedorId) : null;

      if (!proveedorId) {
        const candidatos = await buscarCandidatosProveedor(datosExtraidos.vendorRuc, datosExtraidos.vendorName);
        if (candidatos.length > 0 && candidatos[0]._score >= 70) {
          proveedorId = candidatos[0].id;
          logger.info(`[Facturas/procesar] Proveedor auto-match: "${candidatos[0].razonSocial}" (score=${candidatos[0]._score})`);
        } else {
          // Auto-crear solo si no hay ningún candidato confiable
          const identificacionNew = datosExtraidos.vendorRuc?.trim() || `AZURE-${Date.now()}`;
          const razonSocialNew    = datosExtraidos.vendorName?.trim() || 'Proveedor sin identificar';
          const existe = await prisma.proveedor.findUnique({ where: { identificacion: identificacionNew } });
          const nuevo  = existe || await prisma.proveedor.create({
            data: { identificacion: identificacionNew, razonSocial: razonSocialNew, estado: true },
          });
          proveedorId = nuevo.id;
          logger.warn(`[Facturas/procesar] Proveedor auto-creado (sin match confiable): "${razonSocialNew}"`);
        }
      }

      const numeroFactura = datosExtraidos.invoiceId?.trim() || `Azure-${Date.now()}`;
      const facturaExistente = await prisma.facturaCompra.findUnique({ where: { numeroFactura } });
      if (facturaExistente) {
        return res.status(409).json({
          success: false,
          message: `La factura "${numeroFactura}" ya fue registrada.`,
          code:    'DUPLICATE_INVOICE',
          data:    { facturaId: facturaExistente.id },
        });
      }

      const factura = await prisma.facturaCompra.create({
        data: {
          numeroFactura,
          fechaEmision: datosExtraidos.invoiceDate ? new Date(datosExtraidos.invoiceDate) : new Date(),
          total:        datosExtraidos.total ?? 0,
          proveedorId,
        },
      });

      const itemsReconocidos = [], itemsNoReconocidos = [];
      for (const item of (datosExtraidos.items || [])) {
        const producto = await prisma.producto.findFirst({
          where: {
            OR: [
              { nombre: { contains: item.description, mode: 'insensitive' } },
              { codigo: { equals: item.description,   mode: 'insensitive' } },
            ],
            estado: true,
          },
        });
        if (producto) {
          const cantidad = Math.round(parseFloat(item.quantity) || 1);
          await prisma.detalleCompra.create({
            data: { facturaId: factura.id, productoId: producto.id, cantidad, precioCosto: item.unitPrice || 0, subtotal: item.amount || 0 },
          });
          await prisma.producto.update({ where: { id: producto.id }, data: { stockActual: { increment: cantidad } } });
          itemsReconocidos.push({ ...item, productoId: producto.id });
        } else {
          itemsNoReconocidos.push(item);
        }
      }

      return res.status(201).json({
        success: true,
        message: `Factura procesada. ${itemsReconocidos.length} reconocidos, ${itemsNoReconocidos.length} sin match.`,
        data: { factura, itemsReconocidos, itemsNoReconocidos },
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
