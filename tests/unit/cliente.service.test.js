'use strict';

/**
 * cliente.service.test.js
 * Suite de pruebas unitarias para ClienteService.
 * Tecnologia: Jest
 * Capa testeada: Service (getAll, getById, create, update, patch, remove)
 */

const { AppError } = require('../../src/middlewares/errorHandler');

// Mocks
jest.mock('../../src/repositories/cliente.repository', () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findByIdentificacion: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  patch: jest.fn(),
  remove: jest.fn(),
}));

const clienteRepo = require('../../src/repositories/cliente.repository');
const clienteService = require('../../src/services/cliente.service');

describe('ClienteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('debe retornar lista de clientes con total y paginación por defecto', async () => {
      const mockClientes = [{ id: 1, nombre: 'Juan Perez' }];
      clienteRepo.findAll.mockResolvedValue(mockClientes);
      clienteRepo.count.mockResolvedValue(1);

      const result = await clienteService.getAll();

      expect(clienteRepo.findAll).toHaveBeenCalledWith({ skip: 0, take: 20, search: undefined });
      expect(clienteRepo.count).toHaveBeenCalledWith({ search: undefined });
      expect(result).toEqual({
        data: mockClientes,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    test('debe respetar los parámetros de limit, page y search', async () => {
      const mockClientes = [{ id: 2, nombre: 'Ana Gómez' }];
      clienteRepo.findAll.mockResolvedValue(mockClientes);
      clienteRepo.count.mockResolvedValue(10);

      const result = await clienteService.getAll({ page: 3, limit: 3, search: 'Ana' });

      expect(clienteRepo.findAll).toHaveBeenCalledWith({ skip: 6, take: 3, search: 'Ana' });
      expect(clienteRepo.count).toHaveBeenCalledWith({ search: 'Ana' });
      expect(result.totalPages).toBe(4);
    });
  });

  describe('getById', () => {
    test('debe retornar el cliente si existe', async () => {
      const mockCliente = { id: 1, nombre: 'Juan Perez' };
      clienteRepo.findById.mockResolvedValue(mockCliente);

      const result = await clienteService.getById(1);

      expect(clienteRepo.findById).toHaveBeenCalledWith(1);
      expect(result).toBe(mockCliente);
    });

    test('debe lanzar AppError 404 si el cliente no existe', async () => {
      clienteRepo.findById.mockResolvedValue(null);

      await expect(clienteService.getById(99)).rejects.toThrow(AppError);
      await expect(clienteService.getById(99)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('create', () => {
    test('debe crear el cliente exitosamente si la identificación es única', async () => {
      const mockData = { identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findByIdentificacion.mockResolvedValue(null);
      clienteRepo.create.mockResolvedValue({ id: 1, ...mockData });

      const result = await clienteService.create(mockData);

      expect(clienteRepo.findByIdentificacion).toHaveBeenCalledWith('1722334455');
      expect(clienteRepo.create).toHaveBeenCalledWith(mockData);
      expect(result.id).toBe(1);
    });

    test('debe lanzar AppError 409 si la identificación ya existe', async () => {
      const mockData = { identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findByIdentificacion.mockResolvedValue({ id: 2, identificacion: '1722334455' });

      await expect(clienteService.create(mockData)).rejects.toThrow(AppError);
      await expect(clienteService.create(mockData)).rejects.toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_IDENTIFICACION',
      });
    });
  });

  describe('update', () => {
    test('debe actualizar el cliente si no hay conflicto de identificación', async () => {
      const mockCliente = { id: 1, identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findById.mockResolvedValue(mockCliente);
      clienteRepo.findByIdentificacion.mockResolvedValue(null);
      clienteRepo.update.mockResolvedValue({ ...mockCliente, nombre: 'Juan P.' });

      const result = await clienteService.update(1, { nombre: 'Juan P.', identificacion: '1722334466' });

      expect(clienteRepo.update).toHaveBeenCalledWith(1, { nombre: 'Juan P.', identificacion: '1722334466' });
      expect(result.nombre).toBe('Juan P.');
    });

    test('debe permitir conservar la misma identificación sin dar conflicto', async () => {
      const mockCliente = { id: 1, identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findById.mockResolvedValue(mockCliente);
      clienteRepo.findByIdentificacion.mockResolvedValue(mockCliente); // mismo cliente
      clienteRepo.update.mockResolvedValue(mockCliente);

      const result = await clienteService.update(1, { identificacion: '1722334455' });
      expect(result).toBe(mockCliente);
    });

    test('debe lanzar AppError 409 si la nueva identificación ya está en uso por otro cliente', async () => {
      const mockCliente = { id: 1, identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findById.mockResolvedValue(mockCliente);
      clienteRepo.findByIdentificacion.mockResolvedValue({ id: 2, identificacion: '1722334466' }); // otro cliente

      await expect(
        clienteService.update(1, { identificacion: '1722334466' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('patch', () => {
    test('debe parchear el cliente exitosamente', async () => {
      const mockCliente = { id: 1, identificacion: '1722334455', nombre: 'Juan Perez' };
      clienteRepo.findById.mockResolvedValue(mockCliente);
      clienteRepo.findByIdentificacion.mockResolvedValue(null);
      clienteRepo.patch.mockResolvedValue({ ...mockCliente, nombre: 'Juan Modificado' });

      const result = await clienteService.patch(1, { nombre: 'Juan Modificado' });
      expect(result.nombre).toBe('Juan Modificado');
    });

    test('debe lanzar AppError 409 si la identificación parcheada ya pertenece a otro', async () => {
      const mockCliente = { id: 1, identificacion: '1722334455' };
      clienteRepo.findById.mockResolvedValue(mockCliente);
      clienteRepo.findByIdentificacion.mockResolvedValue({ id: 2, identificacion: '1722334499' });

      await expect(
        clienteService.patch(1, { identificacion: '1722334499' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('remove', () => {
    test('debe eliminar el cliente si existe y no tiene referencias', async () => {
      clienteRepo.findById.mockResolvedValue({ id: 1 });
      clienteRepo.remove.mockResolvedValue({ id: 1 });

      const result = await clienteService.remove(1);
      expect(result).toEqual({ id: 1 });
    });

    test('debe lanzar AppError 409 si el repositorio arroja error P2003 (foreign key)', async () => {
      clienteRepo.findById.mockResolvedValue({ id: 1 });
      const error = new Error('Prisma error');
      error.code = 'P2003';
      clienteRepo.remove.mockRejectedValue(error);

      await expect(clienteService.remove(1)).rejects.toMatchObject({
        statusCode: 409,
        code: 'HAS_REFERENCES',
      });
    });

    test('debe re-lanzar otros errores genéricos del repositorio', async () => {
      clienteRepo.findById.mockResolvedValue({ id: 1 });
      const error = new Error('Generic database error');
      clienteRepo.remove.mockRejectedValue(error);

      await expect(clienteService.remove(1)).rejects.toThrow('Generic database error');
    });
  });
});
