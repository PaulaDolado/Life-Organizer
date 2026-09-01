-- Sustituye por completo la funcionalidad de Hobbies (tracking de sesiones/minutos) por la de
-- Galería (foto + texto libre por entrada) — ver GalleryItem en schema.prisma.

-- DropForeignKey
ALTER TABLE "HobbySession" DROP CONSTRAINT "HobbySession_hobbyId_fkey";
ALTER TABLE "HobbySession" DROP CONSTRAINT "HobbySession_userId_fkey";
ALTER TABLE "Hobby" DROP CONSTRAINT "Hobby_userId_fkey";

-- DropTable
DROP TABLE "HobbySession";
DROP TABLE "Hobby";

-- CreateTable
CREATE TABLE "GalleryItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "imageData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryItem_userId_idx" ON "GalleryItem"("userId");

-- AddForeignKey
ALTER TABLE "GalleryItem" ADD CONSTRAINT "GalleryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
