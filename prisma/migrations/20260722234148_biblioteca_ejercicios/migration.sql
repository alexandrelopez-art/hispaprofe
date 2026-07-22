-- CreateEnum
CREATE TYPE "TipoEjercicio" AS ENUM ('WIDGET', 'OPCION_MULTIPLE', 'HUECOS', 'RELACIONAR', 'ORDENAR');

-- CreateTable
CREATE TABLE "Ejercicio" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEjercicio" NOT NULL,
    "titulo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "destreza" "Destreza",
    "etiquetas" TEXT[],
    "datos" JSONB NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ejercicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasoEjercicio" (
    "id" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "ejercicioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "PasoEjercicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ejercicio_nivel_destreza_idx" ON "Ejercicio"("nivel", "destreza");

-- CreateIndex
CREATE INDEX "Ejercicio_tipo_idx" ON "Ejercicio"("tipo");

-- CreateIndex
CREATE INDEX "Ejercicio_autorId_idx" ON "Ejercicio"("autorId");

-- CreateIndex
CREATE INDEX "PasoEjercicio_ejercicioId_idx" ON "PasoEjercicio"("ejercicioId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoEjercicio_pasoId_ejercicioId_key" ON "PasoEjercicio"("pasoId", "ejercicioId");

-- AddForeignKey
ALTER TABLE "Ejercicio" ADD CONSTRAINT "Ejercicio_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoEjercicio" ADD CONSTRAINT "PasoEjercicio_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "Paso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoEjercicio" ADD CONSTRAINT "PasoEjercicio_ejercicioId_fkey" FOREIGN KEY ("ejercicioId") REFERENCES "Ejercicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
