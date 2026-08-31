-- CreateTable
CREATE TABLE "Schedule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_userId_order_idx" ON "Schedule"("userId", "order");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: un Schedule "Horario" por cada usuario que ya tuviera filas (ScheduleRow antes
-- colgaba directamente de userId, sin nombre propio) — para no perder lo que hubiera escrito.
INSERT INTO "Schedule" ("userId", "name", "order", "updatedAt")
SELECT DISTINCT "userId", 'Horario', 0, CURRENT_TIMESTAMP
FROM "ScheduleRow";

-- AlterTable: ScheduleRow pasa a colgar de Schedule
ALTER TABLE "ScheduleRow" ADD COLUMN "scheduleId" INTEGER;

-- DataMigration: engancha cada fila existente al Schedule recién creado de su mismo userId
UPDATE "ScheduleRow" AS sr
SET "scheduleId" = s."id"
FROM "Schedule" AS s
WHERE s."userId" = sr."userId";

ALTER TABLE "ScheduleRow" ALTER COLUMN "scheduleId" SET NOT NULL;

-- DropIndex
DROP INDEX "ScheduleRow_userId_order_idx";

-- DropForeignKey
ALTER TABLE "ScheduleRow" DROP CONSTRAINT "ScheduleRow_userId_fkey";

-- AlterTable
ALTER TABLE "ScheduleRow" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "ScheduleRow_scheduleId_order_idx" ON "ScheduleRow"("scheduleId", "order");

-- AddForeignKey
ALTER TABLE "ScheduleRow" ADD CONSTRAINT "ScheduleRow_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CalendarLegendCategory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarLegendCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarLegendCategory_userId_order_idx" ON "CalendarLegendCategory"("userId", "order");

-- AddForeignKey
ALTER TABLE "CalendarLegendCategory" ADD CONSTRAINT "CalendarLegendCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CalendarDayMark" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "CalendarDayMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDayMark_userId_date_key" ON "CalendarDayMark"("userId", "date");

-- CreateIndex
CREATE INDEX "CalendarDayMark_categoryId_idx" ON "CalendarDayMark"("categoryId");

-- AddForeignKey
ALTER TABLE "CalendarDayMark" ADD CONSTRAINT "CalendarDayMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDayMark" ADD CONSTRAINT "CalendarDayMark_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CalendarLegendCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
