/**
 * facturaCompra.controller.js — Controlador HTTP para facturas de compra
 *
 * Responsabilidad: recibir req, delegar al Service, formatear res.
 * NO contiene lógica de negocio.
 */

'use strict';

const facturaService = require('../services/facturaCompra.service');

/**
 * GET /facturas
 * Lista paginada de facturas de compra con proveedor.
 */
const getAll = async (req, res, next) => {
  try {
    const { page, limit, proveedorId } = req.query;
    const result = await facturaService.getAll({
      page:        parseInt(page)        || 1,
      limit:       parseInt(limit)       || 20,
      proveedorId: proveedorId ? parseInt(proveedorId) : undefined,
    });
    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

/**
 * GET /facturas/:id
 * Detalle de una factura con proveedor + detalles de compra + productos.
 */
const getById = async (req, res, next) => {
  try {
    const data = await facturaService.getById(parseInt(req.params.id));
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

/**
 * POST /facturas/analizar
 * Paso 1: extrae datos con Azure AI sin guardar nada en BD.
 * Devuelve datos extraídos + candidatos de proveedor + avisos de calidad.
 */
const analizar = async (req, res, next) => {
  try {
    const result = await facturaService.analizar(req.file.buffer);
    return res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
};

/**
 * POST /facturas/confirmar
 * Paso 2: guarda la factura con el proveedorId confirmado por el usuario.
 * Actualiza stock de productos reconocidos automáticamente.
 */
const confirmar = async (req, res, next) => {
  try {
    const { proveedorId, numeroFactura, fechaEmision, total, items } = req.body;

    const result = await facturaService.confirmar({
      proveedorId:   parseInt(proveedorId),
      numeroFactura,
      fechaEmision,
      total:         parseFloat(total),
      items:         items || [],
    });

    return res.status(201).json({
      success: true,
      message: `Factura guardada. ${result.itemsReconocidos.length} ítem(s) con stock actualizado, ` +
               `${result.itemsNoReconocidos.length} sin match.`,
      data: result,
    });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, analizar, confirmar };
