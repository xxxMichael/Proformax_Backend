/**
 * ProductoRepository - Capa de acceso a datos para Productos/Inventario
 */

'use strict';

const prisma = require('../config/database');

const findAll = ({ skip = 0, take = 20, categoriaId, activo, search } = {}) =>
  prisma.producto.findMany({
    where: {
      ...(categoriaId !== undefined && { categoriaId }),
      ...(activo      !== undefined && { activo }),
      ...(search && {
        OR: [
          { nombre:  { contains: search, mode: 'insensitive' } },
          { codigo:  { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: { categoria: { select: { id: true, nombre: true } }, proveedor: { select: { id: true, razonSocial: true } } },
    orderBy: { nombre: 'asc' },
    skip,
    take,
  });

const count = ({ categoriaId, activo, search } = {}) =>
  prisma.producto.count({
    where: {
      ...(categoriaId !== undefined && { categoriaId }),
      ...(activo      !== undefined && { activo }),
      ...(search && {
        OR: [
          { nombre:  { contains: search, mode: 'insensitive' } },
          { codigo:  { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
  });

const findById = (id) =>
  prisma.producto.findUnique({
    where:   { id },
    include: { categoria: true, proveedor: true },
  });

const findByCodigo = (codigo) => prisma.producto.findUnique({ where: { codigo } });

const create = (data) => prisma.producto.create({ data });

const update = (id, data) => prisma.producto.update({ where: { id }, data });

const updateStock = (id, cantidad, tipo) =>
  prisma.producto.update({
    where: { id },
    data:  {
      stock: tipo === 'ENTRADA'
        ? { increment: cantidad }
        : { decrement: cantidad },
    },
  });

const softDelete = (id) =>
  prisma.producto.update({ where: { id }, data: { activo: false } });

const findLowStock = () =>
  prisma.producto.findMany({
    where: {
      activo:     true,
      stock:      { lte: prisma.producto.fields.stockMinimo },
    },
  });

module.exports = { findAll, count, findById, findByCodigo, create, update, updateStock, softDelete, findLowStock };
