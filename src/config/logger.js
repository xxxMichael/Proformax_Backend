/**
 * Configuración centralizada de Winston Logger
 * Cumple con trazabilidad de eventos (ISO/IEC 25010 - LOPDP)
 */

'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR   = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `[${ts}] ${level.toUpperCase()}: ${stack || message}`;
});

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    }),
    new DailyRotateFile({
      dirname:       path.join(LOG_DIR, 'error'),
      filename:      'error-%DATE%.log',
      datePattern:   'YYYY-MM-DD',
      level:         'error',
      maxFiles:      '30d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      dirname:       path.join(LOG_DIR, 'combined'),
      filename:      'combined-%DATE%.log',
      datePattern:   'YYYY-MM-DD',
      maxFiles:      '14d',
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log'),
    }),
  ],
});

module.exports = logger;
