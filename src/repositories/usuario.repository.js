/**
 * UsuarioRepository - Capa de acceso a datos para Usuarios
 * Patrón Repository: abstrae las consultas a la BD de la lógica de negocio
 */

'use strict';

const prisma = require('../config/database');

const SAFE_SELECT = {
  id:           true,
  nombre:       true,
  apellido:     true,
  email:        true,
  rol:          true,
  activo:       true,
  telefono:     true,
  creadoEn:     true,
  actualizadoEn: true,
  ultimoAcceso: true,
};

const findAll = ({ skip = 0, take = 20, rol, activo } = {}) =>
  prisma.usuario.findMany({
    where:   { ...(rol !== undefined && { rol }), ...(activo !== undefined && { activo }) },
    select:  SAFE_SELECT,
    orderBy: { creadoEn: 'desc' },
    skip,
    take,
  });

const count = ({ rol, activo } = {}) =>
  prisma.usuario.count({
    where: { ...(rol !== undefined && { rol }), ...(activo !== undefined && { activo }) },
  });

const findById = (id) =>
  prisma.usuario.findUnique({ where: { id }, select: SAFE_SELECT });

const findByEmail = (email) =>
  prisma.usuario.findUnique({ where: { email } });

const create = (data) =>
  prisma.usuario.create({ data, select: SAFE_SELECT });

const update = (id, data) =>
  prisma.usuario.update({ where: { id }, data, select: SAFE_SELECT });

const updateLastAccess = (id) =>
  prisma.usuario.update({ where: { id }, data: { ultimoAcceso: new Date() } });

const softDelete = (id) =>
  prisma.usuario.update({ where: { id }, data: { activo: false }, select: SAFE_SELECT });

module.exports = { findAll, count, findById, findByEmail, create, update, updateLastAccess, softDelete };
