'use strict';

const reporteService = require('../services/reporte.service');

const getProformas = async (req, res, next) => {
  try {
    const { page, limit, estado, clienteId, usuarioId, fechaDesde, fechaHasta } = req.query;
    const result = await reporteService.getReporteProformas({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      estado,
      clienteId: clienteId ? parseInt(clienteId, 10) : undefined,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : undefined,
      fechaDesde,
      fechaHasta,
    });

    res.set('X-Total-Count', result.total);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getVentasPorCliente = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, clienteId, usuarioId } = req.query;
    const result = await reporteService.getVentasPorCliente({
      fechaDesde,
      fechaHasta,
      clienteId: clienteId ? parseInt(clienteId, 10) : undefined,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : undefined,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getProductosMasVendidos = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, clienteId, usuarioId, limit } = req.query;
    const result = await reporteService.getProductosMasVendidos({
      fechaDesde,
      fechaHasta,
      clienteId: clienteId ? parseInt(clienteId, 10) : undefined,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getInventario = async (req, res, next) => {
  try {
    const { stockBajo, diasSinMovimiento } = req.query;
    const result = await reporteService.getInventario({ stockBajo, diasSinMovimiento });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getRentabilidad = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, agrupadoPor, clienteId, usuarioId, limit } = req.query;
    const result = await reporteService.getRentabilidad({
      fechaDesde,
      fechaHasta,
      agrupadoPor,
      clienteId: clienteId ? parseInt(clienteId, 10) : undefined,
      usuarioId: usuarioId ? parseInt(usuarioId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProformas,
  getVentasPorCliente,
  getProductosMasVendidos,
  getInventario,
  getRentabilidad,
};