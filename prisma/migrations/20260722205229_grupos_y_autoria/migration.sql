-- AlterTable
ALTER TABLE "Recorrido" ADD COLUMN     "autorId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clerkId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivel" "Nivel",
    "profesorId" TEXT NOT NULL,
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiembroGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiembroGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grupo_profesorId_archivado_idx" ON "Grupo"("profesorId", "archivado");

-- CreateIndex
CREATE INDEX "MiembroGrupo_estudianteId_idx" ON "MiembroGrupo"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "MiembroGrupo_grupoId_estudianteId_key" ON "MiembroGrupo"("grupoId", "estudianteId");

-- CreateIndex
CREATE INDEX "Asignacion_recorridoId_archivada_idx" ON "Asignacion"("recorridoId", "archivada");

-- CreateIndex
CREATE INDEX "Recorrido_autorId_idx" ON "Recorrido"("autorId");

-- AddForeignKey
ALTER TABLE "Recorrido" ADD CONSTRAINT "Recorrido_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiembroGrupo" ADD CONSTRAINT "MiembroGrupo_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
