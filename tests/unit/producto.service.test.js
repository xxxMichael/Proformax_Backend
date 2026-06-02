'use strict';

/**
 * producto.service.test.js
 * Suite de pruebas unitarias para ProductoService.
 * Tecnologia: Jest
 * Capa testeada: Service (getAll, getById, create, update, patch, disable)
 */

const { AppError } = require('../../src/middlewares/errorHandler');

// Mocks
jest.mock('../../src/repositories/producto.repository', () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findByCodigo: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  patch: jest.fn(),
  disable: jest.fn(),
}));

const productoRepo = require('../../src/repositories/producto.repository');
const productoService = require('../../src/services/producto.service');

describe('ProductoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('debe retornar lista de productos y mapear estados en string a boolean', async () => {
      productoRepo.findAll.mockResolvedValue([]);
      productoRepo.count.mockResolvedValue(0);

      const resultStringTrue = await productoService.getAll({ estado: 'true' });
      expect(productoRepo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        tipo: undefined,
        estado: true,
      });

      const resultStringFalse = await productoService.getAll({ estado: 'false' });
      expect(productoRepo.findAll).toHaveBeenLastCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        tipo: undefined,
        estado: false,
      });

      const resultBool = await productoService.getAll({ estado: true });
      expect(productoRepo.findAll).toHaveBeenLastCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        tipo: undefined,
        estado: true,
      });
    });
  });

  describe('getById', () => {
    test('debe retornar el producto si existe', async () => {
      const mockProducto = { id: 1, nombre: 'Parquet Eucalipto' };
      productoRepo.findById.mockResolvedValue(mockProducto);

      const result = await productoService.getById(1);
      expect(result).toBe(mockProducto);
    });

    test('debe lanzar AppError 404 si el producto no existe', async () => {
      productoRepo.findById.mockResolvedValue(null);
      await expect(productoService.getById(99)).rejects.toThrow(AppError);
    });
  });

  describe('create', () => {
    test('debe crear el producto con tipo en mayúsculas', async () => {
      const mockData = { codigo: 'PRD-001', tipo: 'servicio', nombre: 'Instalación' };
      productoRepo.findByCodigo.mockResolvedValue(null);
      productoRepo.create.mockResolvedValue({ id: 1, ...mockData, tipo: 'SERVICIO' });

      const result = await productoService.create(mockData);

      expect(productoRepo.findByCodigo).toHaveBeenCalledWith('PRD-001');
      expect(productoRepo.create).toHaveBeenCalledWith({ ...mockData, tipo: 'SERVICIO' });
      expect(result.tipo).toBe('SERVICIO');
    });

    test('debe lanzar AppError 409 si el código del producto ya existe', async () => {
      const mockData = { codigo: 'PRD-001' };
      productoRepo.findByCodigo.mockResolvedValue({ id: 2, codigo: 'PRD-001' });

      await expect(productoService.create(mockData)).rejects.toThrow(AppError);
    });
  });

  describe('update', () => {
    test('debe actualizar el producto exitosamente', async () => {
      const mockProducto = { id: 1, codigo: 'PRD-001', tipo: 'PRODUCTO' };
      productoRepo.findById.mockResolvedValue(mockProducto);
      productoRepo.findByCodigo.mockResolvedValue(null);
      productoRepo.update.mockResolvedValue({ ...mockProducto, tipo: 'SERVICIO' });

      const result = await productoService.update(1, { tipo: 'servicio', codigo: 'PRD-002' });

      expect(productoRepo.update).toHaveBeenCalledWith(1, { tipo: 'SERVICIO', codigo: 'PRD-002' });
      expect(result.tipo).toBe('SERVICIO');
    });

    test('debe lanzar AppError 409 si el código modificado pertenece a otro producto', async () => {
      productoRepo.findById.mockResolvedValue({ id: 1 });
      productoRepo.findByCodigo.mockResolvedValue({ id: 2, codigo: 'PRD-X' });

      await expect(
        productoService.update(1, { codigo: 'PRD-X' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('patch', () => {
    test('debe parchear el producto exitosamente', async () => {
      productoRepo.findById.mockResolvedValue({ id: 1 });
      productoRepo.findByCodigo.mockResolvedValue(null);
      productoRepo.patch.mockResolvedValue({ id: 1, codigo: 'PRD-PATCH' });

      const result = await productoService.patch(1, { codigo: 'PRD-PATCH' });
      expect(result.codigo).toBe('PRD-PATCH');
    });

    test('debe lanzar AppError 409 al parchear si el código ya pertenece a otro', async () => {
      productoRepo.findById.mockResolvedValue({ id: 1 });
      productoRepo.findByCodigo.mockResolvedValue({ id: 2, codigo: 'PRD-X' });

      await expect(
        productoService.patch(1, { codigo: 'PRD-X' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('disable', () => {
    test('debe deshabilitar el producto exitosamente', async () => {
      productoRepo.findById.mockResolvedValue({ id: 1, estado: true });
      productoRepo.disable.mockResolvedValue({ id: 1, estado: false });

      const result = await productoService.disable(1);
      expect(result.estado).toBe(false);
    });
  });
});
