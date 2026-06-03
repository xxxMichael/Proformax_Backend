/**
 * ProformaRepository - Capa de acceso a datos para Proformas
 */

'use strict';

const prisma = require('../config/database');

const DETAIL_INCLUDE = {
  cliente:  { select: { id: true, nombres: true, apellidosRazonSocial: true, email: true, identificacion: true } },
  usuario:  { select: { id: true, username: true } },
  detalles: {
    include: { producto: { select: { id: true, nombre: true, codigo: true } } },
  }
};

const findAll = ({ skip = 0, take = 20, estado, usuarioId, clienteId, search } = {}) =>
  prisma.proforma.findMany({
    where: {
      ...(estado    && { estado }),
      ...(usuarioId && { usuarioId }),
      ...(clienteId && { clienteId }),
      ...(search    && {
        OR: [
          { numeroProforma:  { contains: search, mode: 'insensitive' } },
          { cliente: { nombres: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    },
    include: {
      cliente: { select: { id: true, nombres: true, apellidosRazonSocial: true } },
      usuario: { select: { id: true, username: true } },
    },
    orderBy: { creadoEn: 'desc' },
    skip,
    take,
  });

const count = ({ estado, usuarioId, clienteId } = {}) =>
  prisma.proforma.count({
    where: {
      ...(estado    && { estado }),
      ...(usuarioId && { usuarioId }),
      ...(clienteId && { clienteId }),
    },
  });

const findById = (id) =>
  prisma.proforma.findUnique({ where: { id }, include: DETAIL_INCLUDE });

const findByNumero = (numeroProforma) =>
  prisma.proforma.findUnique({ where: { numeroProforma }, include: DETAIL_INCLUDE });

const create = async (data) => {
  return prisma.$transaction(async (tx) => {
    const proforma = await tx.proforma.create({ data, include: DETAIL_INCLUDE });
    
    // Descontar stock al crear la proforma
    for (const d of proforma.detalles) {
      await tx.producto.update({
        where: { id: d.productoServicioId },
        data: { stockActual: { decrement: Number(d.cantidad) } }
      });
    }
    
    return proforma;
  });
};

const update = async (id, data) => {
  return prisma.$transaction(async (tx) => {
    // Si se están actualizando los detalles (se mandó data.detalles)
    if (data.detalles && data.detalles.create) {
      // 1. Obtener proforma antigua para restaurar stock
      const oldProforma = await tx.proforma.findUnique({
        where: { id },
        include: { detalles: true }
      });

      // 2. Restaurar stock de los detalles antiguos
      for (const d of oldProforma.detalles) {
        await tx.producto.update({
          where: { id: d.productoServicioId },
          data: { stockActual: { increment: Number(d.cantidad) } }
        });
      }

      // 3. Actualizar la proforma (borra detalles antiguos y crea nuevos)
      const proforma = await tx.proforma.update({ where: { id }, data, include: DETAIL_INCLUDE });

      // 4. Descontar stock de los detalles nuevos
      for (const d of proforma.detalles) {
        await tx.producto.update({
          where: { id: d.productoServicioId },
          data: { stockActual: { decrement: Number(d.cantidad) } }
        });
      }

      return proforma;
    } else {
      // Actualización normal sin tocar detalles ni stock
      return tx.proforma.update({ where: { id }, data, include: DETAIL_INCLUDE });
    }
  });
};

const changeStatus = async (id, estadoDespues, motivo, estadoAntes) => {
  return prisma.$transaction(async (tx) => {
    const proforma = await tx.proforma.update({ 
      where: { id }, 
      data: { estado: estadoDespues },
      include: { detalles: true }
    });

    // Si se anula la proforma, se restaura el stock
    if (estadoDespues === 'ANULADA' && estadoAntes !== 'ANULADA') {
      for (const d of proforma.detalles) {
        await tx.producto.update({
          where: { id: d.productoServicioId },
          data: { stockActual: { increment: Number(d.cantidad) } }
        });
      }
    }

    return proforma;
  });
};

const updatePdfUrl = (id, pdfUrl) =>
  prisma.proforma.update({ where: { id }, data: { pdfUrl } });

module.exports = { findAll, count, findById, findByNumero, create, update, changeStatus, updatePdfUrl };
