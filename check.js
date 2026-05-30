const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productos = await prisma.producto.findMany();
  console.log("Productos:", JSON.stringify(productos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
