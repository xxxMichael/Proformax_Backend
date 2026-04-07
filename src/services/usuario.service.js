/**
 * UsuarioService - Lógica de negocio para gestión de usuarios
 * LOPDP: Acceso controlado a datos personales
 */

'use strict';

const usuarioRepo = require('../repositories/usuario.repository');
const authService = require('./auth.service');
const { AppError } = require('../middlewares/errorHandler');

const getAll = async ({ page = 1, limit = 20, rol, activo } = {}) => {
  const skip  = (page - 1) * limit;
  const [data, total] = await Promise.all([
    usuarioRepo.findAll({ skip, take: limit, rol, activo }),
    usuarioRepo.count({ rol, activo }),
  ]);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const usuario = await usuarioRepo.findById(id);
  if (!usuario) throw new AppError('Usuario no encontrado.', 404, 'NOT_FOUND');
  return usuario;
};

const create = async (data) => {
  const existe = await usuarioRepo.findByEmail(data.email);
  if (existe) throw new AppError('El email ya está registrado.', 409, 'DUPLICATE_EMAIL');

  const passwordHash = await authService.hashPassword(data.password);
  return usuarioRepo.create({ ...data, passwordHash, password: undefined });
};

const update = async (id, data) => {
  await getById(id);

  if (data.password) {
    data.passwordHash = await authService.hashPassword(data.password);
    delete data.password;
  }

  return usuarioRepo.update(id, data);
};

const deactivate = async (id, requesterId) => {
  if (id === requesterId) throw new AppError('No puedes desactivar tu propio usuario.', 400, 'SELF_DELETE');
  await getById(id);
  return usuarioRepo.softDelete(id);
};

module.exports = { getAll, getById, create, update, deactivate };
