// Modo revisión docente (F24): cada respuesta se refiere a una unidad revisable concreta.
export type Veredicto = 'correcto' | 'corregir' | 'no_es_mi_area';

export interface Respuesta {
  estructura: string; // id en estructuras.json
  campo: string; // 'pieza', 'nombre', 'latin', 'ubicacion', 'que_es', 'para_que_sirve', 'relaciones', 'relevancia.0', 'fuente.1', 'posicion', 'trazo.07' ...
  idioma?: 'es' | 'en';
  veredicto: Veredicto;
  propuesta?: string;
  comentario?: string;
  posicion?: [number, number, number]; // glTF, Y arriba (marcadores)
  malla?: string; // trazo del vago: nombre de la malla
  ramo?: string; // trazo del vago: id del marcador del ramo, 'no_es_ramo' o 'no_se'
  version: string; // versión del contenido revisado
  fecha: string;
}

export const claveRespuesta = (r: Pick<Respuesta, 'estructura' | 'campo' | 'idioma'>) =>
  `${r.estructura}|${r.campo}|${r.idioma ?? ''}`;

/** Código del revisor: 8 caracteres A-Z0-9 según docs/revision-docente.md; se admiten guion y guion bajo. */
export const REVISOR_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
/** Campos que genera la app (nombre, latin, relevancia.N, fuente.N, posicion...) o `trazo:<malla>` sin comillas invertidas, barras verticales, saltos de línea ni ángulos. */
const CAMPO_VALIDO = /^([a-z_]+(\.\d+)?|trazo:[^\r\n`|<>]{1,120})$/;
/** Versión semántica de la ficha, o `sin-ficha` para un marcador. */
const VERSION_VALIDA = /^(\d+\.\d+\.\d+|sin-ficha)$/;
/** Tope de caracteres de los textos libres. */
const MAX_TEXTO_LARGO = 4000;
const MAX_TEXTO_CORTO = 200;
const VEREDICTOS: readonly unknown[] = ['correcto', 'corregir', 'no_es_mi_area'];
const IDIOMAS: readonly unknown[] = ['es', 'en'];
const CAMPOS_TEXTO = ['campo', 'propuesta', 'comentario', 'version', 'malla', 'ramo'] as const;
const TOPES: Partial<Record<(typeof CAMPOS_TEXTO)[number], number>> = { propuesta: MAX_TEXTO_LARGO, comentario: MAX_TEXTO_LARGO, malla: MAX_TEXTO_CORTO, ramo: MAX_TEXTO_CORTO };

export const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Entrada externa (el CSV del formulario público o un archivo de respaldo): puede traer cualquier cosa. Una respuesta
 * solo vale con estructura conocida, veredicto del conjunto cerrado, idioma es o en (o ausente),
 * `campo` con la forma que genera la app, `version` semántica o `sin-ficha`, los demás textos (si
 * vienen) como texto con tope de largo (4000 propuesta y comentario, 200 malla y ramo) y `posicion`
 * (si viene) como tres números finitos. Nunca lanza: devuelve false.
 */
export function respuestaValida(r: unknown, idOk: (id: unknown) => boolean): r is Respuesta {
  if (!esObjeto(r) || !idOk(r['estructura'])) return false;
  if (!VEREDICTOS.includes(r['veredicto'])) return false;
  if (r['idioma'] !== undefined && !IDIOMAS.includes(r['idioma'])) return false;
  if (typeof r['campo'] !== 'string' || !CAMPO_VALIDO.test(r['campo'])) return false;
  if (typeof r['version'] !== 'string' || !VERSION_VALIDA.test(r['version'])) return false;
  for (const k of CAMPOS_TEXTO) if (r[k] !== undefined && typeof r[k] !== 'string') return false;
  for (const [k, tope] of Object.entries(TOPES)) {
    const v = r[k];
    if (typeof v === 'string' && v.length > tope) return false;
  }
  const p = r['posicion'];
  if (p !== undefined && !(Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))) return false;
  return true;
}

/**
 * Posición que el revisor ya propuso para un marcador, o null si no hay.
 * `piezas` dice sobre qué pieza cayó el toque (solo en esta sesión); si no se conoce, `pieza` es null.
 */
export function propuestaDePosicion(
  respuestas: Record<string, Respuesta>,
  piezas: Record<string, string>,
  estructura: string,
): { respuesta: Respuesta; pieza: string | null } | null {
  const respuesta = respuestas[claveRespuesta({ estructura, campo: 'posicion' })];
  if (!respuesta || !respuesta.posicion) return null;
  return { respuesta, pieza: piezas[estructura] ?? null };
}

/** Inversa de `claveRespuesta`. Lanza si la clave no tiene tres partes o el idioma no es '', 'es' ni 'en'. */
export function desdeClave(clave: string): Pick<Respuesta, 'estructura' | 'campo' | 'idioma'> {
  const partes = clave.split('|');
  if (partes.length !== 3) throw new Error(`Clave de respuesta inválida: ${clave}`);
  const [estructura, campo, idioma] = partes as [string, string, string];
  if (idioma !== '' && idioma !== 'es' && idioma !== 'en') throw new Error(`Idioma inválido en la clave: ${clave}`);
  return { estructura, campo, idioma: idioma === '' ? undefined : idioma };
}

/**
 * Respuestas `correcto` para las claves que aún no tienen ninguna. Lo que ya tiene respuesta, de cualquier
 * tipo, incluido un "Corregir" sin texto, no se toca (#66). No muta `respuestas`; omite claves repetidas.
 */
export function pendientesComoCorrectas(
  claves: string[],
  respuestas: Record<string, Respuesta>,
  version: string,
  fecha: string,
): Respuesta[] {
  return [...new Set(claves)]
    .filter((k) => respuestas[k] === undefined)
    .map((k) => ({ ...desdeClave(k), veredicto: 'correcto' as const, version, fecha }));
}

export interface ConfigFormulario {
  urlFormulario: string;
  campos: { codigo: string; estructura: string; revision: string };
}

/** Límite prudente de largo de URL para formularios de Google. */
export const MAX_URL = 7000;

export function formularioConfigurado(c: ConfigFormulario): boolean {
  return Boolean(c.urlFormulario && c.campos.codigo && c.campos.estructura && c.campos.revision);
}

/** Datos compactos de una revisión, listos para pegar o enviar. */
export function cargaRevision(codigo: string, estructura: string, respuestas: Respuesta[]): string {
  return JSON.stringify({ v: 1, revisor: codigo, estructura, respuestas });
}

/** URL prellenada del formulario, o null si no está configurado o la revisión es muy larga. */
export function urlFormulario(c: ConfigFormulario, codigo: string, estructura: string, respuestas: Respuesta[]): string | null {
  if (!formularioConfigurado(c)) return null;
  const p = new URLSearchParams({ usp: 'pp_url' });
  p.set(c.campos.codigo, codigo);
  p.set(c.campos.estructura, estructura);
  p.set(c.campos.revision, cargaRevision(codigo, estructura, respuestas));
  const url = `${c.urlFormulario}?${p.toString()}`;
  return url.length > MAX_URL ? null : url;
}

/** Pausa (ms) entre la última tecla y el guardado de lo que el docente escribe en la ficha. */
export const ESPERA_GUARDADO_MS = 500;

/**
 * Un "Corregir" sin texto propuesto, sin posición y sin ramo no dice qué corregir: está incompleto
 * y no se envía. La posición de un marcador y el ramo de un trazo son la propuesta de esas respuestas.
 */
export function respuestaCompleta(r: Respuesta): boolean {
  if (r.veredicto !== 'corregir') return true;
  return Boolean(r.propuesta?.trim()) || Boolean(r.posicion) || Boolean(r.ramo);
}

/** Separa las respuestas que se pueden enviar de las incompletas, que solo se cuentan. */
export function separarIncompletas(l: Respuesta[]): { completas: Respuesta[]; incompletas: number } {
  const completas = l.filter(respuestaCompleta);
  return { completas, incompletas: l.length - completas.length };
}

/**
 * Lo que falta guardar de los campos de texto de una ficha, o null si no hay nada nuevo.
 * La propuesta solo existe con el veredicto `corregir`; un texto vacío es lo mismo que ninguno.
 */
export function cambiosDeTexto(
  r: Respuesta,
  texto: string,
  comentario: string,
): { propuesta?: string; comentario?: string } | null {
  const propuesta = r.veredicto === 'corregir' ? texto || undefined : undefined;
  const nota = comentario || undefined;
  if (propuesta === r.propuesta && nota === r.comentario) return null;
  return { propuesta, comentario: nota };
}

/** Respuestas cuya versión ya no coincide con la del contenido actual. */
export function desactualizadas(respuestas: Respuesta[], versionActual: (estructura: string) => string): Respuesta[] {
  return respuestas.filter((r) => r.version !== versionActual(r.estructura));
}

/**
 * URL prellenadas para enviar una revisión larga en partes que quepan en el límite de URL.
 * Devuelve [] si el formulario no está configurado o si una sola respuesta no cabe.
 */
export function urlsFormulario(c: ConfigFormulario, codigo: string, estructura: string, respuestas: Respuesta[]): string[] {
  if (!formularioConfigurado(c) || !respuestas.length) return [];
  const partes: Respuesta[][] = [];
  let actual: Respuesta[] = [];
  for (const r of respuestas) {
    const prueba = [...actual, r];
    if (urlFormulario(c, codigo, estructura, prueba)) actual = prueba;
    else {
      if (!actual.length) return []; // una sola respuesta excede el límite
      partes.push(actual);
      actual = [r];
      if (!urlFormulario(c, codigo, estructura, actual)) return [];
    }
  }
  if (actual.length) partes.push(actual);
  return partes.map((p) => urlFormulario(c, codigo, estructura, p)!);
}
