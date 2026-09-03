import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/usuario";
import {
  bloquearPersona,
  desbloquearPersona,
  hacerProfesor,
  invitarProfesor,
  quitarProfesor,
  suprimirPersona,
} from "@/lib/acciones-admin";
import type { Prisma } from "@/lib/generated/prisma/client";
import NuevaContrasena from "@/components/nueva-contrasena";
import Boton from "@/components/ui/boton";
import BotonEnviar from "@/components/ui/boton-enviar";
import Campo from "@/components/ui/campo";
import Etiqueta, { type TonoEtiqueta } from "@/components/ui/etiqueta";
import Tarjeta from "@/components/ui/tarjeta";

export const dynamic = "force-dynamic";

const rolLabel: Record<string, string> = {
  ADMIN: "Administrador",
  PROFESOR: "Profesor",
  STUDENT: "Estudiante",
};

const rolTono: Record<string, TonoEtiqueta> = {
  ADMIN: "bloque3",
  PROFESOR: "hp",
  STUDENT: "neutro",
};

function nombreDe(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function AdminPersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const yo = await getUsuarioActual();

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const personas = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      nivel: true,
      contrasenaHash: true,
      bloqueadoEl: true,
      suprimidoEl: true,
    },
  });

  const administradores = personas.filter((p) => p.role === "ADMIN").length;

  return (
    <>
      <Tarjeta titulo="Invitar a un profesor" className="mt-8">
        <p className="text-sm text-tinta-suave">
          Si ya tiene cuenta, se le sube el rol. Si no, se le crea la ficha y se
          la encontrará hecha al entrar por primera vez. No se envía ningún
          correo: avisarle sigue siendo cosa tuya.
        </p>
        <form action={invitarProfesor} className="mt-4 flex flex-wrap items-end gap-3">
          {/* Antes solo tenía placeholder; la etiqueta «Correo» es nueva,
              para que un lector de pantalla tenga nombre. */}
          <Campo
            etiqueta="Correo"
            name="email"
            tipo="correo"
            required
            placeholder="correo@ejemplo.com"
            className="min-w-64 flex-1"
          />
          <BotonEnviar gerundio="Invitando…">Invitar</BotonEnviar>
        </form>
      </Tarjeta>

      <form className="mt-8 flex flex-wrap items-end gap-3">
        {/* La etiqueta «Buscar» es nueva, para que un lector de pantalla
            tenga nombre (antes solo tenía placeholder). */}
        <Campo
          etiqueta="Buscar"
          name="q"
          tipo="busqueda"
          defaultValue={q}
          placeholder="Buscar por nombre o correo"
          className="min-w-56 flex-1"
        />
        {/* Formulario GET: `useFormStatus` no lo ve, así que no hay gerundio. */}
        <Boton type="submit" variante="sutil">Buscar</Boton>
      </form>

      <p className="mt-4 text-sm text-tinta-suave">
        {personas.length} cuenta{personas.length !== 1 ? "s" : ""}.
      </p>

      <ul className="mt-3 space-y-2">
        {personas.map((p) => {
          const soyYo = p.id === yo?.id;
          // No se puede dejar la plataforma sin administradores, y nadie se
          // quita el rol a sí mismo.
          const puedeBajar =
            !soyYo &&
            p.role !== "STUDENT" &&
            !(p.role === "ADMIN" && administradores <= 1);
          const bloqueado = p.bloqueadoEl !== null;
          const suprimido = p.suprimidoEl !== null;

          return (
            <li key={p.id}>
              <Tarjeta className={bloqueado ? "opacity-60" : ""}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">
                      {suprimido ? "Ficha suprimida" : nombreDe(p)}
                      {soyYo && (
                        <span className="ml-2 text-xs font-bold text-tinta-suave">
                          (tú)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-tinta-suave">
                      {suprimido ? "sin datos" : p.email}
                      {p.nivel && ` · ${p.nivel}`}
                      {!p.contrasenaHash && " · sin contraseña"}
                    </p>
                  </div>

                  {bloqueado && (
                    <Etiqueta tono="neutro" className="shrink-0">
                      {suprimido ? "Suprimido" : "Bloqueado"}
                    </Etiqueta>
                  )}

                  <Etiqueta tono={rolTono[p.role] ?? "neutro"} className="shrink-0">
                    {rolLabel[p.role] ?? p.role}
                  </Etiqueta>

                  <div className="flex shrink-0 gap-2">
                    {/*
                      Toda lápida se queda como STUDENT a propósito, así que sin
                      el `!suprimido` este botón se le pinta encima a todas.
                    */}
                    {p.role === "STUDENT" && !suprimido && (
                      <form action={hacerProfesor}>
                        <input type="hidden" name="usuarioId" value={p.id} />
                        <BotonEnviar gerundio="Cambiando…" tamano="pequeno">
                          Hacer profesor
                        </BotonEnviar>
                      </form>
                    )}
                    {puedeBajar && (
                      <form action={quitarProfesor}>
                        <input type="hidden" name="usuarioId" value={p.id} />
                        <BotonEnviar gerundio="Cambiando…" variante="sutil" tamano="pequeno">
                          Quitar rol
                        </BotonEnviar>
                      </form>
                    )}
                    {!soyYo && !suprimido && !bloqueado && (
                      <form action={bloquearPersona}>
                        <input type="hidden" name="usuarioId" value={p.id} />
                        <BotonEnviar gerundio="Bloqueando…" variante="peligro" tamano="pequeno">
                          Bloquear
                        </BotonEnviar>
                      </form>
                    )}
                    {bloqueado && !suprimido && (
                      <form action={desbloquearPersona}>
                        <input type="hidden" name="usuarioId" value={p.id} />
                        <BotonEnviar gerundio="Desbloqueando…" variante="sutil" tamano="pequeno">
                          Desbloquear
                        </BotonEnviar>
                      </form>
                    )}
                    {p.id !== yo?.id && !suprimido && <NuevaContrasena usuarioId={p.id} compacto />}
                  </div>
                </div>

                {bloqueado && !suprimido && (
                  <details className="mt-3 w-full">
                    <summary className="cursor-pointer text-xs font-bold text-tinta-suave hover:text-hp-500">
                      Suprimir esta ficha
                    </summary>
                    <p className="mt-2 text-xs text-tinta-suave">
                      Se van su nombre, su correo, su cuenta, sus grupos, sus
                      deberes y todo su progreso. Sus clases se quedan, con sus
                      horas y su importe, como «Estudiante suprimido».{" "}
                      <strong className="text-tinta">Esto no se puede deshacer.</strong>
                    </p>
                    <form action={suprimirPersona} className="mt-3 flex flex-wrap gap-2">
                      <input type="hidden" name="usuarioId" value={p.id} />
                      {/*
                        El único freno de la única acción irreversible no puede
                        ser, para un lector de pantalla, una caja sin nombre: el
                        placeholder no nombra el campo. Se deja nativo (no
                        Campo): ya tiene su propio aria-label dinámico por fila
                        y Campo forzaría una etiqueta visible con el correo.
                      */}
                      <input
                        type="text"
                        name="confirmacion"
                        required
                        aria-label={`Escribe ${p.email} para confirmar la supresión`}
                        placeholder={`Escribe ${p.email} para confirmar`}
                        className="h-9 min-w-72 flex-1 rounded-full border border-hp-200 bg-fondo px-4 text-xs text-tinta outline-none focus:border-hp-400"
                      />
                      <BotonEnviar gerundio="Suprimiendo…" variante="peligro" tamano="pequeno">
                        Suprimir
                      </BotonEnviar>
                    </form>
                  </details>
                )}
              </Tarjeta>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-tinta-suave">
        Recuerda: quitar el rol no sirve de nada si ese correo sigue en la
        variable ADMIN_EMAILS. Volverá a ser administrador al entrar.
      </p>
    </>
  );
}
