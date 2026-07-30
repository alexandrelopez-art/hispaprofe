-- Renombra los dos valores de TipoRecorrido para que digan de qué servicio
-- hablan. `RENAME VALUE` solo cambia la etiqueta: el OID del valor no se
-- mueve, así que las filas existentes y el DEFAULT de Recorrido.tipo siguen
-- apuntando a lo mismo sin tocarlos.
--
-- Escrita a mano y no generada: `prisma migrate dev` no distingue un
-- renombrado de un borrado más un alta, y tiende a tirar el tipo y rehacerlo,
-- que con datos vivos es otra operación y peor.
ALTER TYPE "TipoRecorrido" RENAME VALUE 'RECORRIDO' TO 'CLASES_PARTICULARES';
ALTER TYPE "TipoRecorrido" RENAME VALUE 'PREPARACION' TO 'PREPARACION_DELE';
