-- AlterTable: username empieza nullable porque hay filas existentes que rellenar antes de
-- poder exigir NOT NULL + UNIQUE.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill: username derivado del email (parte antes de la @, saneado a [a-z0-9_.]) + el id,
-- para garantizar unicidad sin tener que comprobar colisiones entre usuarios existentes.
UPDATE "User"
SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_.]', '_', 'g')) || '_' || "id"::text
WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Rename: el cooldown de 15 días pasa a aplicar al username (antes al email, ver authService.ts).
ALTER TABLE "User" RENAME COLUMN "emailChangedAt" TO "usernameChangedAt";

-- AlterTable: verificación de email.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_emailVerificationTokenHash_idx" ON "User"("emailVerificationTokenHash");
