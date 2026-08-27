/*
  Warnings:

  - Added the required column `updatedAt` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subtask` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Columna añadida nullable primero: hay filas existentes, así que se rellena desde `createdAt`
-- (mejor aproximación disponible de "última modificación" para filas ya existentes) antes de
-- exigir NOT NULL — @updatedAt de Prisma se encarga de mantenerla al día a partir de aquí.
ALTER TABLE "Habit" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Habit" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Habit" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Note" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Note" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subtask" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Subtask" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Subtask" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "SyncTombstone" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncTombstone_userId_deletedAt_idx" ON "SyncTombstone"("userId", "deletedAt");

-- AddForeignKey
ALTER TABLE "SyncTombstone" ADD CONSTRAINT "SyncTombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
