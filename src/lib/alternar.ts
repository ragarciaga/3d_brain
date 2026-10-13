// Botones que se alternan de la ficha y del árbol (F4, F5, F6): si ya están activos para las piezas
// de la ficha, un segundo toque los apaga. Funciones puras para probarlas sin navegador.
import type { Vec3 } from './explosion';

/** Estado de un botón que se alterna: activo, inactivo o activo solo para algunas piezas. */
export type Pulsado = boolean | 'mixed';

/**
 * Si el aislamiento actual coincide con el que pediría el botón.
 * true: mismo modo y mismo conjunto de piezas. 'mixed': mismo modo y comparten al menos una pieza
 * sin ser iguales. false: en cualquier otro caso (sin aislamiento, otro modo, disjuntos o sin piezas).
 */
export function estadoAislar(
  aislar: { modo: 'solo' | 'contexto'; piezas: Set<string> } | null,
  modo: 'solo' | 'contexto',
  piezas: string[],
): Pulsado {
  if (!aislar || aislar.modo !== modo || piezas.length === 0) return false;
  const pedidas = new Set(piezas);
  let comunes = 0;
  for (const p of pedidas) if (aislar.piezas.has(p)) comunes += 1;
  if (comunes === 0) return false;
  return comunes === pedidas.size && comunes === aislar.piezas.size ? true : 'mixed';
}

/**
 * Si las piezas están separadas a mano: separada es tener clave en `separadas` y no estar en `devueltas`.
 * true: todas. 'mixed': algunas. false: ninguna, o sin piezas.
 */
export function estadoSeparar(separadas: Record<string, Vec3>, devueltas: Set<string>, piezas: string[]): Pulsado {
  const unicas = [...new Set(piezas)];
  if (unicas.length === 0) return false;
  const n = unicas.filter((p) => p in separadas && !devueltas.has(p)).length;
  if (n === 0) return false;
  return n === unicas.length ? true : 'mixed';
}

/** Si las piezas están ocultas. true: todas. 'mixed': algunas. false: ninguna, o sin piezas. */
export function estadoOcultar(ocultas: Set<string>, piezas: string[]): Pulsado {
  const unicas = [...new Set(piezas)];
  if (unicas.length === 0) return false;
  const n = unicas.filter((p) => ocultas.has(p)).length;
  if (n === 0) return false;
  return n === unicas.length ? true : 'mixed';
}

/** Qué hace el botón al pulsarlo: solo un estado totalmente activo se apaga; el parcial se completa. */
export function accionAlPulsar(estado: Pulsado): 'activar' | 'desactivar' {
  return estado === true ? 'desactivar' : 'activar';
}

/**
 * Atributos de un botón que se alterna: `aria-pressed` ("mixed" si es parcial) y la clase `activo` o
 * `parcial`. La forma (borde punteado en `parcial`) distingue el estado, no solo el color.
 */
export function propsPulsado(estado: Pulsado, base = ''): { 'aria-pressed': boolean | 'mixed'; className: string | undefined } {
  const clase = estado === true ? 'activo' : estado === 'mixed' ? 'parcial' : '';
  return { 'aria-pressed': estado, className: [base, clase].filter(Boolean).join(' ') || undefined };
}
