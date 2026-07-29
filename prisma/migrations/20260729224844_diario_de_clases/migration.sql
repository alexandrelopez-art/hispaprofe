-- CreateEnum
CREATE TYPE "EstadoClase" AS ENUM ('AGENDADA', 'DADA', 'ANULADA');

-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "tarifaCentimos" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tarifaCentimos" INTEGER;

-- CreateTable
CREATE TABLE "Clase" (
    "id" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "estudianteId" TEXT,
    "grupoId" TEXT,
    "empiezaEl" TIMESTAMP(3) NOT NULL,
    "minutos" INTEGER NOT NULL,
    "estado" "EstadoClase" NOT NULL DEFAULT 'AGENDADA',
    "donde" TEXT,
    "enlace" TEXT,
    "notas" TEXT,
    "deberes" TEXT,
    "importeCentimos" INTEGER,
    "cobradaEl" TIMESTAMP(3),
    "googleEventoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deber" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "cerradoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clase_profesorId_empiezaEl_idx" ON "Clase"("profesorId", "empiezaEl");

-- CreateIndex
CREATE INDEX "Clase_estudianteId_empiezaEl_idx" ON "Clase"("estudianteId", "empiezaEl");

-- CreateIndex
CREATE INDEX "Clase_grupoId_empiezaEl_idx" ON "Clase"("grupoId", "empiezaEl");

-- CreateIndex
CREATE INDEX "Deber_estudianteId_cerradoEl_idx" ON "Deber"("estudianteId", "cerradoEl");

-- CreateIndex
CREATE UNIQUE INDEX "Deber_claseId_estudianteId_key" ON "Deber"("claseId", "estudianteId");

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deber" ADD CONSTRAINT "Deber_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deber" ADD CONSTRAINT "Deber_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
