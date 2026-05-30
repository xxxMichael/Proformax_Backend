/**
 * UsuarioRepository - Capa de acceso a datos para Usuarios
 * Patrón Repository: abstrae las consultas a la BD de la lógica de negocio
 */

'use strict';

const prisma = require('../config/database');

const SAFE_SELECT = {
  id:            true,
  username:      true,
  rol:           true,
  estado:        true,
  email:         true,
  creadoEn:      true,
  actualizadoEn: true,
};

const findAll = ({ skip = 0, take = 20, rol, estado } = {}) =>
  prisma.usuario.findMany({
    where:   { ...(rol !== undefined && { rol }), ...(estado !== undefined && { estado }) },
    select:  SAFE_SELECT,
    orderBy: { creadoEn: 'desc' },
    skip,
    take,
  });

const count = ({ rol, estado } = {}) =>
  prisma.usuario.count({
    where: { ...(rol !== undefined && { rol }), ...(estado !== undefined && { estado }) },
  });

const findById = (id) =>
  prisma.usuario.findUnique({ where: { id }, select: SAFE_SELECT });

const findByUsername = (username) =>
  prisma.usuario.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });

/**
 * Busca un usuario por su email (case-insensitive).
 * @param {string} email
 */
const findByEmail = (email) =>
  prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

/**
 * Busca un usuario que tenga exactamente ese reset token almacenado.
 * @param {string} token - Token hasheado a buscar
 */
const findByResetToken = (token) =>
  prisma.usuario.findFirst({
    where: { resetToken: token },
  });

/**
 * Guarda el token de recuperación (ya hasheado) y su fecha de expiración.
 * @param {number} id
 * @param {string} hashedToken
 * @param {Date}   expiry
 */
const saveResetToken = (id, hashedToken, expiry) =>
  prisma.usuario.update({
    where: { id },
    data:  { resetToken: hashedToken, resetTokenExpiry: expiry },
    select: SAFE_SELECT,
  });

/**
 * Limpia el token de recuperación después de usarlo o invalidarlo.
 * @param {number} id
 */
const clearResetToken = (id) =>
  prisma.usuario.update({
    where: { id },
    data:  { resetToken: null, resetTokenExpiry: null },
    select: SAFE_SELECT,
  });

const create = (data) =>
  prisma.usuario.create({ data, select: SAFE_SELECT });

const update = (id, data) =>
  prisma.usuario.update({ where: { id }, data, select: SAFE_SELECT });

const updateStatus = (id, estado) =>
  prisma.usuario.update({ where: { id }, data: { estado }, select: SAFE_SELECT });

module.exports = {
  findAll,
  count,
  findById,
  findByUsername,
  findByEmail,
  findByResetToken,
  saveResetToken,
  clearResetToken,
  create,
  update,
  updateStatus,
};
