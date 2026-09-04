-- CreateEnum
CREATE TYPE "EstadoExamen" AS ENUM ('EN_CONSTRUCCION', 'PUBLICADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('VACIA', 'RELLENADA', 'REVISADA');

-- CreateEnum
CREATE TYPE "PruebaDeExamen" AS ENUM ('CE', 'CO');

-- CreateTable
CREATE TABLE "Examen" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "fuente" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "estado" "EstadoExamen" NOT NULL DEFAULT 'EN_CONSTRUCCION',
    "bloque" INTEGER NOT NULL DEFAULT 2,
    "clavesTexto" TEXT,
    "lecturaId" TEXT NOT NULL,
    "auditivaId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaginaDeExamen" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "archivoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaginaDeExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TareaDeExamen" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "prueba" "PruebaDeExamen" NOT NULL,
    "numero" INTEGER NOT NULL,
    "pasoId" TEXT NOT NULL,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'VACIA',
    "paginaIds" TEXT[],
    "dudas" JSONB,
    "avisos" JSONB,
    "imagenesPedidas" JSONB,
    "claveOficial" JSONB,
    "rellenadaEl" TIMESTAMP(3),
    "revisadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TareaDeExamen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Examen_lecturaId_key" ON "Examen"("lecturaId");

-- CreateIndex
CREATE UNIQUE INDEX "Examen_auditivaId_key" ON "Examen"("auditivaId");

-- CreateIndex
CREATE INDEX "Examen_nivel_estado_idx" ON "Examen"("nivel", "estado");

-- CreateIndex
CREATE INDEX "Examen_creadoPorId_idx" ON "Examen"("creadoPorId");

-- CreateIndex
CREATE INDEX "PaginaDeExamen_examenId_orden_idx" ON "PaginaDeExamen"("examenId", "orden");

-- CreateIndex
CREATE INDEX "TareaDeExamen_pasoId_idx" ON "TareaDeExamen"("pasoId");

-- CreateIndex
CREATE UNIQUE INDEX "TareaDeExamen_examenId_prueba_numero_key" ON "TareaDeExamen"("examenId", "prueba", "numero");

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaginaDeExamen" ADD CONSTRAINT "PaginaDeExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TareaDeExamen" ADD CONSTRAINT "TareaDeExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
