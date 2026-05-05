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

const create = (data) =>
  prisma.proforma.create({ data, include: DETAIL_INCLUDE });

const update = (id, data) =>
  prisma.proforma.update({ where: { id }, data, include: DETAIL_INCLUDE });

const changeStatus = async (id, estadoDespues, motivo, estadoAntes) => {
  return prisma.proforma.update({ where: { id }, data: { estado: estadoDespues } });
};

const updatePdfUrl = (id, pdfUrl) =>
  prisma.proforma.update({ where: { id }, data: { pdfUrl } });

module.exports = { findAll, count, findById, findByNumero, create, update, changeStatus, updatePdfUrl };
