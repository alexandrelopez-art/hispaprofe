import { CRITERIOS } from "@/lib/orales/criterios";
import { calcularTotal } from "@/lib/orales/formato";
import type { Notas } from "@/lib/orales/formato";

export type FilaCsv = {
  dia: string;
  hora: string;
  apellido: string;
  nombre: string;
  sala: string;
  sujetNumero: number | null;
  sujetTitulo: string;
  eje: string;
  segundosEoc: number;
  segundosEoi: number;
  notas: Notas;
  comentarios: Record<string, string>;
};

/** Una celda. Entrecomilla en cuanto aparece algo que rompería la fila. */
export function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (/[",\r\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Las veintidós columnas que espera el liceo, con el BOM delante.
 *
 * El BOM no es capricho: sin él, Excel en Windows abre el archivo en su
 * página de códigos y «Philomène» sale como «PhilomÃ¨ne».
 *
 * Las filas de pausa no llegan aquí: las filtra quien llama, porque una
 * pausa no es un estudiante sin nota, es que no hay nadie.
 */
export function construirCsv(filas: FilaCsv[]): string {
  const cabecera = [
    "Día", "Hora pasaje", "Apellido", "Nombre", "Sala",
    "Doc nº", "Doc título", "Eje",
    "EOC seg", "EOI seg",
    ...CRITERIOS.flatMap((c) => [`${c.titulo} /${c.maximo}`, `${c.titulo} — comentario`]),
    "Nota /20", "Comentario general",
  ];

  const cuerpo = filas.map((f) => [
    f.dia, f.hora, f.apellido, f.nombre, f.sala,
    f.sujetNumero ?? "", f.sujetTitulo, f.eje,
    Math.round(f.segundosEoc), Math.round(f.segundosEoi),
    ...CRITERIOS.flatMap((c) => [
      f.notas[c.key] ?? "",
      f.comentarios[c.key] ?? "",
    ]),
    // Punto decimal a propósito: una coma decimal en un CSV separado por
    // comas parte la celda en dos en cuanto alguien lo abre.
    calcularTotal(f.notas).toFixed(1),
    f.comentarios.general ?? "",
  ]);

  return (
    "﻿" +
    [cabecera, ...cuerpo].map((fila) => fila.map(celda).join(",")).join("\r\n")
  );
}
