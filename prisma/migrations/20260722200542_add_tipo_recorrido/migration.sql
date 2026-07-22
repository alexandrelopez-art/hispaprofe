-- CreateEnum
CREATE TYPE "TipoRecorrido" AS ENUM ('RECORRIDO', 'PREPARACION');

-- AlterTable
ALTER TABLE "Recorrido" ADD COLUMN     "tipo" "TipoRecorrido" NOT NULL DEFAULT 'RECORRIDO';

-- CreateIndex
CREATE INDEX "Recorrido_tipo_nivel_orden_idx" ON "Recorrido"("tipo", "nivel", "orden");
