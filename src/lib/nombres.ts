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

/** Nombre de una pieza con su lado: "Hipocampo (izquierdo)". */
export function nombrePieza(piezaId: string, idioma: Idioma, t: TFunction): string {
  const n = nodos[piezaId];
  if (!n) return '';
  const e = estructuras[n.tipo === 'pieza' ? n.estructura! : n.id];
  const base = nombre(e, idioma) || n.en;
  if (n.lado === 'l') return `${base} (${t('lado.izquierdo')})`;
  if (n.lado === 'r') return `${base} (${t('lado.derecho')})`;
  return base;
}

export function nombreNodo(id: string, idioma: Idioma, t: TFunction): string {
  const n = nodos[id];
  if (n?.tipo === 'pieza') return nombrePieza(id, idioma, t);
  const e = estructuras[id];
  if (e) return nombre(e, idioma);
  if (id === 'g-organos-referencia') return t('arbol.organosReferencia');
  return n?.en ?? id;
}
