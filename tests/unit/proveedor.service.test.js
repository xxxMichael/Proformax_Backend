'use strict';

/**
 * proveedor.service.test.js
 * Suite de pruebas unitarias para ProveedorService.
 * Tecnologia: Jest
 */

const { AppError } = require('../../src/middlewares/errorHandler');

// Mocks
jest.mock('../../src/repositories/proveedor.repository', () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findByIdentificacion: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  patch: jest.fn(),
  disable: jest.fn(),
}));

const proveedorRepo = require('../../src/repositories/proveedor.repository');
const proveedorService = require('../../src/services/proveedor.service');

describe('ProveedorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('debe retornar lista de proveedores y manejar estado en string/boolean', async () => {
      proveedorRepo.findAll.mockResolvedValue([]);
      proveedorRepo.count.mockResolvedValue(0);

      const resultStringTrue = await proveedorService.getAll({ estado: 'true' });
      expect(proveedorRepo.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        estado: true,
      });

      const resultStringFalse = await proveedorService.getAll({ estado: 'false' });
      expect(proveedorRepo.findAll).toHaveBeenLastCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        estado: false,
      });

      const resultBool = await proveedorService.getAll({ estado: true });
      expect(proveedorRepo.findAll).toHaveBeenLastCalledWith({
        skip: 0,
        take: 20,
        search: undefined,
        estado: true,
      });
    });
  });

  describe('getById', () => {
    test('debe retornar el proveedor si existe', async () => {
      const mockProveedor = { id: 1, razonSocial: 'Proveedor A' };
      proveedorRepo.findById.mockResolvedValue(mockProveedor);

      const result = await proveedorService.getById(1);
      expect(result).toBe(mockProveedor);
    });

    test('debe lanzar AppError 404 si el proveedor no existe', async () => {
      proveedorRepo.findById.mockResolvedValue(null);
      await expect(proveedorService.getById(99)).rejects.toThrow(AppError);
    });
  });

  describe('create', () => {
    test('debe crear el proveedor exitosamente', async () => {
      const mockData = { identificacion: '1792345678001', razonSocial: 'Proveedor A' };
      proveedorRepo.findByIdentificacion.mockResolvedValue(null);
      proveedorRepo.create.mockResolvedValue({ id: 1, ...mockData });

      const result = await proveedorService.create(mockData);
      expect(result.id).toBe(1);
    });

    test('debe lanzar AppError 409 si la identificación ya existe', async () => {
      const mockData = { identificacion: '1792345678001' };
      proveedorRepo.findByIdentificacion.mockResolvedValue({ id: 2, identificacion: '1792345678001' });

      await expect(proveedorService.create(mockData)).rejects.toThrow(AppError);
    });
  });

  describe('update', () => {
    test('debe actualizar el proveedor exitosamente si no hay duplicación', async () => {
      const mockProveedor = { id: 1, identificacion: '1792345678001' };
      proveedorRepo.findById.mockResolvedValue(mockProveedor);
      proveedorRepo.findByIdentificacion.mockResolvedValue(null);
      proveedorRepo.update.mockResolvedValue(mockProveedor);

      const result = await proveedorService.update(1, { razonSocial: 'Nuevo Proveedor' });
      expect(result).toBe(mockProveedor);
    });

    test('debe lanzar AppError 409 si la nueva identificación ya está en uso', async () => {
      proveedorRepo.findById.mockResolvedValue({ id: 1 });
      proveedorRepo.findByIdentificacion.mockResolvedValue({ id: 2, identificacion: '1792345678002' });

      await expect(
        proveedorService.update(1, { identificacion: '1792345678002' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('patch', () => {
    test('debe parchear el proveedor exitosamente', async () => {
      proveedorRepo.findById.mockResolvedValue({ id: 1 });
      proveedorRepo.findByIdentificacion.mockResolvedValue(null);
      proveedorRepo.patch.mockResolvedValue({ id: 1, razonSocial: 'Patched' });

      const result = await proveedorService.patch(1, { razonSocial: 'Patched' });
      expect(result.razonSocial).toBe('Patched');
    });
  });

  describe('disable', () => {
    test('debe deshabilitar el proveedor exitosamente', async () => {
      proveedorRepo.findById.mockResolvedValue({ id: 1, estado: true });
      proveedorRepo.disable.mockResolvedValue({ id: 1, estado: false });

      const result = await proveedorService.disable(1);
      expect(result.estado).toBe(false);
    });
  });
});
