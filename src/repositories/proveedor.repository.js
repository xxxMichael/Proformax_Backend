/**
 * ProveedorRepository — Acceso a datos para `proveedores`
 * Campos reales (Prisma): id, identificacion, razonSocial, nombreComercial,
 *   direccion, telefono, email, estado, creadoEn, actualizadoEn
 */

'use strict';

const prisma = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────

const buildWhere = ({ search, estado } = {}) => ({
  ...(typeof estado === 'boolean' && { estado }),
  ...(search && {
    OR: [
      { identificacion: { contains: search, mode: 'insensitive' } },
      { razonSocial:    { contains: search, mode: 'insensitive' } },
      { nombreComercial:{ contains: search, mode: 'insensitive' } },
      { email:          { contains: search, mode: 'insensitive' } },
    ],
  }),
});

const sanitize = (data) => {
  const p = {};
  if (data.identificacion  !== undefined) p.identificacion  = data.identificacion;
  if (data.razonSocial     !== undefined) p.razonSocial     = data.razonSocial;
  if (data.nombreComercial !== undefined) p.nombreComercial = data.nombreComercial;
  if (data.direccion       !== undefined) p.direccion       = data.direccion;
  if (data.telefono        !== undefined) p.telefono        = data.telefono;
  if (data.email           !== undefined) p.email           = data.email;
  if (data.estado          !== undefined) p.estado          = data.estado;
  return p;
};

// ── Queries ────────────────────────────────────────────────────────────────

const findAll = ({ skip = 0, take = 20, search, estado } = {}) =>
  prisma.proveedor.findMany({
    where:   buildWhere({ search, estado }),
    orderBy: { razonSocial: 'asc' },
    skip,
    take,
  });

const count = ({ search, estado } = {}) =>
  prisma.proveedor.count({ where: buildWhere({ search, estado }) });

const findById = (id) =>
  prisma.proveedor.findUnique({ where: { id } });

const findByIdentificacion = (identificacion) =>
  prisma.proveedor.findUnique({ where: { identificacion } });

const create = (data) =>
  prisma.proveedor.create({ data: sanitize(data) });

const update = (id, data) =>
  prisma.proveedor.update({ where: { id }, data: sanitize(data) });

const patch = (id, data) =>
  prisma.proveedor.update({ where: { id }, data: sanitize(data) });

const disable = (id) =>
  prisma.proveedor.update({ where: { id }, data: { estado: false } });

module.exports = { findAll, count, findById, findByIdentificacion, create, update, patch, disable };
