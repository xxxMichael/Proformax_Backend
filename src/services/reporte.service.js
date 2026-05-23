'use strict';

const reporteRepo = require('../repositories/reporte.repository');
const { AppError } = require('../middlewares/errorHandler');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateRange = (fechaDesde, fechaHasta) => {
  const desde = toDate(fechaDesde);
  const hasta = toDate(fechaHasta);

  if (fechaDesde && !desde) throw new AppError('fechaDesde tiene un formato inválido.', 400, 'INVALID_DATE_RANGE');
  if (fechaHasta && !hasta) throw new AppError('fechaHasta tiene un formato inválido.', 400, 'INVALID_DATE_RANGE');

  return { fechaDesde: desde?.toISOString(), fechaHasta: hasta?.toISOString() };
};

const formatMoney = (value) => Number(toNumber(value).toFixed(2));

const mapProforma = (item) => ({
  id: item.id,
  numeroProforma: item.numeroProforma,
  fechaEmision: item.fechaEmision,
  totalFinal: formatMoney(item.totalFinal),
  cliente: item.cliente,
  usuario: item.usuario,
  estado: item.estado,
});

const getReporteProformas = async (filters) => {
  const { page = 1, limit = 20 } = filters;
  const { fechaDesde, fechaHasta } = normalizeDateRange(filters.fechaDesde, filters.fechaHasta);

  const queryFilters = {
    estado: filters.estado,
    clienteId: filters.clienteId,
    usuarioId: filters.usuarioId,
    fechaDesde,
    fechaHasta,
  };

  const [data, total, aggregate] = await Promise.all([
    reporteRepo.findProformas({ ...queryFilters, skip: (page - 1) * limit, take: limit }),
    reporteRepo.countProformas(queryFilters),
    reporteRepo.aggregateProformas(queryFilters),
  ]);

  const resumen = {
    cantidadEmitida: aggregate._count.id || 0,
    valorTotal: formatMoney(aggregate._sum.totalFinal),
  };

  return {
    data: data.map(mapProforma),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    resumen,
  };
};

const getVentasPorCliente = async (filters) => {
  const { fechaDesde, fechaHasta } = normalizeDateRange(filters.fechaDesde, filters.fechaHasta);
  const accepted = await reporteRepo.findAcceptedProformasWithDetails({
    fechaDesde,
    fechaHasta,
    clienteId: filters.clienteId,
    usuarioId: filters.usuarioId,
  });

  const grouped = new Map();

  for (const proforma of accepted) {
    const key = proforma.clienteId;
    const current = grouped.get(key) || {
      clienteId: proforma.clienteId,
      cliente: proforma.cliente,
      cantidadProformas: 0,
      valorTotal: 0,
    };

    current.cantidadProformas += 1;
    current.valorTotal += toNumber(proforma.totalFinal);
    grouped.set(key, current);
  }

  const data = Array.from(grouped.values())
    .map((item) => ({
      ...item,
      valorTotal: formatMoney(item.valorTotal),
      ticketPromedio: item.cantidadProformas > 0 ? formatMoney(item.valorTotal / item.cantidadProformas) : 0,
      frecuenciaCompra: item.cantidadProformas,
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const resumen = data.reduce((acc, item) => {
    acc.clientes = acc.clientes + 1;
    acc.proformasAceptadas = acc.proformasAceptadas + item.cantidadProformas;
    acc.valorTotal = acc.valorTotal + item.valorTotal;
    return acc;
  }, { clientes: 0, proformasAceptadas: 0, valorTotal: 0 });

  resumen.valorTotal = formatMoney(resumen.valorTotal);

  return { data, total: data.length, resumen };
};

const getProductosMasVendidos = async (filters) => {
  const { fechaDesde, fechaHasta } = normalizeDateRange(filters.fechaDesde, filters.fechaHasta);
  const accepted = await reporteRepo.findAcceptedProformasWithDetails({
    fechaDesde,
    fechaHasta,
    clienteId: filters.clienteId,
    usuarioId: filters.usuarioId,
  });

  const grouped = new Map();

  for (const proforma of accepted) {
    for (const detalle of proforma.detalles) {
      const producto = detalle.producto;
      const key = detalle.productoServicioId;
      const current = grouped.get(key) || {
        productoServicioId: key,
        producto,
        cantidadVendida: 0,
        valorTotal: 0,
        frecuencia: 0,
        proformas: new Set(),
      };

      current.cantidadVendida += toNumber(detalle.cantidad);
      current.valorTotal += toNumber(detalle.subtotal);
      current.proformas.add(proforma.id);
      grouped.set(key, current);
    }
  }

  const data = Array.from(grouped.values())
    .map((item) => ({
      productoServicioId: item.productoServicioId,
      producto: item.producto,
      cantidadVendida: Number(item.cantidadVendida.toFixed(4)),
      valorTotal: formatMoney(item.valorTotal),
      frecuencia: item.proformas.size,
    }))
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida || b.valorTotal - a.valorTotal || b.frecuencia - a.frecuencia);

  const resumen = data.reduce((acc, item) => {
    acc.productos = acc.productos + 1;
    acc.cantidadVendida = acc.cantidadVendida + item.cantidadVendida;
    acc.valorTotal = acc.valorTotal + item.valorTotal;
    return acc;
  }, { productos: 0, cantidadVendida: 0, valorTotal: 0 });

  resumen.cantidadVendida = Number(resumen.cantidadVendida.toFixed(4));
  resumen.valorTotal = formatMoney(resumen.valorTotal);

  return {
    data: data.slice(0, filters.limit || 10),
    total: data.length,
    resumen,
  };
};

const getInventario = async (filters) => {
  const stockBajo = Math.max(0, parseInt(filters.stockBajo, 10) || 10);
  const diasSinMovimiento = Math.max(0, parseInt(filters.diasSinMovimiento, 10) || 90);
  const limiteInactividad = new Date();
  limiteInactividad.setDate(limiteInactividad.getDate() - diasSinMovimiento);

  const [productos, compras, ventas] = await Promise.all([
    reporteRepo.findProductos(),
    reporteRepo.findDetallesCompra(),
    reporteRepo.findAcceptedProformasWithDetails({ fechaDesde: null, fechaHasta: null }),
  ]);

  const inventario = new Map();

  for (const producto of productos) {
    inventario.set(producto.id, {
      ...producto,
      totalComprado: 0,
      totalVendido: 0,
      ultimoMovimiento: null,
    });
  }

  for (const detalle of compras) {
    const item = inventario.get(detalle.productoId);
    if (!item) continue;
    item.totalComprado += toNumber(detalle.cantidad);
    const fecha = detalle.factura?.fechaEmision ? new Date(detalle.factura.fechaEmision) : null;
    if (fecha && (!item.ultimoMovimiento || fecha > item.ultimoMovimiento)) item.ultimoMovimiento = fecha;
  }

  for (const proforma of ventas) {
    for (const detalle of proforma.detalles) {
      const item = inventario.get(detalle.productoServicioId);
      if (!item) continue;
      item.totalVendido += toNumber(detalle.cantidad);
      const fecha = proforma.fechaEmision ? new Date(proforma.fechaEmision) : null;
      if (fecha && (!item.ultimoMovimiento || fecha > item.ultimoMovimiento)) item.ultimoMovimiento = fecha;
    }
  }

  const data = Array.from(inventario.values()).map((item) => {
    const enReposicion = toNumber(item.stockActual) <= stockBajo;
    const sinMovimiento = !item.ultimoMovimiento || item.ultimoMovimiento < limiteInactividad;
    return {
      ...item,
      stockActual: Number(item.stockActual),
      totalComprado: Number(item.totalComprado.toFixed(4)),
      totalVendido: Number(item.totalVendido.toFixed(4)),
      enReposicion,
      sinMovimiento,
      ultimoMovimiento: item.ultimoMovimiento,
    };
  }).sort((a, b) => a.stockActual - b.stockActual || b.totalVendido - a.totalVendido);

  const stockBajoItems = data.filter((item) => item.enReposicion);
  const sinMovimientoItems = data.filter((item) => item.sinMovimiento);

  return {
    data,
    total: data.length,
    resumen: {
      productos: data.length,
      stockBajo: stockBajoItems.length,
      sinMovimiento: sinMovimientoItems.length,
      alertasReposicion: stockBajoItems.length,
      stockTotal: data.reduce((acc, item) => acc + toNumber(item.stockActual), 0),
    },
    alertasReposicion: stockBajoItems,
    sinMovimiento: sinMovimientoItems,
  };
};

const getRentabilidad = async (filters) => {
  const { fechaDesde, fechaHasta } = normalizeDateRange(filters.fechaDesde, filters.fechaHasta);
  const agrupadoPor = (filters.agrupadoPor || 'producto').toLowerCase();
  const limit = Math.max(1, parseInt(filters.limit, 10) || 20);
  const accepted = await reporteRepo.findAcceptedProformasWithDetails({
    fechaDesde,
    fechaHasta,
    clienteId: filters.clienteId,
    usuarioId: filters.usuarioId,
  });

  if (agrupadoPor === 'proforma') {
    const data = accepted.map((proforma) => {
      const estimatedCost = proforma.detalles.reduce((acc, detalle) => {
        const costoBase = toNumber(detalle.producto?.precioBase);
        return acc + (toNumber(detalle.cantidad) * costoBase);
      }, 0);
      const revenue = toNumber(proforma.totalFinal);
      const grossProfit = revenue - estimatedCost;
      return {
        proformaId: proforma.id,
        numeroProforma: proforma.numeroProforma,
        fechaEmision: proforma.fechaEmision,
        cliente: proforma.cliente,
        revenue: formatMoney(revenue),
        estimatedCost: formatMoney(estimatedCost),
        grossProfit: formatMoney(grossProfit),
        grossMarginPct: revenue > 0 ? Number(((grossProfit / revenue) * 100).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    const resumen = data.reduce((acc, item) => {
      acc.revenue += item.revenue;
      acc.estimatedCost += item.estimatedCost;
      acc.grossProfit += item.grossProfit;
      return acc;
    }, { revenue: 0, estimatedCost: 0, grossProfit: 0 });

    resumen.revenue = formatMoney(resumen.revenue);
    resumen.estimatedCost = formatMoney(resumen.estimatedCost);
    resumen.grossProfit = formatMoney(resumen.grossProfit);
    resumen.grossMarginPct = resumen.revenue > 0 ? Number((((resumen.grossProfit) / resumen.revenue) * 100).toFixed(2)) : 0;

    return { data: data.slice(0, limit), total: data.length, resumen };
  }

  const grouped = new Map();

  for (const proforma of accepted) {
    for (const detalle of proforma.detalles) {
      const producto = detalle.producto;
      const key = producto?.id ?? detalle.productoServicioId;
      const current = grouped.get(key) || {
        producto,
        soldQty: 0,
        revenue: 0,
        estimatedCost: 0,
        proformas: new Set(),
      };

      current.soldQty += toNumber(detalle.cantidad);
      current.revenue += toNumber(detalle.subtotal);
      current.estimatedCost += toNumber(detalle.cantidad) * toNumber(producto?.precioBase);
      current.proformas.add(proforma.id);
      grouped.set(key, current);
    }
  }

  const data = Array.from(grouped.values())
    .map((item) => {
      const grossProfit = item.revenue - item.estimatedCost;
      return {
        producto: item.producto,
        soldQty: Number(item.soldQty.toFixed(4)),
        revenue: formatMoney(item.revenue),
        estimatedCost: formatMoney(item.estimatedCost),
        grossProfit: formatMoney(grossProfit),
        grossMarginPct: item.revenue > 0 ? Number(((grossProfit / item.revenue) * 100).toFixed(2)) : 0,
        frequency: item.proformas.size,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit || b.revenue - a.revenue);

  const resumen = data.reduce((acc, item) => {
    acc.productos = acc.productos + 1;
    acc.revenue += item.revenue;
    acc.estimatedCost += item.estimatedCost;
    acc.grossProfit += item.grossProfit;
    return acc;
  }, { productos: 0, revenue: 0, estimatedCost: 0, grossProfit: 0 });

  resumen.revenue = formatMoney(resumen.revenue);
  resumen.estimatedCost = formatMoney(resumen.estimatedCost);
  resumen.grossProfit = formatMoney(resumen.grossProfit);
  resumen.grossMarginPct = resumen.revenue > 0 ? Number(((resumen.grossProfit / resumen.revenue) * 100).toFixed(2)) : 0;

  return {
    data: data.slice(0, limit),
    total: data.length,
    resumen,
  };
};

module.exports = {
  getReporteProformas,
  getVentasPorCliente,
  getProductosMasVendidos,
  getInventario,
  getRentabilidad,
};