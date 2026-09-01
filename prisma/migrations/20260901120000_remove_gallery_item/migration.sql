-- La Galería pasa a ser una plantilla más de "página personalizada" (ver CustomPage.template =
-- "galeria"): sus entradas viven ahora dentro de CustomPage.content (JSON), igual que las
-- tarjetas del kanban de páginas personalizadas — ya no hace falta esta tabla propia.

-- DropForeignKey
ALTER TABLE "GalleryItem" DROP CONSTRAINT "GalleryItem_userId_fkey";

-- DropTable
DROP TABLE "GalleryItem";
