import type { TFunction } from 'i18next';
import { estructuras, nodos, PENDIENTE } from '../data/atlas';
import type { Estructura, Idioma } from '../data/tipos';

const otro = (i: Idioma): Idioma => (i === 'es' ? 'en' : 'es');

/** Nombre de una entrada en el idioma activo; si falta, el del otro idioma. */
export function nombre(e: Estructura | undefined, idioma: Idioma): string {
  if (!e) return '';
  const n = e.nombre[idioma];
  return n && n !== PENDIENTE ? n : e.nombre[otro(idioma)];
}

export function nombrePendiente(e: Estructura | undefined, idioma: Idioma): boolean {
  return !!e && e.nombre[idioma] === PENDIENTE;
}

/** "Hipocampo / Hippocampus" en modo ambos idiomas. */
export function nombreVisible(e: Estructura | undefined, idioma: Idioma, ambos: boolean): string {
  const a = nombre(e, idioma);
  if (!ambos || !e) return a;
  const b = nombre(e, otro(idioma));
  return a === b ? a : `${a} / ${b}`;
}

/** Nombre de una pieza con su lado: "Hipocampo (izquierdo)". */
export function nombrePieza(piezaId: string, idioma: Idioma, ambos: boolean, t: TFunction): string {
  const n = nodos[piezaId];
  if (!n) return '';
  const e = estructuras[n.tipo === 'pieza' ? n.estructura! : n.id];
  const base = nombreVisible(e, idioma, ambos) || n.en;
  if (n.lado === 'l') return `${base} (${t('lado.izquierdo')})`;
  if (n.lado === 'r') return `${base} (${t('lado.derecho')})`;
  return base;
}

export function nombreNodo(id: string, idioma: Idioma, ambos: boolean, t: TFunction): string {
  const n = nodos[id];
  if (n?.tipo === 'pieza') return nombrePieza(id, idioma, ambos, t);
  const e = estructuras[id];
  if (e) return nombreVisible(e, idioma, ambos);
  if (id === 'g-organos-referencia') return t('arbol.organosReferencia');
  return n?.en ?? id;
}
