-- CreateTable
CREATE TABLE "ScheduleRow" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "timeLabel" TEXT NOT NULL DEFAULT '',
    "monday" TEXT NOT NULL DEFAULT '',
    "tuesday" TEXT NOT NULL DEFAULT '',
    "wednesday" TEXT NOT NULL DEFAULT '',
    "thursday" TEXT NOT NULL DEFAULT '',
    "friday" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleRow_userId_order_idx" ON "ScheduleRow"("userId", "order");

-- AddForeignKey
ALTER TABLE "ScheduleRow" ADD CONSTRAINT "ScheduleRow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
