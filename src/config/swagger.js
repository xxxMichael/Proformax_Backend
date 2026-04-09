/**
 * Configuracion de Swagger/OpenAPI
 */

'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Proformax API',
    version: '1.0.0',
    description: 'Documentacion interactiva para visualizar y testear endpoints de Proformax.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Servidor API v1',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Health check del servicio',
        security: [],
        responses: {
          200: { description: 'Servicio operativo' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesion',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Sesion iniciada correctamente' },
          401: { description: 'Credenciales invalidas' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesion',
        responses: {
          200: { description: 'Sesion cerrada' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener usuario autenticado',
        responses: {
          200: { description: 'Usuario autenticado' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/usuarios': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar usuarios',
        responses: { 200: { description: 'Listado de usuarios' } },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear usuario',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                  rol: { type: 'string', enum: ['ADMIN', 'VENDEDOR', 'BODEGUERO'] },
                  estado: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Usuario creado' } },
      },
    },
    '/usuarios/{id}': {
      get: {
        tags: ['Usuarios'],
        summary: 'Obtener usuario por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Usuario encontrado' } },
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Actualizar usuario por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Usuario actualizado' } },
      },
    },
    '/usuarios/{id}/estado': {
      patch: {
        tags: ['Usuarios'],
        summary: 'Activar o desactivar usuario por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['estado'],
                properties: {
                  estado: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Estado del usuario actualizado' } },
      },
    },
    '/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Listar productos',
        responses: { 200: { description: 'Listado de productos' } },
      },
      post: {
        tags: ['Productos'],
        summary: 'Crear producto',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: { description: 'Producto creado' } },
      },
    },
    '/productos/{id}': {
      get: {
        tags: ['Productos'],
        summary: 'Obtener producto por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Producto encontrado' } },
      },
      put: {
        tags: ['Productos'],
        summary: 'Actualizar producto',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Producto actualizado' } },
      },
      delete: {
        tags: ['Productos'],
        summary: 'Eliminar producto',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Producto eliminado' } },
      },
    },
    '/productos/categorias/all': {
      get: {
        tags: ['Productos'],
        summary: 'Listar categorias',
        responses: { 200: { description: 'Categorias disponibles' } },
      },
    },
    '/proformas': {
      get: {
        tags: ['Proformas'],
        summary: 'Listar proformas',
        responses: { 200: { description: 'Listado de proformas' } },
      },
      post: {
        tags: ['Proformas'],
        summary: 'Crear proforma',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: { description: 'Proforma creada' } },
      },
    },
    '/proformas/{id}': {
      get: {
        tags: ['Proformas'],
        summary: 'Obtener proforma por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Proforma encontrada' } },
      },
      put: {
        tags: ['Proformas'],
        summary: 'Actualizar proforma por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Proforma actualizada' } },
      },
    },
    '/proformas/{id}/pdf': {
      get: {
        tags: ['Proformas'],
        summary: 'Exportar PDF de proforma',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'PDF generado' } },
      },
    },
    '/proformas/{id}/estado': {
      patch: {
        tags: ['Proformas'],
        summary: 'Cambiar estado de proforma',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Estado actualizado' } },
      },
    },
    '/proveedores': {
      get: {
        tags: ['Proveedores'],
        summary: 'Listar proveedores',
        responses: { 200: { description: 'Listado de proveedores' } },
      },
      post: {
        tags: ['Proveedores'],
        summary: 'Crear proveedor',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: { description: 'Proveedor creado' } },
      },
    },
    '/proveedores/{id}': {
      get: {
        tags: ['Proveedores'],
        summary: 'Obtener proveedor por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Proveedor encontrado' } },
      },
      put: {
        tags: ['Proveedores'],
        summary: 'Actualizar proveedor',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Proveedor actualizado' } },
      },
    },
    '/clientes': {
      get: {
        tags: ['Clientes'],
        summary: 'Listar clientes',
        responses: { 200: { description: 'Listado de clientes' } },
      },
      post: {
        tags: ['Clientes'],
        summary: 'Crear cliente',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 201: { description: 'Cliente creado' } },
      },
    },
    '/clientes/{id}': {
      get: {
        tags: ['Clientes'],
        summary: 'Obtener cliente por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Cliente encontrado' } },
      },
      put: {
        tags: ['Clientes'],
        summary: 'Actualizar cliente por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Cliente actualizado' } },
      },
    },
    '/config': {
      get: {
        tags: ['Configuracion'],
        summary: 'Listar configuraciones',
        responses: { 200: { description: 'Configuraciones actuales' } },
      },
    },
    '/config/{clave}': {
      put: {
        tags: ['Configuracion'],
        summary: 'Actualizar una configuracion',
        parameters: [{ name: 'clave', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Configuracion actualizada' } },
      },
    },
    '/config/bulk': {
      post: {
        tags: ['Configuracion'],
        summary: 'Actualizar configuraciones en bloque',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Configuraciones actualizadas' } },
      },
    },
    '/facturas/procesar': {
      post: {
        tags: ['Facturas'],
        summary: 'Procesar factura con OCR',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  factura: { type: 'string', format: 'binary' },
                },
                required: ['factura'],
              },
            },
          },
        },
        responses: { 200: { description: 'Factura procesada' } },
      },
    },
    '/facturas': {
      get: {
        tags: ['Facturas'],
        summary: 'Listar facturas',
        responses: { 200: { description: 'Listado de facturas' } },
      },
    },
    '/facturas/{id}': {
      get: {
        tags: ['Facturas'],
        summary: 'Obtener factura por id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Factura encontrada' } },
      },
    },
  },
};

const spec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [],
});

const setupSwagger = (app) => {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(spec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });
};

module.exports = setupSwagger;
