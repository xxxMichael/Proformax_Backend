/**
 * facturaCompra.repository.js — Capa de Extracción Azure AI + Acceso a BD
 *
 * Responsabilidades:
 *   1. Enviar el documento a Azure AI y extraer campos crudos (analyzeDocument)
 *   2. Operaciones CRUD sobre facturas_compra y detalles_compra
 *   3. Queries de búsqueda de proveedores candidatos
 *
 * NO contiene lógica de negocio (matching, decisiones, cálculos) — eso va en el Service.
 */

'use strict';

const prisma       = require('../config/database');
const { getClient } = require('../config/azureDocumentAI');
const logger       = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN A: Extracción de datos con Azure AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae un monto monetario de un campo Azure de forma robusta.
 * Azure puede devolver { amount, currencySymbol } o un número directo.
 *
 * @param {object|null} field — Campo bruto de Azure
 * @returns {number|null}
 */
const _getMonto = (field) => {
  if (!field) return null;
  const val = field.value;
  if (val === undefined || val === null) return null;
  if (typeof val === 'object' && 'amount' in val) return val.amount ?? null;
  if (typeof val === 'number') return val;
  return null;
};

/**
 * Extrae texto, número o fecha de un campo Azure de forma segura.
 * Maneja strings, números, Dates y objetos monetarios { amount }.
 *
 * @param {object|null} field — Campo bruto de Azure
 * @param {*} fallback — Valor por defecto si el campo está vacío
 * @returns {*}
 */
const _getValor = (field, fallback = null) => {
  if (!field) return fallback;
  const val = field.value;
  if (val === null || val === undefined) return fallback;
  // Monto monetario
  if (typeof val === 'object' && 'amount' in val) return val.amount ?? fallback;
  // Fecha nativa
  if (val instanceof Date) return val;
  // String / número
  return val ?? fallback;
};

/**
 * Extrae el texto crudo (content) de un campo Azure.
 *
 * Usar para campos cuyo `.value` es un tipo complejo que el SDK no convierte
 * automáticamente a string:
 *   - VendorAddress  → AddressValue { streetAddress, city, state, ... }
 *   - VendorPhoneNumber → PhoneNumberValue (objeto)
 *   - VendorEmail    → puede venir como objeto en algunas versiones del SDK
 *
 * `field.content` siempre contiene el texto tal como aparece en el documento,
 * sin importar el tipo estructurado del campo.
 *
 * @param {object|null} field  — Campo bruto de Azure
 * @param {*}           fallback
 * @returns {string|null}
 */
const _getContent = (field, fallback = null) => {
  if (!field) return fallback;

  // 1. Prioridad: contenido crudo del campo (texto literal del PDF)
  if (typeof field.content === 'string' && field.content.trim()) {
    return field.content.trim();
  }

  // 2. Si .value es string directo, usarlo
  if (typeof field.value === 'string' && field.value.trim()) {
    return field.value.trim();
  }

  // 3. Si .value es un AddressValue, construir string desde sus sub-campos
  if (field.value && typeof field.value === 'object' && !Array.isArray(field.value)) {
    const addr = field.value;
    const partes = [
      addr.streetAddress,
      addr.road,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country,
    ].filter(Boolean);
    if (partes.length > 0) return partes.join(', ');
  }

  return fallback;
};

/**
 * Analiza un documento (Buffer) con Azure AI prebuilt-invoice.
 * Aplica fallbacks entre nombres de campos alternativos usados por distintos
 * proveedores de facturación.
 *
 * @param {Buffer} buffer — Contenido binario del archivo (PDF/imagen)
 * @returns {Promise<FacturaExtraida>}
 *
 * @typedef {object} FacturaExtraida
 * @property {string|null}  vendorName      — Nombre del proveedor
 * @property {string|null}  vendorRuc       — RUC / Tax ID del proveedor
 * @property {string|null}  vendorAddress   — Dirección del proveedor
 * @property {string|null}  vendorPhone     — Teléfono del proveedor
 * @property {string|null}  vendorEmail     — Email del proveedor
 * @property {string|null}  numeroFactura   — Número de factura
 * @property {Date|null}    fechaEmision    — Fecha de emisión
 * @property {number}       subtotal        — Subtotal sin impuestos
 * @property {number}       totalTax        — Total de impuestos (IVA)
 * @property {number}       total           — Total con impuestos
 * @property {ItemExtraido[]} items         — Líneas de productos/servicios
 * @property {number}       rawConfidence   — Confianza del modelo (0-1)
 *
 * @typedef {object} ItemExtraido
 * @property {string} descripcion     — Descripción del ítem
 * @property {number} cantidad        — Cantidad
 * @property {string|null} codigoProducto — Código de producto (si fue detectado)
 * @property {number} precioUnitario  — Precio unitario
 * @property {number} totalItem       — Subtotal del ítem
 */
const analyzeDocument = async (buffer) => {
  const client = getClient();

  logger.info('[Azure/Repository] Iniciando análisis con prebuilt-invoice...');
  const poller   = await client.beginAnalyzeDocument('prebuilt-invoice', buffer);
  const { documents } = await poller.pollUntilDone();

  if (!documents || documents.length === 0) {
    throw new Error('Azure AI no detectó ninguna factura en el documento proporcionado.');
  }

  const invoice    = documents[0].fields;
  const confidence = documents[0].confidence ?? 0;

  // ── Cabecera ──────────────────────────────────────────────────────────────

  const vendorName = _getValor(invoice.VendorName);
  const vendorRuc  = _getValor(invoice.VendorTaxId);

  // VendorAddress: Azure devuelve un AddressValue (objeto), NO un string.
  // _getContent() lee .content (texto crudo del PDF) como fuente principal,
  // con fallback a construir el string desde los sub-campos del AddressValue.
  const vendorAddress = _getContent(invoice.VendorAddress);

  // PhoneNumber y Email también pueden ser tipos estructurados en algunas versiones del SDK
  const vendorPhone = _getContent(invoice.VendorPhoneNumber) ?? _getValor(invoice.CustomerPhoneNumber);
  const vendorEmail = _getContent(invoice.VendorEmail)       ?? _getValor(invoice.CustomerEmail);

  // Número de factura — varios campos alternativos según estándar del emisor
  const numeroFactura =
    _getValor(invoice.InvoiceId) ??
    _getValor(invoice.PurchaseOrder) ??
    null;

  // Fecha — InvoiceDate tiene prioridad; DueDate como fallback
  const fechaEmision =
    _getValor(invoice.InvoiceDate) ??
    _getValor(invoice.DueDate)     ??
    null;

  // ── Totales con fallbacks ──────────────────────────────────────────────────

  const totalRaw =
    _getMonto(invoice.InvoiceTotal) ??
    _getMonto(invoice.AmountDue)    ??
    _getMonto(invoice.SubTotal)     ??
    0;

  const totalTaxRaw = _getMonto(invoice.TotalTax) ?? 0;

  // SubTotal: usar campo directo; si no existe, derivar de total - tax
  const subtotalRaw =
    _getMonto(invoice.SubTotal) ??
    (totalRaw - totalTaxRaw > 0 ? +(totalRaw - totalTaxRaw).toFixed(6) : 0);

  // ── Ítems ─────────────────────────────────────────────────────────────────

  const rawItems = invoice.Items?.values ?? [];
  const items = rawItems.map((item) => {
    const cantidad       = _getValor(item.properties?.Quantity,    0);
    const precioUnitario = _getMonto(item.properties?.UnitPrice) ?? 0;
    const totalItem      = _getMonto(item.properties?.Amount)    ?? +(cantidad * precioUnitario).toFixed(6);

    return {
      descripcion:    _getValor(item.properties?.Description, 'Sin descripción'),
      cantidad:       typeof cantidad === 'number' ? cantidad : parseFloat(cantidad) || 0,
      codigoProducto: _getValor(item.properties?.ProductCode) ?? null,
      precioUnitario: +precioUnitario.toFixed(6),
      totalItem:      +totalItem.toFixed(6),
    };
  });

  const resultado = {
    vendorName:    typeof vendorName  === 'string' ? vendorName.trim()  : null,
    vendorRuc:     typeof vendorRuc   === 'string' ? vendorRuc.trim()   : null,
    vendorAddress: typeof vendorAddress === 'string' ? vendorAddress.trim() : null,
    vendorPhone:   typeof vendorPhone === 'string' ? vendorPhone.trim() : null,
    vendorEmail:   typeof vendorEmail === 'string' ? vendorEmail.trim() : null,
    numeroFactura: typeof numeroFactura === 'string' ? numeroFactura.trim() : null,
    fechaEmision:  fechaEmision instanceof Date ? fechaEmision : null,
    subtotal:      +subtotalRaw.toFixed(6),
    totalTax:      +totalTaxRaw.toFixed(6),
    total:         +totalRaw.toFixed(6),
    items,
    rawConfidence: confidence,
  };

  logger.info(
    '[Azure/Repository] Extracción completa:\n' +
    `  vendor   : "${resultado.vendorName}"\n` +
    `  ruc      : "${resultado.vendorRuc}"\n` +
    `  direccion: "${resultado.vendorAddress}"\n` +
    `  telefono : "${resultado.vendorPhone}"\n` +
    `  email    : "${resultado.vendorEmail}"\n` +
    `  nroFact  : "${resultado.numeroFactura}"\n` +
    `  total    : ${resultado.total}\n` +
    `  items    : ${items.length}\n` +
    `  confianza: ${(confidence * 100).toFixed(0)}%`
  );

  return resultado;
};

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN B: Acceso a BD — FacturaCompra
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ skip: number, take: number, proveedorId?: number }} opts
 */
const findAll = ({ skip = 0, take = 20, proveedorId } = {}) => {
  const where = proveedorId ? { proveedorId } : {};
  return prisma.facturaCompra.findMany({
    where,
    skip,
    take,
    orderBy: { creadoEn: 'desc' },
    include: {
      proveedor: { select: { id: true, identificacion: true, razonSocial: true } },
    },
  });
};

const count = ({ proveedorId } = {}) =>
  prisma.facturaCompra.count({ where: proveedorId ? { proveedorId } : {} });

const findById = (id) =>
  prisma.facturaCompra.findUnique({
    where:   { id },
    include: {
      proveedor: true,
      detalles:  { include: { producto: true } },
    },
  });

const findByNumeroFactura = (numeroFactura) =>
  prisma.facturaCompra.findUnique({ where: { numeroFactura } });

/**
 * Crea la factura y sus detalles en una transacción atómica.
 *
 * @param {{ proveedorId, numeroFactura, fechaEmision, total }} cabecera
 * @param {{ productoId, cantidad, precioCosto, subtotal }[]} detalles
 */
const createWithDetalles = async (cabecera, detalles) => {
  return prisma.$transaction(async (tx) => {
    const factura = await tx.facturaCompra.create({ data: cabecera });

    if (detalles.length > 0) {
      await tx.detalleCompra.createMany({
        data: detalles.map((d) => ({ ...d, facturaId: factura.id })),
      });

      // Actualizar stock de cada producto
      for (const d of detalles) {
        await tx.producto.update({
          where: { id: d.productoId },
          data:  { stockActual: { increment: d.cantidad } },
        });
      }
    }

    // Re-fetch con relaciones
    return tx.facturaCompra.findUnique({
      where:   { id: factura.id },
      include: { proveedor: true, detalles: { include: { producto: true } } },
    });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN C: Acceso a BD — Proveedores (para matching)
// ─────────────────────────────────────────────────────────────────────────────

/** Busca proveedor por identificación exacta */
const findProveedorByIdentificacion = (identificacion) =>
  prisma.proveedor.findUnique({ where: { identificacion } });

/**
 * Busca proveedores candidatos por nombre parcial (top N).
 * @param {string} texto
 * @param {number[]} excludeIds — IDs ya encontrados para evitar duplicados
 */
const findProveedoresByNombre = (texto, excludeIds = [], take = 5) =>
  prisma.proveedor.findMany({
    where: {
      OR: [
        { razonSocial:     { contains: texto, mode: 'insensitive' } },
        { nombreComercial: { contains: texto, mode: 'insensitive' } },
      ],
      id: { notIn: excludeIds },
    },
    take,
    orderBy: { razonSocial: 'asc' },
  });

/** Crea un proveedor nuevo (usado por auto-creación en el service) */
const createProveedor = (data) => prisma.proveedor.create({ data });

/** Busca un producto por código exacto o nombre parcial */
const findProductoParaMatch = (descripcion, codigo = null) =>
  prisma.producto.findFirst({
    where: {
      estado: true,
      OR: [
        ...(codigo ? [{ codigo: { equals: codigo, mode: 'insensitive' } }] : []),
        { nombre: { contains: descripcion, mode: 'insensitive' } },
      ],
    },
  });

module.exports = {
  // Azure
  analyzeDocument,
  // FacturaCompra
  findAll,
  count,
  findById,
  findByNumeroFactura,
  createWithDetalles,
  // Proveedores
  findProveedorByIdentificacion,
  findProveedoresByNombre,
  createProveedor,
  // Productos
  findProductoParaMatch,
};
