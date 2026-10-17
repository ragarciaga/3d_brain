// Trazos del vago (F24): los ramos vienen del modelo como mallas `#tNN` sin nombre y el docente dice
// qué ramo es cada una. Lógica pura: sin React, sin store y sin `window`.
import { esMallaDeToque, GRUPO_VAGO, marcadores, trazoDeMalla, trazosAuditados } from '../data/atlas';
import type { Bilingue, ConfianzaTrazo } from '../data/tipos';
import { claveRespuesta, respuestaCompleta, type Respuesta } from './revision';

/** Entrada de estructuras.json donde se guardan las respuestas de los trazos del vago. */
export const ENTRADA_VAGO = 'vagus-nerve-x';

/** Clave de la respuesta de un trazo en `respuestas`. */
export const claveTrazo = (malla: string) => claveRespuesta({ estructura: ENTRADA_VAGO, campo: `trazo:${malla}` });

/** Mallas de trazo (no las de toque) sin repetir, en orden de nombre: `.l#t00..` y después `.r#t00..`. */
export function ordenarTrazos(nombres: Iterable<string>): string[] {
  const unicos = new Set<string>();
  for (const n of nombres) if (trazoDeMalla(n) !== null && !esMallaDeToque(n)) unicos.add(n);
  return [...unicos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const pendiente = (malla: string, respuestas: Record<string, Respuesta>) => {
  const r = respuestas[claveTrazo(malla)];
  return !r || !respuestaCompleta(r);
};

/** Trazos sin respuesta completa, en el mismo orden de `trazos`. */
export function trazosPendientes(trazos: string[], respuestas: Record<string, Respuesta>): string[] {
  return trazos.filter((m) => pendiente(m, respuestas));
}

export function avanceTrazos(trazos: string[], respuestas: Record<string, Respuesta>): { pendientes: number; total: number } {
  return { pendientes: trazosPendientes(trazos, respuestas).length, total: trazos.length };
}

/**
 * El primer trazo pendiente después de `actual`, volviendo al inicio y sin contar `actual`.
 * Si `actual` es null o no está en la lista, el primer pendiente; si no hay ninguno, null.
 */
export function siguienteTrazo(trazos: string[], respuestas: Record<string, Respuesta>, actual: string | null): string | null {
  const pendientes = trazos.filter((m) => m !== actual && pendiente(m, respuestas));
  const i = actual === null ? -1 : trazos.indexOf(actual);
  if (i < 0) return pendientes[0] ?? null;
  return pendientes.find((m) => trazos.indexOf(m) > i) ?? pendientes[0] ?? null;
}

/** Ramos que el docente puede elegir para un trazo: los marcadores del vago, menos el foramen yugular. */
export function ramosDeTrazo(): string[] {
  return marcadores.filter((m) => m.padre === GRUPO_VAGO && m.id !== 'm-jugular-foramen').map((m) => m.id);
}

/** Lo que propone la auditoría del modelo para un trazo cuando es una sola opción de la lista; si no, null. */
export function propuestaDeTrazo(malla: string): string | null {
  return trazosAuditados.find((t) => t.malla === malla)?.propuesta ?? null;
}

/**
 * Todo lo que la auditoría dejó para un trazo, para mostrarlo al docente: la propuesta (o null), la
 * confianza, la evidencia en los dos idiomas y la clave de la fuente. Null si la malla no se auditó.
 * La evidencia y la confianza faltan (null) en un registro que no las trae.
 */
export function auditoriaDeTrazo(malla: string): {
  propuesta: string | null;
  confianza: ConfianzaTrazo | null;
  evidencia: Bilingue | null;
  fuente: string | null;
} | null {
  const t = trazosAuditados.find((x) => x.malla === malla);
  if (!t) return null;
  const evidencia = t.evidencia && (t.evidencia.es || t.evidencia.en) ? t.evidencia : null;
  return { propuesta: t.propuesta ?? null, confianza: t.confianza ?? null, evidencia, fuente: t.fuente || null };
}
