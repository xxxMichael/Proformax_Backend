/**
 * Proformax Backend - Entry Point
 * Arte Parquet G&G
 */

'use strict';

require('dotenv').config();

const app    = require('./app');
const logger = require('./config/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Proformax API corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`📌 Docs: http://localhost:${PORT}/api/v1/health`);
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`📴 Señal ${signal} recibida. Cerrando servidor...`);
  server.close(() => {
    logger.info('✅ Servidor cerrado correctamente.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('❌ Promesa rechazada sin manejar:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('❌ Excepción no capturada:', err);
  process.exit(1);
});
