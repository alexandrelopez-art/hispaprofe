-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Nivel" ADD VALUE 'A1';
ALTER TYPE "Nivel" ADD VALUE 'A2';
ALTER TYPE "Nivel" ADD VALUE 'B1';
ALTER TYPE "Nivel" ADD VALUE 'C1';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nivel" "Nivel";

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "recorridoId" TEXT NOT NULL,
    "nota" TEXT,
    "venceEl" TIMESTAMP(3),
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasoCompletado" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "completadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasoCompletado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asignacion_estudianteId_archivada_idx" ON "Asignacion"("estudianteId", "archivada");

-- CreateIndex
CREATE INDEX "Asignacion_profesorId_idx" ON "Asignacion"("profesorId");

-- CreateIndex
CREATE UNIQUE INDEX "Asignacion_estudianteId_recorridoId_key" ON "Asignacion"("estudianteId", "recorridoId");

-- CreateIndex
CREATE INDEX "PasoCompletado_asignacionId_idx" ON "PasoCompletado"("asignacionId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoCompletado_asignacionId_pasoId_key" ON "PasoCompletado"("asignacionId", "pasoId");

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoCompletado" ADD CONSTRAINT "PasoCompletado_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoCompletado" ADD CONSTRAINT "PasoCompletado_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "Paso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
