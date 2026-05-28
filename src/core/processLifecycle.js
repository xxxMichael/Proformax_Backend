/**
 * Process lifecycle guards for fatal errors and shutdown.
 */

'use strict';

class ProcessLifecycle {
  constructor({ logger } = {}) {
    this.logger = logger || null;
    this.server = null;
  }

  setLogger(logger) {
    this.logger = logger || null;
  }

  registerFatalHandlers() {
    process.on('unhandledRejection', (reason) => {
      this.logFatal('❌ Promesa rechazada sin manejar', reason);
      this.exitProcess(1);
    });

    process.on('uncaughtException', (err) => {
      this.logFatal('❌ Excepción no capturada', err);
      this.exitProcess(1);
    });
  }

  registerShutdownHandlers() {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT',  () => this.shutdown('SIGINT'));
  }

  attachServer(server) {
    this.server = server;
    if (server && typeof server.on === 'function') {
      server.on('error', (err) => {
        this.logFatal('Error al iniciar el servidor', err);
        this.exitProcess(1);
      });
    }
  }

  shutdown(signal) {
    this.info(`Señal ${signal} recibida. Cerrando servidor...`);
    if (!this.server) return process.exit(0);
    this.server.close(() => {
      this.info('Servidor cerrado correctamente.');
      process.exit(0);
    });
  }

  info(...args) {
    this.write('info', console.log, ...args);
  }

  warn(...args) {
    this.write('warn', console.warn, ...args);
  }

  error(...args) {
    this.write('error', console.error, ...args);
  }

  write(level, fallback, ...args) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](...args);
      return;
    }
    fallback(...args);
  }

  logFatal(label, err) {
    const error = this.toError(err);
    this.error(`${label}: ${error.message}`);
    if (error.stack) this.error(error.stack);
  }

  exitProcess(code = 1) {
    if (this.server && this.server.listening) {
      this.server.close(() => process.exit(code));
      return;
    }
    process.exit(code);
  }

  toError(value) {
    if (value instanceof Error) return value;
    if (typeof value === 'string') return new Error(value);
    try {
      return new Error(JSON.stringify(value));
    } catch (_err) {
      return new Error(String(value));
    }
  }
}

module.exports = ProcessLifecycle;
