/**
 * Prisma Seed Script
 * Proformax - Arte Parquet G&G
 * Genera datos iniciales para el sistema
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // ── Configuración de empresa ────────────────────────────────────────────────
  const configItems = [
    { clave: 'COMPANY_NAME',     valor: 'Arte Parquet G&G',      descripcion: 'Nombre de la empresa' },
    { clave: 'COMPANY_RUC',      valor: '1234567890001',          descripcion: 'RUC de la empresa' },
    { clave: 'COMPANY_ADDRESS',  valor: 'Quito, Ecuador',         descripcion: 'Dirección de la empresa' },
    { clave: 'COMPANY_PHONE',    valor: '+593 99 999 9999',       descripcion: 'Teléfono de contacto' },
    { clave: 'COMPANY_EMAIL',    valor: 'info@arteparquet.com',   descripcion: 'Email corporativo' },
    { clave: 'IVA_RATE',         valor: '0.15',                   descripcion: 'Tasa IVA vigente Ecuador (15%)' },
    { clave: 'PROFORMA_VALIDITY_DAYS', valor: '30',               descripcion: 'Días de vigencia de proforma' },
    { clave: 'PROFORMA_PREFIX',  valor: 'PRF',                    descripcion: 'Prefijo para numeración de proformas' },
  ];

  for (const config of configItems) {
    await prisma.configuracionEmpresa.upsert({
      where:  { clave: config.clave },
      update: { valor: config.valor },
      create: config,
    });
  }
  console.log('✅ Configuración de empresa insertada.');

  // ── Usuario administrador ───────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  await prisma.usuario.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      username:     'admin',
      passwordHash,
      rol:          'ADMIN',
      estado:       true,
    },
  });
  console.log('✅ Usuario administrador creado (admin / Admin@1234).');

  // ── Usuario vendedor ────────────────────────────────────────────────────────
  const vendedorPasswordHash = await bcrypt.hash('Vendedor@1234', 12);

  await prisma.usuario.upsert({
    where:  { username: 'vendedor01' },
    update: {},
    create: {
      username:     'vendedor01',
      passwordHash: vendedorPasswordHash,
      rol:          'vendedor',
      estado:       true,
    },
  });
  console.log('✅ Usuario vendedor creado (vendedor01 / Vendedor@1234).');

  // ── Categorías de productos ─────────────────────────────────────────────────
  const categorias = [
    { nombre: 'Pisos de Madera',   descripcion: 'Tablones, parquet y laminados' },
    { nombre: 'Adhesivos',         descripcion: 'Pegamentos y fijadores para pisos' },
    { nombre: 'Herramientas',      descripcion: 'Herramientas para instalación' },
    { nombre: 'Accesorios',        descripcion: 'Zócalos, perfiles y terminaciones' },
    { nombre: 'Mantenimiento',     descripcion: 'Productos para mantenimiento de pisos' },
    { nombre: 'Servicios',         descripcion: 'Servicios de instalación y mantenimiento' },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where:  { nombre: cat.nombre },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categorías de productos insertadas.');

  console.log('\n🎉 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
