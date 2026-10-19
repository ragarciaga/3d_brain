// Cliente del canal de retorno del modo revisión (F24, docs/adr/0012): habla con el Apps Script del
// editor mediante `fetch`. Toda respuesta del canal es entrada externa: se valida antes de usarla.
//
// Contrato de cable que el script (spec 03, T2) debe cumplir:
// - POST con `Content-Type: text/plain` (cualquier otra cabecera dispara la petición previa, que el
//   Apps Script no responde) y cuerpo JSON:
//   - `{accion:'guardar', carga:<texto de cargaRevisionV2>}`: `carga` va como texto, el mismo que el
//     script escribe en la hoja. El código del revisor va dentro de la carga. Responde
//     `{ok:true, recibidas:[<estructura|campo|idioma|fecha>, ...]}`.
//   - `{accion:'autorizar', r:<código>, version, vago}`. Responde `{ok:true}`.
//   - `{accion:'leer', r:<código>}`. Responde
//     `{ok:true, canal:<número>, respuestas:{v:2, r:<código>, e:{<id>:[{<claves cortas, con f>}]}},
//     retiradas:{v:2, r:<código>, e:{<id>:[{c, i?, d:"", f}]}}, autorizacion:{version, vago} | null}`. `canal` (2 o más)
//     dice que el script entiende los retiros; un script anterior no lo responde. `respuestas` no trae las claves
//     cuya última fila es un retiro (#217).
//   - Un retiro viaja en la carga de `guardar` como un elemento `{c, i?, d:"", f}`: no lleva propuesta, comentario
//     ni posición. El cliente solo lo manda si `leer` declaró `canal >= VERSION_CANAL`.
// - Ninguna petición lleva el código ni una query en la URL (S4, #162). El script ya no lee por GET (#169):
//   responde `formato` a cualquier GET, y este cliente nunca lo usa.
// - Un error siempre responde `{ok:false, error}` con `error` en `codigo_no_activo`, `demasiado_grande`,
//   `formato`, `demasiadas_peticiones`, `sin_autorizacion` o `interno`. `guardar` responde
//   `sin_autorizacion` si el código no tiene registrada en la hoja la autorización de la versión vigente, y
//   `formato` si la carga trae respuestas del vago y la última autorización no marca la casilla (#166).
//   `autorizar` responde `formato` si `version` no es la vigente (#169).
//
// Red caída, tiempo agotado (10 s), HTTP que no es 2xx y cuerpo que no es JSON valen `red`.
import { configRevision, VERSION_AUTORIZACION, VERSION_CANAL } from '../config/revision';
import { CLAVES_V2, cargaRevisionV2, esObjeto, fechaValida, respuestaValida, retiroValido } from './revision';
import type { Respuesta, Retiro } from './revision';

export interface Autorizacion {
  version: string;
  vago: boolean;
}

export type TipoErrorCanal =
  | 'codigo_no_activo'
  | 'demasiado_grande'
  | 'formato'
  | 'demasiadas_peticiones'
  | 'sin_autorizacion'
  | 'interno'
  | 'red';

const ERRORES_DEL_CONTRATO: readonly unknown[] = [
  'codigo_no_activo',
  'demasiado_grande',
  'formato',
  'demasiadas_peticiones',
  'sin_autorizacion',
  'interno',
];

/** Error del canal con su tipo traducido del contrato. */
export class ErrorCanal extends Error {
  readonly tipo: TipoErrorCanal;

  constructor(tipo: TipoErrorCanal) {
    super(`Canal: ${tipo}`);
    this.name = 'ErrorCanal';
    this.tipo = tipo;
  }
}

/** Milisegundos sin respuesta tras los cuales una petición cuenta como `red`. */
export const TIEMPO_CANAL_MS = 10_000;

/** Hay canal solo si `urlCanal` no está vacía. Se lee al llamar, nunca al importar. */
export function canalConfigurado(): boolean {
  return Boolean(configRevision.urlCanal);
}

/** Cuerpo del POST `guardar`: la carga `v:2` va como texto, igual que la guarda el script. */
export function cuerpoGuardar(codigo: string, respuestas: readonly (Respuesta | Retiro)[]): string {
  return JSON.stringify({ accion: 'guardar', carga: cargaRevisionV2(codigo, respuestas) });
}

/** Hace el POST con el cuerpo JSON y devuelve la respuesta con `ok: true`; todo lo demás lanza `ErrorCanal`. */
async function pedir(cuerpo: string): Promise<Record<string, unknown>> {
  if (!configRevision.urlCanal) throw new ErrorCanal('red');
  let datos: unknown;
  const control = new AbortController();
  // No se usa AbortSignal.timeout: los relojes simulados de Vitest no lo controlan.
  const temporizador = setTimeout(() => control.abort(), TIEMPO_CANAL_MS);
  try {
    const res = await fetch(new URL(configRevision.urlCanal), {
      method: 'POST',
      signal: control.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: cuerpo,
    });
    if (!res.ok) throw new ErrorCanal('red');
    datos = JSON.parse(await res.text());
  } catch {
    throw new ErrorCanal('red');
  } finally {
    clearTimeout(temporizador);
  }
  if (!esObjeto(datos) || typeof datos['ok'] !== 'boolean') throw new ErrorCanal('red');
  if (datos['ok']) return datos;
  const error = datos['error'];
  throw new ErrorCanal(ERRORES_DEL_CONTRATO.includes(error) ? (error as TipoErrorCanal) : 'interno');
}

/** La autorización solo vale con la versión vigente y `vago` booleano; en otro caso es null (falta autorizar). */
export function autorizacionVigente(a: unknown): Autorizacion | null {
  if (!esObjeto(a) || a['version'] !== VERSION_AUTORIZACION || typeof a['vago'] !== 'boolean') return null;
  return { version: VERSION_AUTORIZACION, vago: a['vago'] };
}

const CLAVES_CORTAS: readonly string[] = Object.values(CLAVES_V2);

/**
 * Margen (ms) sobre la hora del cliente que se tolera en la `f` de una respuesta del canal (24 h, por relojes
 * desajustados). Una fecha más lejana en el futuro ganaría siempre al fusionar por fecha más reciente.
 */
export const MARGEN_FECHA_FUTURA_MS = 24 * 60 * 60 * 1000;

/**
 * Recorre una carga `{v:2, r, e}` del canal y se queda con los elementos que pasan `valido`. Una carga de otro código,
 * de otra versión o sin `e` objeto da cero elementos. Un elemento se descarta entero si no es objeto, si trae alguna
 * clave fuera de `CLAVES_V2` (incluida `__proto__`), si no tiene `f` válida, si su `f` pasa de la hora actual más
 * `MARGEN_FECHA_FUTURA_MS` o si no pasa `valido`. Solo copia claves conocidas a un objeto nuevo.
 */
function elementosDelCanal<T>(
  d: unknown,
  codigo: string,
  idOk: (id: unknown) => boolean,
  valido: (r: unknown, idOk: (id: unknown) => boolean) => boolean,
): { elementos: T[]; descartadas: number } {
  const elementos: T[] = [];
  if (d === undefined || d === null) return { elementos, descartadas: 0 };
  if (!esObjeto(d) || d['v'] !== 2 || d['r'] !== codigo || !esObjeto(d['e'])) return { elementos, descartadas: 1 };
  let descartadas = 0;
  const tope = Date.now() + MARGEN_FECHA_FUTURA_MS;
  for (const [id, lista] of Object.entries(d['e'])) {
    if (!Array.isArray(lista)) {
      descartadas++;
      continue;
    }
    if (!idOk(id)) {
      descartadas += lista.length;
      continue;
    }
    for (const el of lista as unknown[]) {
      if (!esObjeto(el) || Object.keys(el).some((k) => !CLAVES_CORTAS.includes(k))) {
        descartadas++;
        continue;
      }
      const copia: Record<string, unknown> = { estructura: id };
      for (const [largo, corto] of Object.entries(CLAVES_V2)) if (Object.hasOwn(el, corto)) copia[largo] = el[corto];
      if (Object.hasOwn(el, 'f') && fechaValida(el['f']) && Date.parse(el['f']) <= tope && valido(copia, idOk)) elementos.push(copia as T);
      else descartadas++;
    }
  }
  return { elementos, descartadas };
}

/**
 * Única puerta de entrada de las respuestas del canal a la app. `d` es la carga `{v:2, r, e}`: pasa por
 * `elementosDelCanal` con `respuestaValida`. Un elemento con `d` vacío (un retiro) no es una respuesta: se descarta.
 */
export function respuestasDelCanal(
  d: unknown,
  codigo: string,
  idOk: (id: unknown) => boolean,
): { respuestas: Respuesta[]; descartadas: number } {
  const { elementos, descartadas } = elementosDelCanal<Respuesta>(d, codigo, idOk, respuestaValida);
  return { respuestas: elementos, descartadas };
}

/**
 * Única puerta de entrada de los retiros del canal (el campo `retiradas` de `leer`, #217), con las mismas puertas
 * que `respuestasDelCanal` pero con `retiroValido`: solo `{c, i?, d:"", f}`.
 */
export function retirosDelCanal(
  d: unknown,
  codigo: string,
  idOk: (id: unknown) => boolean,
): { retiros: Retiro[]; descartadas: number } {
  const { elementos, descartadas } = elementosDelCanal<Retiro>(d, codigo, idOk, retiroValido);
  return { retiros: elementos, descartadas };
}

/** Lo que el canal guarda de un código: sus respuestas y retiros validados, si el script entiende los retiros, y su autorización vigente (o null). */
export async function leer(
  codigo: string,
  idOk: (id: unknown) => boolean,
): Promise<{ respuestas: Respuesta[]; retiros: Retiro[]; retirosAdmitidos: boolean; autorizacion: Autorizacion | null }> {
  const res = await pedir(JSON.stringify({ accion: 'leer', r: codigo }));
  const { respuestas, descartadas } = respuestasDelCanal(res['respuestas'], codigo, idOk);
  const { retiros, descartadas: retirosDescartados } = retirosDelCanal(res['retiradas'], codigo, idOk);
  const total = descartadas + retirosDescartados;
  // Solo el número: nunca el código ni el contenido.
  if (total > 0) console.warn(`Canal: ${total} respuesta(s) descartada(s) por no ser válidas`);
  // Un script anterior no responde `canal`: no entiende los retiros y rechazaría con `formato` una carga que los lleve.
  const retirosAdmitidos = typeof res['canal'] === 'number' && res['canal'] >= VERSION_CANAL;
  return { respuestas, retiros, retirosAdmitidos, autorizacion: autorizacionVigente(res['autorizacion']) };
}

/** Primera espera (ms) antes de volver a intentar una lectura `leer` fallida; se duplica con cada fallo seguido (#240). */
export const ESPERA_LECTURA_INICIAL_MS = 2000;
/** Tope (ms) de la espera entre lecturas fallidas: un `leer` por minuto y por pestaña, muy por debajo del límite del script. */
export const ESPERA_LECTURA_MAXIMA_MS = 60_000;

/**
 * Programa el reintento de `leer` (#240): lógica pura, sin temporizadores. Con `fallo` el contador sube y la espera
 * es 2000, 4000, 8000... con tope de 60000; con `ok` o `inactivo` no hay más intentos (`espera: null`) y `ok` pone
 * el contador en cero. Un contador que no es finito o es menor que 0 vale 0. Nunca da NaN ni Infinity. No usa
 * `colaGuardado`, que ya importa este módulo.
 */
export function siguienteLectura(
  fallos: number,
  resultado: 'ok' | 'fallo' | 'inactivo',
): { fallos: number; espera: number | null } {
  if (resultado === 'ok') return { fallos: 0, espera: null };
  const previos = Number.isFinite(fallos) && fallos > 0 ? Math.floor(fallos) : 0;
  if (resultado === 'inactivo') return { fallos: previos, espera: null };
  const n = previos + 1;
  return { fallos: n, espera: Math.min(ESPERA_LECTURA_MAXIMA_MS, ESPERA_LECTURA_INICIAL_MS * 2 ** (n - 1)) };
}

/** Envía las respuestas (y los retiros) y devuelve las claves de confirmación (`estructura|campo|idioma|fecha`) que el canal recibió. */
export async function guardar(codigo: string, respuestas: readonly (Respuesta | Retiro)[]): Promise<Set<string>> {
  const res = await pedir(cuerpoGuardar(codigo, respuestas));
  const recibidas = res['recibidas'];
  return new Set(Array.isArray(recibidas) ? recibidas.filter((x): x is string => typeof x === 'string') : []);
}

/** Registra la autorización de tratamiento de datos del código (Ley 1581 de 2012). */
export async function autorizar(codigo: string, a: Autorizacion): Promise<void> {
  await pedir(JSON.stringify({ accion: 'autorizar', r: codigo, version: a.version, vago: a.vago }));
}
