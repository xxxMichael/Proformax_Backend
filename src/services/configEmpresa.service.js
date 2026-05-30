/**
 * ConfigEmpresaService — Lógica de negocio para configuración de empresa
 *
 * Reglas:
 * - Solo existe UN registro (id = 1).
 * - El RUC no puede quedar vacío.
 * - La razón social no puede quedar vacía.
 * - porcentajeIvaVigente debe ser un número entre 0 y 100.
 */

'use strict';

const configEmpresaRepo = require('../repositories/configEmpresa.repository');
const { AppError }      = require('../middlewares/errorHandler');

/** Obtiene la conf. de la empresa (garantiza existencia del registro) */
const get = () => configEmpresaRepo.get();

/** Actualiza parcialmente los campos enviados */
const update = async (data) => {
  // Validaciones de negocio
  if (data.ruc !== undefined && !data.ruc?.toString().trim()) {
    throw new AppError('El RUC no puede estar vacío.', 422, 'VALIDATION_ERROR');
  }

  if (data.razonSocial !== undefined && !data.razonSocial?.toString().trim()) {
    throw new AppError('La razón social no puede estar vacía.', 422, 'VALIDATION_ERROR');
  }

  if (data.porcentajeIvaVigente !== undefined) {
    const pct = parseFloat(data.porcentajeIvaVigente);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      throw new AppError('El porcentaje de IVA debe estar entre 0 y 100.', 422, 'VALIDATION_ERROR');
    }
    data.porcentajeIvaVigente = pct;
  }

  // Asegurar que el registro existe antes de actualizar
  await configEmpresaRepo.get();

  return configEmpresaRepo.update(data);
};

module.exports = { get, update };
