/**
 * ConfigEmpresaRepository — Acceso a datos para `configuracion_empresa`
 *
 * Regla de negocio: SIEMPRE existe un único registro (id = 1).
 * No se crean ni eliminan registros — solo se lee y actualiza.
 *
 * Campos reales (Prisma / BD):
 *   id, ruc, razonSocial (razon_social), direccion, telefono,
 *   email, porcentajeIvaVigente (porcentaje_iva_vigente)
 */

'use strict';

const prisma = require('../config/database');

/** ID fijo del único registro de la empresa */
const EMPRESA_ID = 1;

/**
 * Obtiene la configuración de la empresa.
 * Si no existe el registro aún, lo crea con valores por defecto.
 */
const get = () =>
  prisma.configuracionEmpresa.upsert({
    where:  { id: EMPRESA_ID },
    update: {},                  // nada que actualizar — solo asegurar existencia
    create: {
      id:                   EMPRESA_ID,
      ruc:                  '0000000000001',
      razonSocial:          'Arte Parquet G&G',
      porcentajeIvaVigente: 15.00,
    },
  });

/**
 * Actualiza los campos enviados (patch parcial).
 * Solo toca los campos presentes en `data`.
 */
const update = (data) => {
  const payload = {};
  if (data.ruc                  !== undefined) payload.ruc                  = data.ruc;
  if (data.razonSocial          !== undefined) payload.razonSocial          = data.razonSocial;
  if (data.direccion            !== undefined) payload.direccion            = data.direccion;
  if (data.telefono             !== undefined) payload.telefono             = data.telefono;
  if (data.email                !== undefined) payload.email                = data.email;
  if (data.porcentajeIvaVigente !== undefined) payload.porcentajeIvaVigente = data.porcentajeIvaVigente;

  return prisma.configuracionEmpresa.update({
    where: { id: EMPRESA_ID },
    data:  payload,
  });
};

module.exports = { get, update, EMPRESA_ID };
