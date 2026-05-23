-- AlterTable: agregar email, reset_token y reset_token_expiry a la tabla usuarios
ALTER TABLE "usuarios"
  ADD COLUMN "email" VARCHAR(100),
  ADD COLUMN "reset_token" VARCHAR(255),
  ADD COLUMN "reset_token_expiry" TIMESTAMP(6);

-- CreateIndex: email debe ser único (si se especifica)
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
