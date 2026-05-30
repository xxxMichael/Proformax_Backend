/**
 * facturaCompra.service.js — Lógica de negocio para facturas de compra
 *
 * Responsabilidades:
 *   - Orquestar el flujo de análisis (Azure) y confirmación (guardado en BD)
 *   - Matching de proveedores con scoring
 *   - Matching de productos por código/descripción
 *   - Validaciones de negocio (facturas duplicadas, proveedor existente, etc.)
 *
 * NO hace llamadas HTTP ni conoce req/res — eso es responsabilidad del Controller.
 */

'use strict';

const facturaRepo  = require('../repositories/facturaCompra.repository');
const { AppError } = require('../middlewares/errorHandler');
const logger       = require('../config/logger');

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — Analizar (extrae con Azure AI, sin guardar nada en BD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza una factura con Azure AI y devuelve los datos extraídos junto con
 * los candidatos de proveedor ordenados por puntuación de coincidencia.
 *
 * @param {Buffer} buffer — Contenido binario del archivo
 * @returns {{ datosExtraidos, candidatosProveedor, avisos }}
 */
const analizar = async (buffer) => {
  // 1. Extraer datos crudos del documento
  const datosExtraidos = await facturaRepo.analyzeDocument(buffer);

  // 1.5 Auto-match de productos
  if (datosExtraidos.items && datosExtraidos.items.length > 0) {
    for (const item of datosExtraidos.items) {
      const matchedProducto = await facturaRepo.findProductoParaMatch(
        item.descripcion,
        item.codigoProducto
      );
      if (matchedProducto) {
        item.productoId = matchedProducto.id;
        item.productoNombre = matchedProducto.nombre;
      } else {
        item.productoId = "NEW";
      }
    }
  }

  // 2. Construir candidatos de proveedor (sin tocar BD más allá de SELECTs)
  const candidatosProveedor = await _buscarCandidatosProveedor(
    datosExtraidos.vendorRuc,
    datosExtraidos.vendorName,
  );

  // 3. Generar avisos para el frontend
  const avisos = [];

  if (datosExtraidos.rawConfidence < 0.7) {
    avisos.push(
      `Confianza de Azure baja (${(datosExtraidos.rawConfidence * 100).toFixed(0)}%). ` +
      'Verifica los datos antes de confirmar.'
    );
  }
  if (!datosExtraidos.numeroFactura) {
    avisos.push('No se detectó número de factura. Ingresa uno manualmente antes de confirmar.');
  }
  if (!datosExtraidos.vendorRuc && !datosExtraidos.vendorName) {
    avisos.push('Azure no identificó al proveedor. Selecciona uno manualmente.');
  }
  if (datosExtraidos.items.length === 0) {
    avisos.push('No se detectaron líneas de productos en la factura.');
  }

  return { datosExtraidos, candidatosProveedor, avisos };
};

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — Confirmar (guarda definitivamente en BD)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda la factura confirmada por el usuario.
 * Intenta hacer match automático de ítems a productos existentes y actualiza stock.
 *
 * @param {{
 *   proveedorId:   number,
 *   numeroFactura: string,
 *   fechaEmision:  string,   // ISO date string
 *   total:         number,
 *   items:         ItemConfirmado[],
 * }} payload
 *
 * @typedef {object} ItemConfirmado
 * @property {string}       descripcion
 * @property {number}       cantidad
 * @property {string|null}  codigoProducto
 * @property {number}       precioUnitario
 * @property {number}       totalItem
 * @property {number|null}  productoId     — Si el usuario ya lo identificó manualmente
 *
 * @returns {{ factura, itemsReconocidos, itemsNoReconocidos }}
 */
const confirmar = async ({ proveedorId, numeroFactura, fechaEmision, total, items = [] }) => {
  // ── Validaciones de negocio ──────────────────────────────────────────────

  // Verificar que el proveedor existe (por id)
  const prismaInstance = require('../config/database');
  const proveedorExiste = await prismaInstance.proveedor.findUnique({
    where:  { id: parseInt(proveedorId) },
    select: { id: true, razonSocial: true },
  });
  if (!proveedorExiste) {
    throw new AppError(`Proveedor con id ${proveedorId} no existe.`, 404, 'NOT_FOUND');
  }

  // Verificar factura duplicada
  const duplicada = await facturaRepo.findByNumeroFactura(numeroFactura.trim());
  if (duplicada) {
    throw new AppError(
      `La factura "${numeroFactura}" ya fue registrada (id=${duplicada.id}).`,
      409, 'DUPLICATE_INVOICE'
    );
  }

  // ── Procesar ítems ────────────────────────────────────────────────────────

  const detallesParaInsertar = [];
  const itemsReconocidos     = [];
  const itemsNoReconocidos   = [];

  for (const [index, item] of items.entries()) {
    let producto = null;

    if (item.productoId === "NEW") {
      // Auto-crear producto en la base de datos
      const generatedCode = item.codigoProducto || `AUTO-FAC-${Date.now().toString().slice(-6)}-${index}`;
      producto = await prismaInstance.producto.create({
        data: {
          codigo: generatedCode,
          nombre: item.descripcion ? item.descripcion.substring(0, 150) : "Sin descripción",
          tipo: 'BIEN',
          precioBase: parseFloat(item.precioUnitario) || 0,
          stockActual: 0,
          aplicaIva: true,
          estado: true,
        }
      });
      logger.info(`[FacturaService] Producto autogenerado: ${producto.codigo} - ${producto.nombre}`);
    } else if (item.productoId) {
      // Usar producto existente seleccionado por el usuario o pre-vinculado
      producto = await prismaInstance.producto.findUnique({
        where:  { id: parseInt(item.productoId) },
        select: { id: true, nombre: true, codigo: true },
      });
    }

    // Match automático fallback si no se mandó ID
    if (!producto) {
      producto = await facturaRepo.findProductoParaMatch(
        item.descripcion,
        item.codigoProducto,
      );
    }

    const cantidad       = Math.round(parseFloat(item.cantidad)      || 0);
    const precioCosto    = parseFloat(item.precioUnitario)            || 0;
    const subtotalItem   = parseFloat(item.totalItem)                 || +(cantidad * precioCosto).toFixed(2);

    if (producto && cantidad > 0) {
      detallesParaInsertar.push({
        productoId:  producto.id,
        cantidad,                           // Int en BD
        precioCosto: +precioCosto.toFixed(2),
        subtotal:    +subtotalItem.toFixed(2),
      });

      itemsReconocidos.push({
        ...item,
        productoId:     producto.id,
        productoNombre: producto.nombre,
        productoCodigo: producto.codigo,
      });
    } else {
      itemsNoReconocidos.push(item);
      if (cantidad === 0) {
        logger.warn(`[FacturaService] Ítem ignorado (cantidad=0): "${item.descripcion}"`);
      }
    }
  }

  // ── Guardar en BD (transacción atómica) ──────────────────────────────────

  const cabecera = {
    numeroFactura: numeroFactura.trim(),
    fechaEmision:  new Date(fechaEmision),
    total:         +parseFloat(total).toFixed(2),
    proveedorId:   parseInt(proveedorId),
  };

  const facturaGuardada = await facturaRepo.createWithDetalles(cabecera, detallesParaInsertar);

  logger.info(
    `[FacturaService] Guardada: "${cabecera.numeroFactura}" | ` +
    `Proveedor: "${proveedorExiste.razonSocial}" | ` +
    `Reconocidos: ${itemsReconocidos.length} | Sin match: ${itemsNoReconocidos.length}`
  );

  return {
    factura:            facturaGuardada,
    itemsReconocidos,
    itemsNoReconocidos,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Consultas de listado
// ─────────────────────────────────────────────────────────────────────────────

const getAll = async ({ page = 1, limit = 20, proveedorId } = {}) => {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    facturaRepo.findAll({ skip, take: limit, proveedorId }),
    facturaRepo.count({ proveedorId }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const factura = await facturaRepo.findById(id);
  if (!factura) throw new AppError('Factura no encontrada.', 404, 'NOT_FOUND');
  return factura;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers privados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca hasta 5 candidatos de proveedor por identificación exacta y nombre parcial.
 * Asigna un score de 0-100 para ordenarlos por relevancia.
 *
 * @param {string|null} identificacion
 * @param {string|null} nombre
 * @returns {ProveedorCandidato[]}
 *
 * @typedef {object} ProveedorCandidato
 * @property {number} id
 * @property {string} identificacion
 * @property {string} razonSocial
 * @property {string} _matchTipo  — 'identificacion_exacta' | 'nombre_parcial' | 'palabra_clave'
 * @property {number} _score      — 100 | 70 | 40
 */
const _buscarCandidatosProveedor = async (identificacion, nombre) => {
  const candidatos  = [];
  const idsVistos   = new Set();

  // 1. Match exacto por RUC / identificación (score 100)
  if (identificacion) {
    const exacto = await facturaRepo.findProveedorByIdentificacion(identificacion);
    if (exacto) {
      candidatos.push({ ...exacto, _matchTipo: 'identificacion_exacta', _score: 100 });
      idsVistos.add(exacto.id);
    }
  }

  // 2. Match parcial por nombre completo (score 70)
  if (nombre && nombre.length >= 2) {
    const porNombre = await facturaRepo.findProveedoresByNombre(
      nombre,
      [...idsVistos],
      5,
    );
    porNombre.forEach((p) => {
      candidatos.push({ ...p, _matchTipo: 'nombre_parcial', _score: 70 });
      idsVistos.add(p.id);
    });
  }

  // 3. Match por palabras individuales (score 40) — útil cuando Azure extrae abreviaturas
  if (nombre && candidatos.length < 3) {
    const palabras = nombre
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    for (const palabra of palabras) {
      const porPalabra = await facturaRepo.findProveedoresByNombre(
        palabra,
        [...idsVistos],
        3,
      );
      porPalabra.forEach((p) => {
        candidatos.push({ ...p, _matchTipo: 'palabra_clave', _score: 40 });
        idsVistos.add(p.id);
      });
    }
  }

  // Ordenar por score desc y limitar a 5
  return candidatos
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);
};

module.exports = { analizar, confirmar, getAll, getById };
