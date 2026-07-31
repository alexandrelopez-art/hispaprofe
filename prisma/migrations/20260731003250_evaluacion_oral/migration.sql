-- CreateTable
CREATE TABLE "Convocatoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sujeto" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "eje" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fuente" TEXT,
    "url" TEXT,
    "preguntas" TEXT[],
    "imagenId" TEXT,
    "recursoId" TEXT,

    CONSTRAINT "Sujeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "convocatoriaId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "estudianteId" TEXT,
    "dia" TEXT NOT NULL,
    "preparacion" TEXT,
    "hora" TEXT NOT NULL,
    "sala" TEXT,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluacionOral" (
    "id" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,
    "sujetoId" TEXT,
    "segundosEoc" DOUBLE PRECISION,
    "segundosEoi" DOUBLE PRECISION,
    "notas" JSONB,
    "comentarios" JSONB,
    "frases" JSONB,
    "preguntadas" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluacionOral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscripcionOral" (
    "id" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "audioId" TEXT,
    "segmentos" JSONB,
    "informe" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscripcionOral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Convocatoria_profesorId_archivada_idx" ON "Convocatoria"("profesorId", "archivada");

-- CreateIndex
CREATE INDEX "Sujeto_convocatoriaId_idx" ON "Sujeto"("convocatoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Sujeto_convocatoriaId_numero_key" ON "Sujeto"("convocatoriaId", "numero");

-- CreateIndex
CREATE INDEX "Turno_estudianteId_idx" ON "Turno"("estudianteId");

-- CreateIndex
CREATE UNIQUE INDEX "Turno_convocatoriaId_grupoId_orden_key" ON "Turno"("convocatoriaId", "grupoId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluacionOral_turnoId_key" ON "EvaluacionOral"("turnoId");

-- CreateIndex
CREATE UNIQUE INDEX "TranscripcionOral_evaluacionId_key" ON "TranscripcionOral"("evaluacionId");

-- AddForeignKey
ALTER TABLE "Convocatoria" ADD CONSTRAINT "Convocatoria_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sujeto" ADD CONSTRAINT "Sujeto_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_convocatoriaId_fkey" FOREIGN KEY ("convocatoriaId") REFERENCES "Convocatoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionOral" ADD CONSTRAINT "EvaluacionOral_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionOral" ADD CONSTRAINT "EvaluacionOral_sujetoId_fkey" FOREIGN KEY ("sujetoId") REFERENCES "Sujeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscripcionOral" ADD CONSTRAINT "TranscripcionOral_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "EvaluacionOral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
