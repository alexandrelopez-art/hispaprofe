-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "classroomCursoId" TEXT,
ADD COLUMN     "classroomNombre" TEXT,
ADD COLUMN     "sincronizadoEl" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CuentaGoogle" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "email" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiraEl" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaGoogle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaGoogle_usuarioId_key" ON "CuentaGoogle"("usuarioId");

-- AddForeignKey
ALTER TABLE "CuentaGoogle" ADD CONSTRAINT "CuentaGoogle_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
