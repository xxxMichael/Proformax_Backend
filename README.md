# Proformax Backend

API REST para la gestion de proformas, clientes, proveedores, inventario y facturas de compra.

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- PostgreSQL 14 o superior

## Instalacion

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo de entorno:

- Copiar `.env.example` como `.env`
- Ajustar valores reales segun tu entorno

## Variables de entorno clave

- `PORT`: puerto del servidor (por defecto `3000`)
- `DATABASE_URL`: conexion de PostgreSQL
- `JWT_SECRET`: secreto para firmar tokens
- `CORS_ALLOWED_ORIGINS`: dominios permitidos para CORS

Ejemplo de DATABASE_URL:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/Proformax?schema=public"
```

> Nota: Si la password contiene caracteres especiales (`@`, `:`, `/`, `#`, `?`, `=`, `&`) debes codificarla en formato URL.

## Prisma y base de datos

Este proyecto ya fue alineado con una base existente en PostgreSQL.

### Crear base desde cero con Prisma (PostgreSQL ya instalado)

Si no tienes tablas creadas y quieres generarlas desde Prisma en tu maquina local, sigue estos pasos:

1. Crear una base vacia en PostgreSQL (sin tablas).

Ejemplo:

```bash
createdb -U postgres Proformax
```

2. Configurar DATABASE_URL en .env apuntando a esa base.

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/Proformax?schema=public"
```

3. Crear estructura desde prisma/schema.prisma:

```bash
npx prisma migrate dev --name init
```

4. Regenerar cliente Prisma:

```bash
npx prisma generate
```

5. (Opcional) Cargar datos iniciales:

```bash
npm run prisma:seed
```

> Nota: Este repositorio actualmente no incluye carpeta `prisma/migrations`.
> El primer desarrollador que ejecute `migrate dev --name init` debe subir la carpeta `prisma/migrations` para que el resto del equipo solo aplique migraciones.

### Flujo recomendado cuando la BD ya existe

1. Sincronizar schema desde la base real:

```bash
npx prisma db pull
```

2. Regenerar cliente Prisma:

```bash
npx prisma generate
```

### Flujo para crear cambios nuevos de esquema

Usar migraciones solo para cambios nuevos que quieras versionar:

```bash
npx prisma migrate dev --name nombre_del_cambio
```

> Importante: No usar `migrate dev` para inicializar una base que ya esta creada manualmente.

## Scripts disponibles

- `npm run dev`: inicia servidor con nodemon
- `npm start`: inicia servidor en modo normal
- `npm run prisma:generate`: genera cliente Prisma
- `npm run prisma:migrate`: crea/aplica migraciones en desarrollo
- `npm run prisma:studio`: abre Prisma Studio
- `npm run prisma:seed`: ejecuta seed de datos
- `npm run lint`: ejecuta ESLint
- `npm test`: ejecuta pruebas con Jest

## Ejecucion local

1. Modo desarrollo:

```bash
npm run dev
```

2. Verificacion de salud:

```http
GET http://localhost:3000/api/v1/health
```

## Estructura principal

- `src/config`: configuraciones (DB, logger, Azure)
- `src/controllers`: controladores HTTP
- `src/services`: logica de negocio
- `src/repositories`: acceso a datos
- `src/routes`: rutas API
- `prisma/schema.prisma`: modelos Prisma
- `prisma/seed.js`: seed inicial

