/**
 * Router principal - Proformax API v1
 */

'use strict';

const { Router } = require('express');

const authRoutes      = require('./auth.routes');
const usuarioRoutes   = require('./usuario.routes');
const productoRoutes  = require('./producto.routes');
const proformaRoutes  = require('./proforma.routes');
const proveedorRoutes = require('./proveedor.routes');
const clienteRoutes   = require('./cliente.routes');
const configRoutes    = require('./config.routes');
const facturaRoutes   = require('./factura.routes');
const reporteRoutes   = require('./reporte.routes');

const router = Router();

router.use('/auth',        authRoutes);
router.use('/usuarios',    usuarioRoutes);
router.use('/productos',   productoRoutes);
router.use('/proformas',   proformaRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/clientes',    clienteRoutes);
router.use('/config',      configRoutes);
router.use('/facturas',    facturaRoutes);
router.use('/reportes',    reporteRoutes);

module.exports = router;

