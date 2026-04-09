-- Add actualizado_en to usuarios and enforce consistent values.
ALTER TABLE "public"."usuarios"
ADD COLUMN IF NOT EXISTS "actualizado_en" TIMESTAMP(6);

UPDATE "public"."usuarios"
SET "actualizado_en" = COALESCE("actualizado_en", "creado_en", CURRENT_TIMESTAMP)
WHERE "actualizado_en" IS NULL;

ALTER TABLE "public"."usuarios"
ALTER COLUMN "actualizado_en" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "public"."usuarios"
ALTER COLUMN "actualizado_en" SET NOT NULL;
