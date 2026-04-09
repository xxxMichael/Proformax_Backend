/**
 * UsuarioService - Lógica de negocio para gestión de usuarios
 * LOPDP: Acceso controlado a datos personales
 */

'use strict';

const usuarioRepo = require('../repositories/usuario.repository');
const authService = require('./auth.service');
const { AppError } = require('../middlewares/errorHandler');

const toIntId = (id) => {
  const parsed = Number.parseInt(id, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('ID de usuario inválido.', 400, 'INVALID_ID');
  }
  return parsed;
};

const getAll = async ({ page = 1, limit = 20, rol, estado } = {}) => {
  const skip  = (page - 1) * limit;
  const [data, total] = await Promise.all([
    usuarioRepo.findAll({ skip, take: limit, rol, estado }),
    usuarioRepo.count({ rol, estado }),
  ]);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const userId = toIntId(id);
  const usuario = await usuarioRepo.findById(userId);
  if (!usuario) throw new AppError('Usuario no encontrado.', 404, 'NOT_FOUND');
  return usuario;
};

const create = async (data) => {
  const existe = await usuarioRepo.findByUsername(data.username);
  if (existe) throw new AppError('El username ya está registrado.', 409, 'DUPLICATE_USERNAME');

  const passwordHash = await authService.hashPassword(data.password);
  return usuarioRepo.create({ ...data, passwordHash, password: undefined });
};

const update = async (id, data) => {
  const userId = toIntId(id);
  await getById(userId);

  if (data.password) {
    data.passwordHash = await authService.hashPassword(data.password);
    delete data.password;
  }

  return usuarioRepo.update(userId, data);
};

const changeStatus = async (id, estado, requesterId) => {
  const userId = toIntId(id);
  if (typeof estado !== 'boolean') {
    throw new AppError('El campo estado debe ser booleano.', 400, 'INVALID_STATUS');
  }

  if (!estado && userId === Number(requesterId)) {
    throw new AppError('No puedes desactivar tu propio usuario.', 400, 'SELF_DELETE');
  }

  await getById(userId);
  return usuarioRepo.updateStatus(userId, estado);
};

module.exports = { getAll, getById, create, update, changeStatus };
