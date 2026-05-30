-- CreateTable
CREATE TABLE "configuracion_empresa" (
    "id" SERIAL NOT NULL,
    "ruc" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL DEFAULT 'Arte Parquet G&G',
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "porcentaje_iva_vigente" DECIMAL(5,2) DEFAULT 15.00,

    CONSTRAINT "configuracion_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" VARCHAR(20) NOT NULL DEFAULT 'vendedor',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "identificacion" VARCHAR(20) NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos_razon_social" VARCHAR(150) NOT NULL,
    "email" VARCHAR(100),
    "telefono" VARCHAR(20),
    "direccion" TEXT,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "identificacion" VARCHAR(20) NOT NULL,
    "razon_social" VARCHAR(150) NOT NULL,
    "nombre_comercial" VARCHAR(150),
    "direccion" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(100),
    "estado" BOOLEAN DEFAULT true,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_servicios" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "tipo" VARCHAR(20) NOT NULL,
    "precio_base" DECIMAL(14,6) NOT NULL,
    "stock_actual" INTEGER DEFAULT 0,
    "aplica_iva" BOOLEAN DEFAULT true,
    "estado" BOOLEAN DEFAULT true,

    CONSTRAINT "productos_servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_compra" (
    "id" SERIAL NOT NULL,
    "numero_factura" VARCHAR(50) NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "proveedor_id" INTEGER NOT NULL,

    CONSTRAINT "facturas_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_compra" (
    "id" SERIAL NOT NULL,
    "factura_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_costo" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "detalles_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proformas" (
    "id" SERIAL NOT NULL,
    "numero_proforma" VARCHAR(20) NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_emision" DATE NOT NULL DEFAULT CURRENT_DATE,
    "fecha_validez" DATE NOT NULL,
    "subtotal_sin_iva" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "porcentaje_descuento" DECIMAL(5,2) DEFAULT 0.00,
    "total_descuento" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_iva" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_final" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "estado" VARCHAR(20) DEFAULT 'EMITIDA',
    "observaciones" TEXT,
    "creado_en" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_proforma" (
    "id" SERIAL NOT NULL,
    "proforma_id" INTEGER NOT NULL,
    "producto_servicio_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,4) NOT NULL,
    "precio_unitario" DECIMAL(14,6) NOT NULL,
    "subtotal" DECIMAL(14,6) NOT NULL,

    CONSTRAINT "detalles_proforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_identificacion_key" ON "clientes"("identificacion");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_identificacion_key" ON "proveedores"("identificacion");

-- CreateIndex
CREATE UNIQUE INDEX "productos_servicios_codigo_key" ON "productos_servicios"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_compra_numero_factura_key" ON "facturas_compra"("numero_factura");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_numero_proforma_key" ON "proformas"("numero_proforma");

-- AddForeignKey
ALTER TABLE "facturas_compra" ADD CONSTRAINT "fk_proveedor" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compra" ADD CONSTRAINT "detalles_compra_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas_compra"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_compra" ADD CONSTRAINT "detalles_compra_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos_servicios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_proforma" ADD CONSTRAINT "detalles_proforma_producto_servicio_id_fkey" FOREIGN KEY ("producto_servicio_id") REFERENCES "productos_servicios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalles_proforma" ADD CONSTRAINT "detalles_proforma_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
