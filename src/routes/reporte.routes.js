'use strict';

const { Router } = require('express');
const { query } = require('express-validator');

const reporteController = require('../controllers/reporte.controller');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Reportes
 *   description: Indicadores y reportes operativos del sistema
 */

const dateRangeValidation = [
  query('fechaDesde').optional().isISO8601().withMessage('fechaDesde debe tener formato ISO 8601.'),
  query('fechaHasta').optional().isISO8601().withMessage('fechaHasta debe tener formato ISO 8601.'),
  validate,
];

const proformasValidation = [
  query('estado').optional().isIn(['EMITIDA', 'ACEPTADA', 'ANULADA']).withMessage('Estado inválido.'),
  query('clienteId').optional().isInt({ gt: 0 }).withMessage('clienteId debe ser un entero positivo.'),
  query('usuarioId').optional().isInt({ gt: 0 }).withMessage('usuarioId debe ser un entero positivo.'),
  ...dateRangeValidation.slice(0, 2),
  validate,
];

const topValidation = [
  query('clienteId').optional().isInt({ gt: 0 }).withMessage('clienteId debe ser un entero positivo.'),
  query('usuarioId').optional().isInt({ gt: 0 }).withMessage('usuarioId debe ser un entero positivo.'),
  query('limit').optional().isInt({ gt: 0 }).withMessage('limit debe ser un entero positivo.'),
  ...dateRangeValidation.slice(0, 2),
  validate,
];

const inventarioValidation = [
  query('stockBajo').optional().isInt({ min: 0 }).withMessage('stockBajo debe ser un entero mayor o igual a 0.'),
  query('diasSinMovimiento').optional().isInt({ min: 0 }).withMessage('diasSinMovimiento debe ser un entero mayor o igual a 0.'),
  validate,
];

const rentabilidadValidation = [
  query('agrupadoPor').optional().isIn(['producto', 'proforma']).withMessage('agrupadoPor debe ser producto o proforma.'),
  query('clienteId').optional().isInt({ gt: 0 }).withMessage('clienteId debe ser un entero positivo.'),
  query('usuarioId').optional().isInt({ gt: 0 }).withMessage('usuarioId debe ser un entero positivo.'),
  query('limit').optional().isInt({ gt: 0 }).withMessage('limit debe ser un entero positivo.'),
  ...dateRangeValidation.slice(0, 2),
  validate,
];

/**
 * @swagger
 * /reportes/proformas:
 *   get:
 *     tags: [Reportes]
 *     summary: Reporte de proformas
 *     description: Lista proformas filtradas por fechas, estado, cliente y usuario.
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema: { type: string, format: date }
 *         description: Fecha inicial del rango
 *       - in: query
 *         name: fechaHasta
 *         schema: { type: string, format: date }
 *         description: Fecha final del rango
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [EMITIDA, ACEPTADA, ANULADA]
 *         description: Filtrar por estado
 *       - in: query
 *         name: clienteId
 *         schema: { type: integer }
 *         description: Filtrar por cliente
 *       - in: query
 *         name: usuarioId
 *         schema: { type: integer }
 *         description: Filtrar por usuario
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Reporte paginado de proformas
 *         headers:
 *           X-Total-Count:
 *             schema: { type: integer }
 */
router.get('/proformas', proformasValidation, reporteController.getProformas);

/**
 * @swagger
 * /reportes/ventas-por-cliente:
 *   get:
 *     tags: [Reportes]
 *     summary: Ventas por cliente
 *     description: Resume el total aceptado por cliente, frecuencia de compra y ticket promedio.
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fechaHasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: clienteId
 *         schema: { type: integer }
 *       - in: query
 *         name: usuarioId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Ventas agrupadas por cliente
 */
router.get('/ventas-por-cliente', topValidation, reporteController.getVentasPorCliente);

/**
 * @swagger
 * /reportes/productos-mas-vendidos:
 *   get:
 *     tags: [Reportes]
 *     summary: Productos o servicios más vendidos
 *     description: Ranking por cantidad, valor y frecuencia de ventas.
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fechaHasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: clienteId
 *         schema: { type: integer }
 *       - in: query
 *         name: usuarioId
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Ranking de productos/servicios vendidos
 */
router.get('/productos-mas-vendidos', topValidation, reporteController.getProductosMasVendidos);

/**
 * @swagger
 * /reportes/inventario:
 *   get:
 *     tags: [Reportes]
 *     summary: Reporte de inventario
 *     description: Muestra stock actual, stock bajo, productos sin movimiento y alertas de reposición.
 *     parameters:
 *       - in: query
 *         name: stockBajo
 *         schema: { type: integer, minimum: 0 }
 *         description: Umbral mínimo para alertar stock bajo
 *       - in: query
 *         name: diasSinMovimiento
 *         schema: { type: integer, minimum: 0 }
 *         description: Días para considerar un producto sin movimiento
 *     responses:
 *       200:
 *         description: Estado actual del inventario
 */
router.get('/inventario', inventarioValidation, reporteController.getInventario);

/**
 * @swagger
 * /reportes/rentabilidad:
 *   get:
 *     tags: [Reportes]
 *     summary: Rentabilidad estimada
 *     description: Calcula margen bruto estimado por producto o por proforma.
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fechaHasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: agrupadoPor
 *         schema:
 *           type: string
 *           enum: [producto, proforma]
 *       - in: query
 *         name: clienteId
 *         schema: { type: integer }
 *       - in: query
 *         name: usuarioId
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Estimación de margen y costo
 */
router.get('/rentabilidad', rentabilidadValidation, reporteController.getRentabilidad);

module.exports = router;