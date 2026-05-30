/**
 * ClienteService - Lógica de negocio para la gestión de clientes
 * Valida unicidad de identificación y maneja errores de negocio
 */

'use strict';

const clienteRepo       = require('../repositories/cliente.repository');
const { AppError }      = require('../middlewares/errorHandler');

// ── Paginado ───────────────────────────────────────────────────────────────

const getAll = async ({ page = 1, limit = 20, search } = {}) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    clienteRepo.findAll({ skip, take: limit, search }),
    clienteRepo.count({ search }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// ── Por ID ─────────────────────────────────────────────────────────────────

const getById = async (id) => {
  const cliente = await clienteRepo.findById(id);
  if (!cliente) throw new AppError('Cliente no encontrado.', 404, 'NOT_FOUND');
  return cliente;
};

// ── Crear ──────────────────────────────────────────────────────────────────

const create = async (data) => {
  // Verificar unicidad de identificación
  const existente = await clienteRepo.findByIdentificacion(data.identificacion);
  if (existente) {
    throw new AppError(
      `Ya existe un cliente con la identificación "${data.identificacion}".`,
      409,
      'DUPLICATE_IDENTIFICACION'
    );
  }

  return clienteRepo.create(data);
};

// ── Actualizar ─────────────────────────────────────────────────────────────

const update = async (id, data) => {
  // Asegurar que el cliente existe
  await getById(id);

  // Si cambia la identificación, verificar que no esté en uso por otro cliente
  if (data.identificacion) {
    const otro = await clienteRepo.findByIdentificacion(data.identificacion);
    if (otro && otro.id !== id) {
      throw new AppError(
        `La identificación "${data.identificacion}" ya pertenece a otro cliente.`,
        409,
        'DUPLICATE_IDENTIFICACION'
      );
    }
  }

  return clienteRepo.update(id, data);
};

// ── Actualizar parcial (PATCH) ─────────────────────────────────────────────

const patch = async (id, data) => {
  await getById(id);

  if (data.identificacion) {
    const otro = await clienteRepo.findByIdentificacion(data.identificacion);
    if (otro && otro.id !== id) {
      throw new AppError(
        `La identificación "${data.identificacion}" ya pertenece a otro cliente.`,
        409,
        'DUPLICATE_IDENTIFICACION'
      );
    }
  }

  return clienteRepo.patch(id, data);
};

// ── Eliminar ───────────────────────────────────────────────────────────────

const remove = async (id) => {
  await getById(id);

  // Verificar si el cliente tiene proformas anteriores (integridad referencial)
  try {
    return await clienteRepo.remove(id);
  } catch (err) {
    // P2003 = Foreign key constraint failed
    if (err.code === 'P2003') {
      throw new AppError(
        'No se puede eliminar el cliente porque tiene proformas asociadas.',
        409,
        'HAS_REFERENCES'
      );
    }
    throw err;
  }
};

module.exports = { getAll, getById, create, update, patch, remove };
