// Trazos del vago (F24): los ramos vienen del modelo como mallas `#tNN` sin nombre y el docente dice
// qué ramo es cada una. Lógica pura: sin React, sin store y sin `window`.
import { esMallaDeToque, GRUPO_VAGO, marcadores, trazoDeMalla, trazosAuditados } from '../data/atlas';
import type { Bilingue, ConfianzaTrazo } from '../data/tipos';
import fuentesMd from '../../docs/research/marcadores/fuentes.md?raw';
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

/** Lo que propone la regla de la auditoría del modelo para un trazo (un ramo de la lista o 'no_es_ramo', según src/data/trazos-vago.json); null si la regla no distingue o la malla no está. */
export function propuestaDeTrazo(malla: string): string | null {
  return trazosAuditados.find((t) => t.malla === malla)?.propuesta ?? null;
}

/** Un identificador de una cita: el texto que se ve ("PMID 42595102") y a dónde lleva (siempre https). */
export interface IdentificadorCita {
  tipo: 'pmid' | 'doi' | 'url';
  texto: string;
  url: string;
}

/** Una entrada de la bibliografía de reglas (`## Referencias` de docs/research/marcadores/fuentes.md). */
export interface Cita {
  clave: string;
  autores: string;
  titulo: string;
  revista: string | null;
  anio: string;
  /** "Autores. Título. [Revista. ]Año.", tal como está escrito en la línea de la bibliografía. */
  texto: string;
  identificadores: IdentificadorCita[];
}

/**
 * Lee la sección `## Referencias` de fuentes.md: una cita por línea `- [Clave] Autores. Título. [Revista. ]Año.
 * PMID n. [PMCID x.] [DOI d.] [nota].` (o con una URL en vez de los identificadores). Solo cuenta lo que va
 * entre `## Referencias` y el siguiente `## `; una clave que aparece antes (en la tabla) no es una referencia.
 * Una entrada sin autores, título, año o identificador no se registra, para no mostrar nunca una cita a medias.
 * El PMCID y la nota de lectura se ignoran; un enlace que no es `https:` se descarta.
 */
export function leerReferencias(md: string): Map<string, Cita> {
  const refs = new Map<string, Cita>();
  const inicio = md.indexOf('\n## Referencias');
  if (inicio < 0) return refs;
  const resto = md.slice(inicio + 1);
  const fin = resto.indexOf('\n## ');
  const seccion = fin < 0 ? resto : resto.slice(0, fin);
  for (const linea of seccion.split('\n')) {
    const m = /^- \[([^\]]+)\] (.+)$/.exec(linea.trimEnd());
    if (!m) continue;
    const clave = m[1]!;
    const partes = m[2]!.replace(/\.$/, '').split('. ');
    const i = partes.findIndex((p, k) => k >= 2 && /^\d{4}$/.test(p));
    if (i < 0) continue;
    const autores = partes[0]!.trim();
    const titulo = partes[1]!.trim();
    const revista = partes.slice(2, i).join('. ').trim() || null;
    const identificadores: IdentificadorCita[] = [];
    for (const p of partes.slice(i + 1)) {
      const pmid = /^PMID (\d+)$/.exec(p);
      const doi = /^DOI (10\.\S+)$/.exec(p);
      if (pmid) identificadores.push({ tipo: 'pmid', texto: p, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/` });
      else if (doi) identificadores.push({ tipo: 'doi', texto: p, url: `https://doi.org/${doi[1]}` });
      else if (/^https:\/\/\S+$/.test(p)) identificadores.push({ tipo: 'url', texto: p, url: p });
    }
    if (!autores || !titulo || identificadores.length === 0) continue;
    const texto = `${autores}. ${titulo}. ${revista ? `${revista}. ` : ''}${partes[i]}.`;
    refs.set(clave, { clave, autores, titulo, revista, anio: partes[i]!, texto, identificadores });
  }
  return refs;
}

/** La bibliografía de reglas, leída una vez del mismo archivo que mantiene el editor (una sola fuente de verdad). */
const REFERENCIAS = leerReferencias(fuentesMd);

/** La cita de una clave de fuente (p. ej. "Bahadir2026"); null si la clave falta o la bibliografía no la trae completa. */
export function citaDeFuente(clave: string | null, refs: Map<string, Cita> = REFERENCIAS): Cita | null {
  return clave ? (refs.get(clave) ?? null) : null;
}

/**
 * Todo lo que la auditoría dejó para un trazo, para mostrarlo al docente: la propuesta (o null), la
 * confianza, la evidencia en los dos idiomas, la clave de la fuente y su cita (autores, título, año e
 * identificadores de la bibliografía; null si la bibliografía no la trae completa). Null si la malla no se auditó.
 * La evidencia y la confianza faltan (null) en un registro que no las trae.
 */
export function auditoriaDeTrazo(malla: string): {
  propuesta: string | null;
  confianza: ConfianzaTrazo | null;
  evidencia: Bilingue | null;
  fuente: string | null;
  cita: Cita | null;
} | null {
  const t = trazosAuditados.find((x) => x.malla === malla);
  if (!t) return null;
  const evidencia = t.evidencia && (t.evidencia.es || t.evidencia.en) ? t.evidencia : null;
  const fuente = t.fuente || null;
  return { propuesta: t.propuesta ?? null, confianza: t.confianza ?? null, evidencia, fuente, cita: citaDeFuente(fuente) };
}
