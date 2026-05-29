/**
 * Proformax Backend - Bootstrap
 * Inicializa el servidor y el ciclo de vida del proceso.
 */

'use strict';

require('dotenv').config();

const ProcessLifecycle = require('./core/processLifecycle');

const lifecycle = new ProcessLifecycle();
lifecycle.registerFatalHandlers();

let logger;
try {
  logger = require('./config/logger');
  lifecycle.setLogger(logger);
} catch (err) {
  console.error(' Logger no disponible, usando consola.');
  console.error(err);
}

const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SENDGRID_API_KEY',
  'SENDGRID_FROM',
];

const missingEnv = requiredEnv.filter((key) => {
  const value = process.env[key];
  return !value || !String(value).trim();
});

if (missingEnv.length > 0) {
  lifecycle.error(` Variables de entorno faltantes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  lifecycle.info(` Proformax API corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
  lifecycle.info(` Docs: http://localhost:${PORT}/api/v1/health`);
});

lifecycle.attachServer(server);
lifecycle.registerShutdownHandlers();

module.exports = { server };
