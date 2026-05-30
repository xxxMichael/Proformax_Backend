/**
 * Proformax - Express App Configuration
 * Capa de configuración de la aplicación Express
 */

'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');

const logger          = require('./config/logger');
const errorHandler    = require('./middlewares/errorHandler');
const routes          = require('./routes');
const swaggerSpec     = require('./config/swagger');
const swaggerUi       = require('swagger-ui-express');

const app = express();

// ── Seguridad (ISO/IEC 25010 - LOPDP) ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  credentials:         true,
  methods:             ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:      ['Content-Type', 'Authorization'],
  exposedHeaders:      ['X-Total-Count'],
}));

// ── Rate Limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max:      500,
  message:  { success: false, message: 'Demasiadas peticiones. Intente más tarde.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      500,
  message:  { success: false, message: 'Demasiados intentos de autenticación. Intente más tarde.' },
});
app.use('/api/v1/auth/', authLimiter);

// ── Parsers ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ── Logging ────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Swagger / OpenAPI — disponible en /api/docs ───────────────────────────
// Se deshabilita el CSP de Helmet solo para esta ruta para que la UI cargue
app.use(
  '/api/docs',
  (_req, _res, next) => { _res.removeHeader('Content-Security-Policy'); next(); },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Proformax API Docs',
    swaggerOptions:  { persistAuthorization: true },
  })
);

// Endpoint para descargar el spec en JSON
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success:     true,
    service:     'Proformax API',
    version:     '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada.' });
});

// ── Error Handler global ───────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
