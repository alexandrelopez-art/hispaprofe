import { prisma } from "@/lib/prisma";
import { cifrar, descifrar } from "@/lib/crypto";

const AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CLASSROOM = "https://classroom.googleapis.com/v1";

/**
 * Permisos que se piden. Solo lectura: la plataforma lee los cursos y sus
 * estudiantes, nunca escribe nada en Classroom.
 * `classroom.profile.emails` es imprescindible, sin el la lista de alumnos
 * llega sin correo y no hay forma de emparejarlos.
 */
export const ALCANCES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
];

export function googleConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function urlRedireccion(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3000/api/google/callback"
  );
}

export function urlConsentimiento(estado: string): string {
  const parametros = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: urlRedireccion(),
    response_type: "code",
    scope: ALCANCES.join(" "),
    // offline + consent son los que hacen que Google devuelva un
    // refresh_token, sin el habria que reautorizar cada hora.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  });
  return `${AUTORIZAR}?${parametros}`;
}

/** Canjea el código de la vuelta por tokens y los guarda. */
export async function guardarTokens(codigo: string, usuarioId: string) {
  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: urlRedireccion(),
      grant_type: "authorization_code",
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`Google rechazó el código (${respuesta.status}).`);
  }

  const datos = (await respuesta.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };

  // El correo sale del id_token sin necesidad de otra llamada.
  let email: string | null = null;
  if (datos.id_token) {
    try {
      const carga = JSON.parse(
        Buffer.from(datos.id_token.split(".")[1], "base64").toString(),
      );
      email = carga.email ?? null;
    } catch {
      email = null;
    }
  }

  const expiraEl = new Date(Date.now() + datos.expires_in * 1000);

  const accessCifrado = cifrar(datos.access_token);
  const refreshCifrado = datos.refresh_token ? cifrar(datos.refresh_token) : null;

  await prisma.cuentaGoogle.upsert({
    where: { usuarioId },
    update: {
      accessToken: accessCifrado,
      // Google solo manda refresh_token la primera vez. Si no viene,
      // se conserva el que ya habia.
      ...(refreshCifrado ? { refreshToken: refreshCifrado } : {}),
      expiraEl,
      email,
    },
    create: {
      usuarioId,
      accessToken: accessCifrado,
      refreshToken: refreshCifrado,
      expiraEl,
      email,
    },
  });
}

/** Devuelve un token válido, renovándolo si hace falta. */
async function tokenValido(usuarioId: string): Promise<string> {
  const cuenta = await prisma.cuentaGoogle.findUnique({ where: { usuarioId } });
  if (!cuenta) throw new Error("SIN_CUENTA");

  // Margen de un minuto para no usar un token que caduca a mitad de llamada.
  if (cuenta.expiraEl.getTime() - Date.now() > 60_000) {
    return descifrar(cuenta.accessToken);
  }

  if (!cuenta.refreshToken) throw new Error("SIN_REFRESCO");

  const respuesta = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: descifrar(cuenta.refreshToken),
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });

  if (!respuesta.ok) {
    // Pasa cuando se revoca el permiso o caduca el refresco en modo pruebas.
    await prisma.cuentaGoogle.delete({ where: { usuarioId } });
    throw new Error("SIN_CUENTA");
  }

  const datos = (await respuesta.json()) as {
    access_token: string;
    expires_in: number;
  };

  await prisma.cuentaGoogle.update({
    where: { usuarioId },
    data: {
      accessToken: cifrar(datos.access_token),
      expiraEl: new Date(Date.now() + datos.expires_in * 1000),
    },
  });

  return datos.access_token;
}

async function pedir<T>(usuarioId: string, ruta: string): Promise<T> {
  const token = await tokenValido(usuarioId);
  const respuesta = await fetch(`${CLASSROOM}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new Error(`Classroom respondió ${respuesta.status}: ${cuerpo.slice(0, 200)}`);
  }

  return respuesta.json() as Promise<T>;
}

export type CursoClassroom = {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
};

/** Cursos activos donde la persona figura como profesor. */
export async function listarCursos(
  usuarioId: string,
): Promise<CursoClassroom[]> {
  const datos = await pedir<{ courses?: CursoClassroom[] }>(
    usuarioId,
    "/courses?teacherId=me&courseStates=ACTIVE&pageSize=100",
  );
  return datos.courses ?? [];
}

export type EstudianteClassroom = {
  email: string;
  nombre: string | null;
  apellido: string | null;
};

/** Lista de estudiantes de un curso, paginando hasta acabar. */
export async function listarEstudiantes(
  usuarioId: string,
  cursoId: string,
): Promise<EstudianteClassroom[]> {
  type Fila = {
    profile?: {
      emailAddress?: string;
      name?: { givenName?: string; familyName?: string };
    };
  };

  const salida: EstudianteClassroom[] = [];
  let pagina = "";

  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const datos = await pedir<{ students?: Fila[]; nextPageToken?: string }>(
      usuarioId,
      `/courses/${cursoId}/students?pageSize=100${
        pagina ? `&pageToken=${pagina}` : ""
      }`,
    );

    for (const fila of datos.students ?? []) {
      const email = fila.profile?.emailAddress?.trim().toLowerCase();
      if (!email) continue;
      salida.push({
        email,
        nombre: fila.profile?.name?.givenName ?? null,
        apellido: fila.profile?.name?.familyName ?? null,
      });
    }

    if (!datos.nextPageToken) break;
    pagina = datos.nextPageToken;
  }

  return salida;
}
