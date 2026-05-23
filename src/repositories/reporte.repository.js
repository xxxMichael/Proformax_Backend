'use strict';

const prisma = require('../config/database');

const buildDateFilter = (field, fechaDesde, fechaHasta) => {
  const filter = {};

  if (fechaDesde) {
    const desde = new Date(fechaDesde);
    if (!Number.isNaN(desde.getTime())) {
      desde.setHours(0, 0, 0, 0);
      filter.gte = desde;
    }
  }

  if (fechaHasta) {
    const hasta = new Date(fechaHasta);
    if (!Number.isNaN(hasta.getTime())) {
      hasta.setHours(23, 59, 59, 999);
      filter.lte = hasta;
    }
  }

  return Object.keys(filter).length ? { [field]: filter } : {};
};

const findProformas = async ({
  skip = 0,
  take = 20,
  estado,
  clienteId,
  usuarioId,
  fechaDesde,
  fechaHasta,
} = {}) => prisma.proforma.findMany({
  where: {
    ...(estado && { estado }),
    ...(clienteId && { clienteId }),
    ...(usuarioId && { usuarioId }),
    ...buildDateFilter('fechaEmision', fechaDesde, fechaHasta),
  },
  include: {
    cliente: { select: { id: true, identificacion: true, nombres: true, apellidosRazonSocial: true } },
    usuario: { select: { id: true, username: true } },
  },
  orderBy: { fechaEmision: 'desc' },
  skip,
  take,
});

const countProformas = ({ estado, clienteId, usuarioId, fechaDesde, fechaHasta } = {}) =>
  prisma.proforma.count({
    where: {
      ...(estado && { estado }),
      ...(clienteId && { clienteId }),
      ...(usuarioId && { usuarioId }),
      ...buildDateFilter('fechaEmision', fechaDesde, fechaHasta),
    },
  });

const aggregateProformas = ({ estado, clienteId, usuarioId, fechaDesde, fechaHasta } = {}) =>
  prisma.proforma.aggregate({
    where: {
      ...(estado && { estado }),
      ...(clienteId && { clienteId }),
      ...(usuarioId && { usuarioId }),
      ...buildDateFilter('fechaEmision', fechaDesde, fechaHasta),
    },
    _count: { id: true },
    _sum: { totalFinal: true },
  });

const findAcceptedProformasWithDetails = ({ fechaDesde, fechaHasta, clienteId, usuarioId } = {}) =>
  prisma.proforma.findMany({
    where: {
      estado: 'ACEPTADA',
      ...(clienteId && { clienteId }),
      ...(usuarioId && { usuarioId }),
      ...buildDateFilter('fechaEmision', fechaDesde, fechaHasta),
    },
    select: {
      id: true,
      numeroProforma: true,
      fechaEmision: true,
      totalFinal: true,
      clienteId: true,
      usuarioId: true,
      cliente: { select: { id: true, identificacion: true, nombres: true, apellidosRazonSocial: true } },
      usuario: { select: { id: true, username: true } },
      detalles: {
        select: {
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
          productoServicioId: true,
          producto: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              tipo: true,
              precioBase: true,
              stockActual: true,
              estado: true,
            },
          },
        },
      },
    },
    orderBy: { fechaEmision: 'desc' },
  });

const findProductos = () => prisma.producto.findMany({
  select: {
    id: true,
    codigo: true,
    nombre: true,
    descripcion: true,
    tipo: true,
    precioBase: true,
    stockActual: true,
    aplicaIva: true,
    estado: true,
  },
  orderBy: { nombre: 'asc' },
});

const findDetallesCompra = () => prisma.detalleCompra.findMany({
  select: {
    productoId: true,
    cantidad: true,
    precioCosto: true,
    subtotal: true,
    factura: { select: { fechaEmision: true } },
    producto: {
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        tipo: true,
        precioBase: true,
        stockActual: true,
        aplicaIva: true,
        estado: true,
      },
    },
  },
});

module.exports = {
  findProformas,
  countProformas,
  aggregateProformas,
  findAcceptedProformasWithDetails,
  findProductos,
  findDetallesCompra,
};