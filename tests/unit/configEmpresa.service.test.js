'use strict';

/**
 * configEmpresa.service.test.js
 * Suite de pruebas unitarias para ConfigEmpresaService.
 * Tecnologia: Jest
 */

const { AppError } = require('../../src/middlewares/errorHandler');

// Mocks
jest.mock('../../src/repositories/configEmpresa.repository', () => ({
  get: jest.fn(),
  update: jest.fn(),
}));

const configEmpresaRepo = require('../../src/repositories/configEmpresa.repository');
const configEmpresaService = require('../../src/services/configEmpresa.service');

describe('ConfigEmpresaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    test('debe retornar la configuración de la empresa', async () => {
      const mockConfig = { id: 1, razonSocial: 'Arte Parquet G&G', ruc: '1792345678001' };
      configEmpresaRepo.get.mockResolvedValue(mockConfig);

      const result = await configEmpresaService.get();
      expect(result).toBe(mockConfig);
      expect(configEmpresaRepo.get).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('debe actualizar la configuración si todos los parámetros son válidos', async () => {
      const mockConfig = { id: 1, razonSocial: 'Arte Parquet G&G', ruc: '1792345678001', porcentajeIvaVigente: 15 };
      configEmpresaRepo.get.mockResolvedValue(mockConfig);
      configEmpresaRepo.update.mockResolvedValue({ ...mockConfig, porcentajeIvaVigente: 12 });

      const result = await configEmpresaService.update({ porcentajeIvaVigente: 12 });
      expect(result.porcentajeIvaVigente).toBe(12);
    });

    test('debe lanzar AppError 422 si el RUC está vacío', async () => {
      await expect(configEmpresaService.update({ ruc: '' })).rejects.toThrow(AppError);
      await expect(configEmpresaService.update({ ruc: '   ' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 422 si la razón social está vacía', async () => {
      await expect(configEmpresaService.update({ razonSocial: '' })).rejects.toThrow(AppError);
    });

    test('debe lanzar AppError 422 si el porcentaje de IVA es inválido (menor a 0 o mayor a 100)', async () => {
      await expect(configEmpresaService.update({ porcentajeIvaVigente: -5 })).rejects.toThrow(AppError);
      await expect(configEmpresaService.update({ porcentajeIvaVigente: 105 })).rejects.toThrow(AppError);
      await expect(configEmpresaService.update({ porcentajeIvaVigente: 'invalido' })).rejects.toThrow(AppError);
    });
  });
});
