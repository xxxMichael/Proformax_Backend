/**
 * ConfigEmpresaController — Controlador HTTP para configuración de empresa
 */

'use strict';

const configEmpresaService = require('../services/configEmpresa.service');

/**
 * GET /api/v1/config
 * Devuelve la configuración completa de la empresa.
 * No requiere parámetros — siempre es el único registro.
 */
const get = async (_req, res, next) => {
  try {
    const data = await configEmpresaService.get();
    return res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/v1/config
 * Actualización parcial: solo los campos enviados en el body son modificados.
 */
const update = async (req, res, next) => {
  try {
    const data = await configEmpresaService.update(req.body);
    return res.status(200).json({
      success: true,
      data,
      message: 'Configuración de empresa actualizada correctamente.',
    });
  } catch (err) { next(err); }
};

module.exports = { get, update };
