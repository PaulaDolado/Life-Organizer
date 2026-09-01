-- CreateTable
CREATE TABLE "Planner" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Planner_userId_order_idx" ON "Planner"("userId", "order");

-- AddForeignKey
ALTER TABLE "Planner" ADD CONSTRAINT "Planner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: un Planner "Planificador" por CADA usuario (a diferencia de la migración
-- equivalente de Schedule, que solo creó un Horario para quien ya tuviera filas) — así ningún
-- usuario existente se queda sin tablero por defecto, tenga tareas o no todavía.
INSERT INTO "Planner" ("userId", "name", "order", "updatedAt")
SELECT "id", 'Planificador', 0, CURRENT_TIMESTAMP
FROM "User";

-- AlterTable: Task pasa a colgar de Planner
ALTER TABLE "Task" ADD COLUMN "plannerId" INTEGER;

-- DataMigration: engancha cada tarea existente al Planner recién creado de su mismo userId (en
-- este punto de la migración cada usuario tiene exactamente uno).
UPDATE "Task" AS t
SET "plannerId" = p."id"
FROM "Planner" AS p
WHERE p."userId" = t."userId";

ALTER TABLE "Task" ALTER COLUMN "plannerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Task_plannerId_status_idx" ON "Task"("plannerId", "status");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "Planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
