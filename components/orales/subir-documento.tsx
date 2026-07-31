"use client";

import { useState } from "react";
import SubirImagen from "@/components/subir-imagen";

/**
 * El puente entre `SubirImagen`, que devuelve la url por callback, y el
 * formulario de alta, que se envía a una acción de servidor. Guarda solo el
 * id: la ruta `/api/archivos/<id>` se reconstruye donde haga falta, igual
 * que hace `Bloque` con sus imágenes.
 */
export default function SubirDocumento() {
  const [imagenId, setImagenId] = useState("");

  return (
    <div className="flex items-center gap-3">
      <SubirImagen
        etiqueta="Subir el documento"
        alSubir={(url) => setImagenId(url.split("/").pop() ?? "")}
      />
      {/* Un `<input type="hidden">` está fuera de la validación del
          navegador: `required` no hace nada en él, así que enviar el
          formulario sin documento pasaría igual. Sin `required` aquí,
          la regla 6 del servidor (`origenDeSujetValido`) es la única
          comprobación, y ya devuelve «Falta el documento…». */}
      <input type="hidden" name="imagenId" value={imagenId} />
      {imagenId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/archivos/${imagenId}`}
          alt="Vista previa del documento"
          className="h-16 rounded border border-hp-100"
        />
      ) : (
        <span className="text-xs text-tinta-suave">Sin documento todavía</span>
      )}
    </div>
  );
}
