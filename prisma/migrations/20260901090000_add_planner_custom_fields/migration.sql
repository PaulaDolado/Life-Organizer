-- AlterTable
ALTER TABLE "Task" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PlannerField" (
    "id" SERIAL NOT NULL,
    "plannerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerField_plannerId_order_idx" ON "PlannerField"("plannerId", "order");

-- AddForeignKey
ALTER TABLE "PlannerField" ADD CONSTRAINT "PlannerField_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "Planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
