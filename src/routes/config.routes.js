/**
 * Rutas de Configuración de Empresa
 * Tabla: configuracion_empresa — registro único (id = 1)
 *
 * @swagger
 * tags:
 *   name: Configuración
 *   description: Configuración de la empresa (datos, IVA). Registro único.
 */

'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const configEmpresaController         = require('../controllers/configEmpresa.controller');
const { authenticate, authorize }     = require('../middlewares/auth');
const { validate }                    = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

const patchRules = [
  body('ruc').optional().trim().notEmpty().withMessage('El RUC no puede estar vacío.').isLength({ max: 20 }),
  body('razonSocial').optional().trim().notEmpty().withMessage('La razón social no puede estar vacía.').isLength({ max: 150 }),
  body('direccion').optional({ nullable: true, checkFalsy: true }).isString(),
  body('telefono').optional({ nullable: true, checkFalsy: true }).isLength({ max: 20 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().isLength({ max: 100 }),
  body('porcentajeIvaVigente').optional().isFloat({ min: 0, max: 100 })
    .withMessage('El porcentaje de IVA debe estar entre 0 y 100.'),
  validate,
];

/**
 * @swagger
 * /config:
 *   get:
 *     tags: [Configuración]
 *     summary: Obtener configuración de empresa
 *     description: >
 *       Devuelve los datos de la empresa (RUC, razón social, IVA vigente, etc.).
 *       Disponible para cualquier usuario autenticado ya que se necesita para
 *       calcular IVA en proformas y mostrar datos en PDFs.
 *     responses:
 *       200:
 *         description: Configuración actual de la empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/ConfigEmpresa'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', configEmpresaController.get);

/**
 * @swagger
 * /config:
 *   patch:
 *     tags: [Configuración]
 *     summary: Actualizar configuración de empresa (parcial)
 *     description: >
 *       Solo ADMIN. Enviar únicamente los campos a modificar.
 *       `porcentajeIvaVigente` es el porcentaje (ej. 15 para 15%, no 0.15).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigEmpresaUpdate'
 *           examples:
 *             cambioIVA:
 *               summary: Solo actualizar el IVA
 *               value: { porcentajeIvaVigente: 15.00 }
 *             datosCompletos:
 *               summary: Actualizar datos completos
 *               value:
 *                 ruc: "1234567890001"
 *                 razonSocial: "Arte Parquet G&G"
 *                 direccion: "Av. Principal 123, Quito"
 *                 telefono: "+593 99 999 9999"
 *                 email: "info@arteparquet.com"
 *                 porcentajeIvaVigente: 15.00
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/ConfigEmpresa'
 *                 message: { type: string }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.patch('/', authorize('ADMIN', 'vendedor'), patchRules, configEmpresaController.update);

/**
 * @swagger
 * /config:
 *   put:
 *     tags: [Configuración]
 *     summary: Actualizar configuración de empresa (alias de PATCH)
 *     description: Idéntico a PATCH. Incluido por compatibilidad.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigEmpresaUpdate'
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/', authorize('ADMIN', 'vendedor'), patchRules, configEmpresaController.update);

module.exports = router;
