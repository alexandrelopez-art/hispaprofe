-- AlterEnum
ALTER TYPE "TipoEjercicio" ADD VALUE 'EXPRESION';

-- AlterTable
ALTER TABLE "PasoCompletado" ADD COLUMN     "entrega" TEXT,
ADD COLUMN     "valoracion" JSONB;

-- CreateTable
CREATE TABLE "CitaOral" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitaOral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CitaOral_claseId_idx" ON "CitaOral"("claseId");

-- CreateIndex
CREATE UNIQUE INDEX "CitaOral_asignacionId_pasoId_key" ON "CitaOral"("asignacionId", "pasoId");

-- AddForeignKey
ALTER TABLE "CitaOral" ADD CONSTRAINT "CitaOral_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitaOral" ADD CONSTRAINT "CitaOral_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
