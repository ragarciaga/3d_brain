// Respaldo del modo revisión (F24): el avance vive solo en IndexedDB, así que el docente puede bajarlo a un
// archivo y recuperarlo. El archivo es entrada externa: se valida como una fila del formulario público.
import { claveRespuesta, esObjeto, respuestaValida, REVISOR_VALIDO, type Respuesta } from './revision';

export const FORMATO_RESPALDO = 'atlas-revision-respaldo';
/** Tope de bytes del archivo y de caracteres del texto leído. */
export const MAX_RESPALDO_CARACTERES = 10_000_000;
export const MAX_RESPALDO_RESPUESTAS = 50_000;
const MAX_FECHA = 40;
const CLAVES_RESPUESTA = ['estructura', 'campo', 'idioma', 'veredicto', 'propuesta', 'comentario', 'posicion', 'malla', 'ramo', 'version', 'fecha'] as const;

export type ErrorRespaldo = 'grande' | 'json' | 'formato' | 'version' | 'otroRevisor';

/** Texto del archivo de respaldo. No lleva el estado de envío. */
export function crearRespaldo(revisor: string, respuestas: Record<string, Respuesta>, ahora = new Date()): string {
  return JSON.stringify({ formato: FORMATO_RESPALDO, v: 1, revisor, exportado: ahora.toISOString(), respuestas: Object.values(respuestas) }, null, 2);
}

/** Milisegundos de una fecha; una que no se puede leer vale -Infinity, así cualquier fecha válida la reemplaza. */
const tiempo = (fecha: string) => {
  const t = Date.parse(fecha);
  return Number.isFinite(t) ? t : -Infinity;
};

/** Copia solo las claves conocidas, propias y definidas: nada inesperado llega a IndexedDB ni al formulario. */
function limpiar(r: Respuesta): Respuesta {
  const copia: Record<string, unknown> = {};
  for (const k of CLAVES_RESPUESTA) if (Object.hasOwn(r, k) && r[k] !== undefined) copia[k] = r[k];
  return copia as unknown as Respuesta;
}

/** Valida el texto de un respaldo. Las respuestas inválidas se omiten y se cuentan; el resto del archivo se rechaza entero. */
export function leerRespaldo(
  texto: string,
  o: { revisor: string; idOk: (id: unknown) => boolean },
): { ok: true; respuestas: Respuesta[]; descartadas: number } | { ok: false; error: ErrorRespaldo } {
  if (texto.length > MAX_RESPALDO_CARACTERES) return { ok: false, error: 'grande' };
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!esObjeto(d) || d['formato'] !== FORMATO_RESPALDO || !Array.isArray(d['respuestas'])) return { ok: false, error: 'formato' };
  if (d['v'] !== 1) return { ok: false, error: 'version' };
  const revisor = d['revisor'];
  if (typeof revisor !== 'string' || !REVISOR_VALIDO.test(revisor)) return { ok: false, error: 'formato' };
  if (revisor !== o.revisor) return { ok: false, error: 'otroRevisor' };
  if (d['respuestas'].length > MAX_RESPALDO_RESPUESTAS) return { ok: false, error: 'grande' };
  const respuestas: Respuesta[] = [];
  let descartadas = 0;
  for (const r of d['respuestas'] as unknown[]) {
    const fecha = esObjeto(r) ? r['fecha'] : undefined;
    if (respuestaValida(r, o.idOk) && typeof fecha === 'string' && fecha.length <= MAX_FECHA && tiempo(fecha) > -Infinity) respuestas.push(limpiar(r));
    else descartadas++;
  }
  return { ok: true, respuestas, descartadas };
}

/** Une las respuestas importadas con las actuales: por clave gana la `fecha` estrictamente más nueva. No muta. */
export function fusionarRespuestas(
  actuales: Record<string, Respuesta>,
  nuevas: Respuesta[],
): { respuestas: Record<string, Respuesta>; agregadas: number; actualizadas: number; sinCambio: number } {
  const respuestas = { ...actuales };
  let agregadas = 0;
  let actualizadas = 0;
  let sinCambio = 0;
  for (const n of nuevas) {
    const k = claveRespuesta(n);
    const existente = respuestas[k];
    if (existente === undefined) {
      respuestas[k] = n;
      agregadas++;
    } else if (tiempo(n.fecha) > tiempo(existente.fecha)) {
      respuestas[k] = n;
      actualizadas++;
    } else sinCambio++;
  }
  return { respuestas, agregadas, actualizadas, sinCambio };
}

/** Piezas propuestas que siguen valiendo: las de los marcadores cuya respuesta `posicion` no cambió al importar. */
export function piezasQueSiguen(
  piezas: Record<string, string>,
  antes: Record<string, Respuesta>,
  despues: Record<string, Respuesta>,
): Record<string, string> {
  const siguen: Record<string, string> = {};
  for (const [e, pieza] of Object.entries(piezas)) {
    const k = claveRespuesta({ estructura: e, campo: 'posicion' });
    if (despues[k] !== undefined && despues[k] === antes[k]) siguen[e] = pieza;
  }
  return siguen;
}
