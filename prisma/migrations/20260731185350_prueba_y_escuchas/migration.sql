-- AlterTable
ALTER TABLE "Recorrido" ADD COLUMN     "destreza" "Destreza";

-- CreateTable
CREATE TABLE "Escucha" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Escucha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Escucha_asignacionId_idx" ON "Escucha"("asignacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Escucha_asignacionId_pasoId_clave_key" ON "Escucha"("asignacionId", "pasoId", "clave");

-- AddForeignKey
ALTER TABLE "Escucha" ADD CONSTRAINT "Escucha_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
