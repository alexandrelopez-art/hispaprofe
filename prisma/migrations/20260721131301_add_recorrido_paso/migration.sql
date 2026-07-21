-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('A2_B1_ESCOLAR', 'B2');

-- CreateEnum
CREATE TYPE "TipoPaso" AS ENUM ('ACTIVACION', 'ACTIVIDAD', 'ANDAMIAJE', 'MICRO_TAREA', 'MACRO_TAREA');

-- CreateEnum
CREATE TYPE "Destreza" AS ENUM ('CO', 'CE', 'EO', 'EE', 'EOI', 'EEI');

-- CreateTable
CREATE TABLE "Recorrido" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivel" "Nivel" NOT NULL,
    "orden" INTEGER NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recorrido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paso" (
    "id" TEXT NOT NULL,
    "recorridoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "ciclo" INTEGER NOT NULL,
    "tipo" "TipoPaso" NOT NULL,
    "destreza" "Destreza",
    "titulo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paso_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Paso" ADD CONSTRAINT "Paso_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
