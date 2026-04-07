/**
 * Singleton de Prisma Client
 * Proformax - Arte Parquet G&G
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const logger           = require('./logger');

const prisma = global.__prisma || new PrismaClient({
  log: [
    { emit: 'event', level: 'query'  },
    { emit: 'event', level: 'error'  },
    { emit: 'event', level: 'warn'   },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    logger.debug(`[Prisma Query] ${e.query} | Params: ${e.params} | ${e.duration}ms`);
  });
}

prisma.$on('error', (e) => {
  logger.error(`[Prisma Error] ${e.message}`);
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
