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
  // Normalizar username a minúsculas (consistente con el login)
  const username = data.username?.toLowerCase().trim();

  if (!username) {
    throw new AppError('El username es requerido.', 422, 'VALIDATION_ERROR');
  }

  const existe = await usuarioRepo.findByUsername(username);
  if (existe) {
    throw new AppError(
      `El username "${username}" ya está en uso.`,
      409, 'DUPLICATE_USERNAME'
    );
  }

  // Validar y normalizar email si se envía
  let email;
  if (data.email) {
    email = data.email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('El formato del email no es válido.', 422, 'INVALID_EMAIL');
    }
    const emailExiste = await usuarioRepo.findByEmail(email);
    if (emailExiste) {
      throw new AppError(`El email "${email}" ya está en uso.`, 409, 'DUPLICATE_EMAIL');
    }
  }

  const passwordHash = await authService.hashPassword(data.password);

  // Construir payload limpio — nunca guardar password en texto plano
  const payload = {
    username,
    passwordHash,
    rol:    ['ADMIN', 'vendedor'].includes(data.rol) ? data.rol : 'vendedor',
    estado: data.estado !== undefined ? Boolean(data.estado) : true,
    ...(email !== undefined && { email }),
  };

  return usuarioRepo.create(payload);
};

const update = async (id, data) => {
  const userId = toIntId(id);
  await getById(userId);

  const updateData = { ...data };

  // Normalizar username si se está cambiando
  if (updateData.username) {
    updateData.username = updateData.username.toLowerCase().trim();
    // Verificar que no exista ya ese username en otro usuario
    const otro = await usuarioRepo.findByUsername(updateData.username);
    if (otro && otro.id !== userId) {
      throw new AppError(
        `El username "${updateData.username}" ya está en uso.`,
        409, 'DUPLICATE_USERNAME'
      );
    }
  }

  // Validar y normalizar email si se está cambiando
  if (updateData.email !== undefined) {
    if (updateData.email === null || updateData.email === '') {
      updateData.email = null; // Permitir borrar el email
    } else {
      updateData.email = updateData.email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        throw new AppError('El formato del email no es válido.', 422, 'INVALID_EMAIL');
      }
      const emailExiste = await usuarioRepo.findByEmail(updateData.email);
      if (emailExiste && emailExiste.id !== userId) {
        throw new AppError(`El email "${updateData.email}" ya está en uso.`, 409, 'DUPLICATE_EMAIL');
      }
    }
  }

  // Hash de la nueva contraseña si se envía
  if (updateData.password) {
    updateData.passwordHash = await authService.hashPassword(updateData.password);
    delete updateData.password;
  }

  return usuarioRepo.update(userId, updateData);
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
