/**
 * ProformaRepository - Capa de acceso a datos para Proformas
 */

'use strict';

const prisma = require('../config/database');

const DETAIL_INCLUDE = {
  cliente:  { select: { id: true, nombres: true, apellidos: true, email: true, ruc: true, cedula: true } },
  usuario:  { select: { id: true, nombre: true, apellido: true, email: true } },
  detalles: {
    include: { producto: { select: { id: true, nombre: true, codigo: true, unidadMedida: true } } },
  },
  historialEstados: { orderBy: { creadoEn: 'desc' } },
};

const findAll = ({ skip = 0, take = 20, estado, usuarioId, clienteId, search } = {}) =>
  prisma.proforma.findMany({
    where: {
      ...(estado    && { estado }),
      ...(usuarioId && { usuarioId }),
      ...(clienteId && { clienteId }),
      ...(search    && {
        OR: [
          { numero:  { contains: search, mode: 'insensitive' } },
          { cliente: { nombres: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    },
    include: {
      cliente: { select: { id: true, nombres: true, apellidos: true } },
      usuario: { select: { id: true, nombre: true, apellido: true } },
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

const findByNumero = (numero) =>
  prisma.proforma.findUnique({ where: { numero }, include: DETAIL_INCLUDE });

const create = (data) =>
  prisma.proforma.create({ data, include: DETAIL_INCLUDE });

const update = (id, data) =>
  prisma.proforma.update({ where: { id }, data, include: DETAIL_INCLUDE });

const changeStatus = async (id, estadoDespues, motivo, estadoAntes) => {
  return prisma.$transaction([
    prisma.proforma.update({ where: { id }, data: { estado: estadoDespues } }),
    prisma.historialEstadoProforma.create({
      data: { proformaId: id, estadoAntes, estadoDespues, motivo },
    }),
  ]);
};

const updatePdfUrl = (id, pdfUrl) =>
  prisma.proforma.update({ where: { id }, data: { pdfUrl } });

module.exports = { findAll, count, findById, findByNumero, create, update, changeStatus, updatePdfUrl };
