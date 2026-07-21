-- CreateEnum
CREATE TYPE "TipoBloque" AS ENUM ('TEXTO', 'IMAGEN', 'AUDIO', 'EMBED', 'ENLACE');

-- CreateTable
CREATE TABLE "Bloque" (
    "id" TEXT NOT NULL,
    "pasoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoBloque" NOT NULL,
    "texto" TEXT,
    "url" TEXT,
    "etiqueta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bloque_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Bloque" ADD CONSTRAINT "Bloque_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "Paso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
