/**
 * ClienteRepository - Acceso a datos para la tabla `clientes`
 * Campos reales: id, identificacion, nombres, apellidos_razon_social,
 *                email, telefono, direccion, creado_en, actualizado_en
 */

'use strict';

const prisma = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Construye el filtro WHERE para búsqueda de texto
 * @param {string|undefined} search
 */
const buildWhere = (search) => {
  if (!search) return {};
  return {
    OR: [
      { identificacion:       { contains: search, mode: 'insensitive' } },
      { nombres:              { contains: search, mode: 'insensitive' } },
      { apellidosRazonSocial: { contains: search, mode: 'insensitive' } },
      { email:                { contains: search, mode: 'insensitive' } },
    ],
  };
};

// ── Queries ────────────────────────────────────────────────────────────────

const findAll = ({ skip = 0, take = 20, search } = {}) =>
  prisma.cliente.findMany({
    where:   buildWhere(search),
    orderBy: { nombres: 'asc' },
    skip,
    take,
  });

const count = ({ search } = {}) =>
  prisma.cliente.count({ where: buildWhere(search) });

const findById = (id) =>
  prisma.cliente.findUnique({ where: { id } });

const findByIdentificacion = (identificacion) =>
  prisma.cliente.findUnique({ where: { identificacion } });

/**
 * Solo extrae los campos permitidos para evitar inyectar campos extra
 */
const sanitize = (data) => ({
  identificacion:       data.identificacion,
  nombres:              data.nombres,
  apellidosRazonSocial: data.apellidosRazonSocial,
  ...(data.email     !== undefined && { email:     data.email     }),
  ...(data.telefono  !== undefined && { telefono:  data.telefono  }),
  ...(data.direccion !== undefined && { direccion: data.direccion }),
});

const create = (data) =>
  prisma.cliente.create({ data: sanitize(data) });

const update = (id, data) => {
  const payload = sanitize(data);
  if (data.identificacion === undefined) delete payload.identificacion;
  return prisma.cliente.update({ where: { id }, data: payload });
};

/**
 * Actualización parcial — solo actualiza los campos enviados (PATCH)
 */
const patch = (id, data) => {
  // Construir payload solo con campos definidos
  const payload = {};
  if (data.identificacion       !== undefined) payload.identificacion       = data.identificacion;
  if (data.nombres              !== undefined) payload.nombres              = data.nombres;
  if (data.apellidosRazonSocial !== undefined) payload.apellidosRazonSocial = data.apellidosRazonSocial;
  if (data.email                !== undefined) payload.email                = data.email;
  if (data.telefono             !== undefined) payload.telefono             = data.telefono;
  if (data.direccion            !== undefined) payload.direccion            = data.direccion;
  return prisma.cliente.update({ where: { id }, data: payload });
};

const remove = (id) =>
  prisma.cliente.delete({ where: { id } });

module.exports = { findAll, count, findById, findByIdentificacion, create, update, patch, remove };
