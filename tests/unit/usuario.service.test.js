'use strict';

/**
 * usuario.service.test.js
 * Suite de pruebas unitarias para UsuarioService.
 * Tecnologia: Jest
 */

const { AppError } = require('../../src/middlewares/errorHandler');

// Mocks
jest.mock('../../src/repositories/usuario.repository', () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findById: jest.fn(),
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../../src/services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('mocked_hash_value'),
}));

const usuarioRepo = require('../../src/repositories/usuario.repository');
const authServiceMock = require('../../src/services/auth.service');
const usuarioService = require('../../src/services/usuario.service');

describe('UsuarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    test('debe retornar lista de usuarios con paginación', async () => {
      usuarioRepo.findAll.mockResolvedValue([]);
      usuarioRepo.count.mockResolvedValue(0);

      const result = await usuarioService.getAll();
      expect(result.page).toBe(1);
      expect(result.data).toEqual([]);
    });
  });

  describe('getById', () => {
    test('debe retornar el usuario si existe y el id es válido', async () => {
      const mockUser = { id: 1, username: 'admin' };
      usuarioRepo.findById.mockResolvedValue(mockUser);

      const result = await usuarioService.getById(1);
      expect(result).toBe(mockUser);
    });

    test('debe lanzar AppError 400 si el ID es inválido', async () => {
      await expect(usuarioService.getById('invalido')).rejects.toThrow(AppError);
      await expect(usuarioService.getById(-1)).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 404 si el usuario no existe', async () => {
      usuarioRepo.findById.mockResolvedValue(null);
      await expect(usuarioService.getById(99)).rejects.toThrow(AppError);
    });
  });

  describe('create', () => {
    test('debe crear el usuario correctamente', async () => {
      const mockData = { username: 'testuser', password: 'password123', email: 'test@proformax.com', rol: 'ADMIN' };
      usuarioRepo.findByUsername.mockResolvedValue(null);
      usuarioRepo.findByEmail.mockResolvedValue(null);
      usuarioRepo.create.mockResolvedValue({ id: 1, username: 'testuser', email: 'test@proformax.com', rol: 'ADMIN' });

      const result = await usuarioService.create(mockData);

      expect(authServiceMock.hashPassword).toHaveBeenCalledWith('password123');
      expect(usuarioRepo.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'mocked_hash_value',
        rol: 'ADMIN',
        estado: true,
        email: 'test@proformax.com',
      });
      expect(result.id).toBe(1);
    });

    test('debe lanzar AppError 422 si no se envía username', async () => {
      await expect(usuarioService.create({ password: '123' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 409 si el username ya está en uso', async () => {
      usuarioRepo.findByUsername.mockResolvedValue({ id: 1, username: 'existing' });
      await expect(usuarioService.create({ username: 'existing', password: '123' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 422 si el email está mal formateado', async () => {
      await expect(
        usuarioService.create({ username: 'user', password: '123', email: 'correo_invalido' })
      ).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 409 si el email ya está en uso', async () => {
      usuarioRepo.findByUsername.mockResolvedValue(null);
      usuarioRepo.findByEmail.mockResolvedValue({ id: 2, email: 'dup@mail.com' });

      await expect(
        usuarioService.create({ username: 'user', password: '123', email: 'dup@mail.com' })
      ).rejects.toThrow(AppError);
    });
  });

  describe('update', () => {
    test('debe actualizar el usuario correctamente', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1 });
      usuarioRepo.findByUsername.mockResolvedValue(null);
      usuarioRepo.findByEmail.mockResolvedValue(null);
      usuarioRepo.update.mockResolvedValue({ id: 1, username: 'newuser' });

      const result = await usuarioService.update(1, { username: 'newuser', email: 'new@mail.com', password: 'newpassword' });
      expect(result.username).toBe('newuser');
    });

    test('debe permitir borrar el email', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1 });
      usuarioRepo.update.mockResolvedValue({ id: 1, email: null });

      const result = await usuarioService.update(1, { email: '' });
      expect(result.email).toBeNull();
    });

    test('debe lanzar AppError 409 si el nuevo username está en uso', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1 });
      usuarioRepo.findByUsername.mockResolvedValue({ id: 2, username: 'other' });

      await expect(usuarioService.update(1, { username: 'other' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 422 si el email a actualizar es inválido', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1 });

      await expect(usuarioService.update(1, { email: 'malformado' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 409 si el nuevo email ya está en uso por otro', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1 });
      usuarioRepo.findByEmail.mockResolvedValue({ id: 2, email: 'other@mail.com' });

      await expect(usuarioService.update(1, { email: 'other@mail.com' })).rejects.toThrow(AppError);
    });
  });

  describe('changeStatus', () => {
    test('debe cambiar el estado del usuario exitosamente', async () => {
      usuarioRepo.findById.mockResolvedValue({ id: 1, estado: true });
      usuarioRepo.updateStatus.mockResolvedValue({ id: 1, estado: false });

      const result = await usuarioService.changeStatus(1, false, 2);
      expect(result.estado).toBe(false);
    });

    test('debe lanzar AppError 400 si el estado no es booleano', async () => {
      await expect(usuarioService.changeStatus(1, 'invalido', 2)).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 400 si el usuario intenta desactivarse a sí mismo', async () => {
      await expect(usuarioService.changeStatus(1, false, 1)).rejects.toThrow(AppError);
    });
  });
});
