-- AlterTable
ALTER TABLE "TareaDeExamen" ADD COLUMN     "cortes" JSONB,
ADD COLUMN     "grabacionArchivoId" TEXT;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_lecturaId_fkey" FOREIGN KEY ("lecturaId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_auditivaId_fkey" FOREIGN KEY ("auditivaId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
