/**
 * ProductoRepository — Acceso a datos para `productos_servicios`
 * Campos reales (Prisma): id, codigo, nombre, descripcion, tipo,
 *   precioBase, stockActual, aplicaIva, estado
 */

'use strict';

const prisma = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────

const buildWhere = ({ search, tipo, estado } = {}) => ({
  ...(typeof estado === 'boolean' && { estado }),
  ...(tipo   && { tipo: { equals: tipo, mode: 'insensitive' } }),
  ...(search && {
    OR: [
      { codigo:  { contains: search, mode: 'insensitive' } },
      { nombre:  { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } },
    ],
  }),
});

/** Solo los campos permitidos del modelo */
const sanitize = (data) => {
  const p = {};
  if (data.codigo       !== undefined) p.codigo       = data.codigo;
  if (data.nombre       !== undefined) p.nombre       = data.nombre;
  if (data.descripcion  !== undefined) p.descripcion  = data.descripcion;
  if (data.tipo         !== undefined) p.tipo         = data.tipo;
  if (data.precioBase   !== undefined) p.precioBase   = data.precioBase;
  if (data.stockActual  !== undefined) p.stockActual  = data.stockActual;
  if (data.aplicaIva    !== undefined) p.aplicaIva    = data.aplicaIva;
  if (data.estado       !== undefined) p.estado       = data.estado;
  return p;
};

// ── Queries ────────────────────────────────────────────────────────────────

const findAll = ({ skip = 0, take = 20, search, tipo, estado } = {}) =>
  prisma.producto.findMany({
    where:   buildWhere({ search, tipo, estado }),
    orderBy: { nombre: 'asc' },
    skip,
    take,
  });

const count = ({ search, tipo, estado } = {}) =>
  prisma.producto.count({ where: buildWhere({ search, tipo, estado }) });

const findById = (id) =>
  prisma.producto.findUnique({ where: { id } });

const findByCodigo = (codigo) =>
  prisma.producto.findUnique({ where: { codigo } });

const create = (data) =>
  prisma.producto.create({ data: sanitize(data) });

const update = (id, data) =>
  prisma.producto.update({ where: { id }, data: sanitize(data) });

const patch = (id, data) =>
  prisma.producto.update({ where: { id }, data: sanitize(data) });

/** Desactivar lógicamente (estado = false) */
const disable = (id) =>
  prisma.producto.update({ where: { id }, data: { estado: false } });

module.exports = { findAll, count, findById, findByCodigo, create, update, patch, disable };
