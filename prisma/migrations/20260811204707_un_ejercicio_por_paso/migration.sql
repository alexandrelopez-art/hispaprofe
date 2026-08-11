-- Un paso, un ejercicio. La compuesta `(pasoId, ejercicioId)` no bastaba:
-- cada pegado crea un `Ejercicio` de id distinto, así que dos pestañas que
-- pulsan "Guardar" a la vez sobre el mismo paso libre podían colar dos filas
-- para el mismo `pasoId`. La única en `pasoId` a secas es la que cierra esa
-- carrera; el `pasoId, ejercicioId` deja de aportar nada que esta no cubra.

-- DropIndex
DROP INDEX "PasoEjercicio_pasoId_ejercicioId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PasoEjercicio_pasoId_key" ON "PasoEjercicio"("pasoId");
