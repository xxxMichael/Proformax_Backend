/**
 * ProformaService - Lógica de negocio central para gestión de proformas
 * Incluye: numeración automática, cálculo de totales, cambio de estado y exportación PDF
 */

'use strict';

const proformaRepo = require('../repositories/proforma.repository');
const prisma       = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const logger       = require('../config/logger');

const TRANSITIONS = {
  EMITIDA:  ['ACEPTADA', 'ANULADA'],
  ACEPTADA: [],
  ANULADA:  [],
};

/**
 * Genera el próximo número de proforma (PRF-YYYYMM-NNN)
 */
const generateNumero = async () => {
  const now    = new Date();
  const prefix = `PRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

  const last = await prisma.proforma.findFirst({
    where:   { numeroProforma: { startsWith: prefix } },
    orderBy: { numeroProforma: 'desc' },
  });

  const seq = last
    ? String(parseInt(last.numeroProforma.split('-').pop(), 10) + 1).padStart(4, '0')
    : '0001';

  return `${prefix}${seq}`;
};

/**
 * Calcula los totales de una proforma basándose en sus detalles y la tasa IVA
 */
const calcularTotales = (detalles, tasaIva = 0.15, descuentoGlobal = 0) => {
  let subtotalGravado = 0;
  let subtotalExento  = 0;

  detalles.forEach((d) => {
    const linea = d.cantidad * d.precioUnitario * (1 - (d.descuento || 0) / 100);
    const aplicaIva = d.aplicaIva !== undefined ? d.aplicaIva : true;
    if (aplicaIva) subtotalGravado += linea;
    else           subtotalExento  += linea;
  });

  const subtotal  = subtotalGravado + subtotalExento - descuentoGlobal;
  const baseIva   = subtotalGravado;
  const valorIva  = baseIva * tasaIva;
  const total     = subtotal + valorIva;

  return {
    subtotal:       Math.round(subtotal  * 100) / 100,
    descuento:      Math.round(descuentoGlobal * 100) / 100,
    baseIva:        Math.round(baseIva   * 100) / 100,
    valorIva:       Math.round(valorIva  * 100) / 100,
    total:          Math.round(total     * 100) / 100,
  };
};

const getAll = async (filtros) => {
  const { page = 1, limit = 20, ...where } = filtros;
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    proformaRepo.findAll({ skip, take: limit, ...where }),
    proformaRepo.count(where),
  ]);
  return { data, total, page, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const proforma = await proformaRepo.findById(id);
  if (!proforma) throw new AppError('Proforma no encontrada.', 404, 'NOT_FOUND');
  return proforma;
};

const create = async (body, usuarioId) => {
  const { detalles, porcentajeDescuento = 0, fechaValidez, clienteId, observaciones } = body;

  if (!detalles?.length) throw new AppError('La proforma debe tener al menos un ítem.', 400, 'EMPTY_DETAILS');

  const config    = await prisma.configuracionEmpresa.findFirst();
  const tasaIva   = config?.porcentajeIvaVigente ? parseFloat(config.porcentajeIvaVigente) / 100 : 0.15;
  const numero    = await generateNumero();
  const totales   = calcularTotales(detalles, tasaIva, porcentajeDescuento);

  const proforma = await proformaRepo.create({
    numeroProforma: numero,
    clienteId,
    usuarioId,
    fechaValidez: new Date(fechaValidez),
    subtotalSinIva: totales.subtotal,
    porcentajeDescuento: porcentajeDescuento,
    totalDescuento: totales.descuento,
    totalIva: totales.valorIva,
    totalFinal: totales.total,
    observaciones,
    detalles: {
      create: detalles.map((d) => ({
        productoServicioId: d.productoServicioId,
        cantidad:       d.cantidad,
        precioUnitario: d.precioUnitario,
        subtotal:       d.cantidad * d.precioUnitario * (1 - (d.descuento || 0) / 100),
      })),
    },
  });

  logger.info(`[Proforma] Creada: ${numero} por usuario ${usuarioId}`);
  return proforma;
};

const update = async (id, body, usuarioId) => {
  const proforma = await getById(id);
  if (proforma.estado !== 'EMITIDA') throw new AppError('Solo se pueden editar proformas en estado EMITIDA.', 400, 'INVALID_STATE');

  const { detalles, porcentajeDescuento, fechaValidez, observaciones } = body;
  const config  = await prisma.configuracionEmpresa.findFirst();
  const tasaIva = config?.porcentajeIvaVigente ? parseFloat(config.porcentajeIvaVigente) / 100 : 0.15;

  const totales = detalles ? calcularTotales(detalles, tasaIva, porcentajeDescuento || 0) : {};

  return proformaRepo.update(id, {
    ...(observaciones !== undefined && { observaciones }),
    ...(fechaValidez && { fechaValidez: new Date(fechaValidez) }),
    ...(porcentajeDescuento !== undefined && { porcentajeDescuento: porcentajeDescuento }),
    ...(detalles && {
      subtotalSinIva: totales.subtotal,
      totalDescuento: totales.descuento,
      totalIva: totales.valorIva,
      totalFinal: totales.total,
      detalles: {
        deleteMany: {},
        create: detalles.map((d) => ({
          productoServicioId: d.productoServicioId,
          cantidad:       d.cantidad,
          precioUnitario: d.precioUnitario,
          subtotal:       d.cantidad * d.precioUnitario * (1 - (d.descuento || 0) / 100),
        })),
      },
    }),
  });
};

const changeStatus = async (id, nuevoEstado, motivo) => {
  const proforma = await getById(id);
  const allowed  = TRANSITIONS[proforma.estado];

  if (!allowed.includes(nuevoEstado)) {
    throw new AppError(
      `No se puede cambiar de estado ${proforma.estado} a ${nuevoEstado}.`,
      400,
      'INVALID_TRANSITION'
    );
  }

  const updated = await proformaRepo.changeStatus(id, nuevoEstado, motivo, proforma.estado);
  logger.info(`[Proforma] ${proforma.numeroProforma}: ${proforma.estado} → ${nuevoEstado}`);
  return updated;
};

module.exports = { getAll, getById, create, update, changeStatus, calcularTotales, generateNumero };
