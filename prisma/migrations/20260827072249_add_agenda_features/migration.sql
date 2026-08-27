-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "guests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reminderMinutesBefore" INTEGER[] DEFAULT ARRAY[30]::INTEGER[];

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "offsetMinutesBefore" INTEGER;

-- CreateTable
CREATE TABLE "EventException" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "originalStartTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "newStartTime" TIMESTAMP(3),
    "newEndTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventException_eventId_idx" ON "EventException"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventException_eventId_originalStartTime_key" ON "EventException"("eventId", "originalStartTime");

-- AddForeignKey
ALTER TABLE "EventException" ADD CONSTRAINT "EventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
