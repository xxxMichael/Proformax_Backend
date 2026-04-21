/**
 * ProveedorService — Lógica de negocio para proveedores
 */

'use strict';

const proveedorRepo = require('../repositories/proveedor.repository');
const { AppError }  = require('../middlewares/errorHandler');

const getAll = async ({ page = 1, limit = 20, search, estado } = {}) => {
  const skip = (page - 1) * limit;

  let estadoBool;
  if (estado === 'true')  estadoBool = true;
  if (estado === 'false') estadoBool = false;
  if (typeof estado === 'boolean') estadoBool = estado;

  const [data, total] = await Promise.all([
    proveedorRepo.findAll({ skip, take: limit, search, estado: estadoBool }),
    proveedorRepo.count({ search, estado: estadoBool }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const proveedor = await proveedorRepo.findById(id);
  if (!proveedor) throw new AppError('Proveedor no encontrado.', 404, 'NOT_FOUND');
  return proveedor;
};

const create = async (data) => {
  const existente = await proveedorRepo.findByIdentificacion(data.identificacion);
  if (existente) {
    throw new AppError(
      `Ya existe un proveedor con la identificación "${data.identificacion}".`,
      409, 'DUPLICATE_IDENTIFICACION'
    );
  }
  return proveedorRepo.create(data);
};

const _checkDuplicateId = async (id, identificacion) => {
  if (!identificacion) return;
  const otro = await proveedorRepo.findByIdentificacion(identificacion);
  if (otro && otro.id !== id) {
    throw new AppError(
      `La identificación "${identificacion}" ya pertenece a otro proveedor.`,
      409, 'DUPLICATE_IDENTIFICACION'
    );
  }
};

const update = async (id, data) => {
  await getById(id);
  await _checkDuplicateId(id, data.identificacion);
  return proveedorRepo.update(id, data);
};

const patch = async (id, data) => {
  await getById(id);
  await _checkDuplicateId(id, data.identificacion);
  return proveedorRepo.patch(id, data);
};

const disable = async (id) => {
  await getById(id);
  return proveedorRepo.disable(id);
};

module.exports = { getAll, getById, create, update, patch, disable };
