/**
 * ProductoService — Lógica de negocio para productos/servicios
 */

'use strict';

const productoRepo = require('../repositories/producto.repository');
const { AppError } = require('../middlewares/errorHandler');

const getAll = async ({ page = 1, limit = 20, search, tipo, estado } = {}) => {
  const skip = (page - 1) * limit;

  // Convertir estado de string a boolean si viene de query string
  let estadoBool;
  if (estado === 'true')  estadoBool = true;
  if (estado === 'false') estadoBool = false;
  if (typeof estado === 'boolean') estadoBool = estado;

  const [data, total] = await Promise.all([
    productoRepo.findAll({ skip, take: limit, search, tipo, estado: estadoBool }),
    productoRepo.count({ search, tipo, estado: estadoBool }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const producto = await productoRepo.findById(id);
  if (!producto) throw new AppError('Producto no encontrado.', 404, 'NOT_FOUND');
  return producto;
};

const create = async (data) => {
  if (data.tipo) data.tipo = data.tipo.toUpperCase();
  
  const existente = await productoRepo.findByCodigo(data.codigo);
  if (existente) {
    throw new AppError(
      `Ya existe un producto con el código "${data.codigo}".`,
      409, 'DUPLICATE_CODIGO'
    );
  }
  return productoRepo.create(data);
};

const update = async (id, data) => {
  if (data.tipo) data.tipo = data.tipo.toUpperCase();
  
  await getById(id);

  if (data.codigo) {
    const otro = await productoRepo.findByCodigo(data.codigo);
    if (otro && otro.id !== id) {
      throw new AppError(
        `El código "${data.codigo}" ya está en uso por otro producto.`,
        409, 'DUPLICATE_CODIGO'
      );
    }
  }

  return productoRepo.update(id, data);
};

const patch = async (id, data) => {
  if (data.tipo) data.tipo = data.tipo.toUpperCase();
  
  await getById(id);

  if (data.codigo) {
    const otro = await productoRepo.findByCodigo(data.codigo);
    if (otro && otro.id !== id) {
      throw new AppError(
        `El código "${data.codigo}" ya está en uso por otro producto.`,
        409, 'DUPLICATE_CODIGO'
      );
    }
  }

  return productoRepo.patch(id, data);
};

const disable = async (id) => {
  await getById(id);
  return productoRepo.disable(id);
};

module.exports = { getAll, getById, create, update, patch, disable };
