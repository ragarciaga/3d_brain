// Recorrido guiado del vago (F14, ADR 0009). El nervio no se separa: se recorre de arriba abajo y en
// cada parada se dibuja solo hasta el nivel de esa parada (revelado progresivo). Los niveles salen de
// las cajas reales de las piezas; los textos, de las fichas con fuente.
import datos from '../data/recorridos.json';
import { GRUPO_VAGO, piezasBajo, piezasDeEntrada } from '../data/atlas';
import type { Caja } from './inventario';

export interface Parada {
  id: string;
  principal: string; // entrada cuya ficha da el texto de la parada
  relacionadas: string[];
  encuadrar: string[];
  hasta: { entrada: string; borde: 'min' | 'max' } | null; // null: el nervio completo
}

export const paradasVago: Parada[] = datos.recorridos.vago.paradas as Parada[];

/** Altura (Y del mundo) hasta donde se dibuja el vago en una parada; null si se ve completo. */
export function nivelDeParada(parada: Parada, cajas: Record<string, Caja>): number | null {
  if (!parada.hasta) return null;
  const ys: number[] = [];
  for (const p of piezasDeEntrada(parada.hasta.entrada)) {
    const c = cajas[p];
    if (c) ys.push(parada.hasta.borde === 'min' ? c[0][1] : c[1][1]);
  }
  if (!ys.length) return null;
  return parada.hasta.borde === 'min' ? Math.min(...ys) : Math.max(...ys);
}

/** Lo que queda nítido durante el recorrido: el vago, el tronco encefálico y los órganos de referencia. */
export function piezasDelRecorrido(): string[] {
  return [...new Set([...piezasBajo(GRUPO_VAGO), ...piezasBajo('g-brainstem'), ...piezasBajo('g-organos-referencia')])];
}

/** Piezas a encuadrar en una parada. */
export function encuadreDeParada(parada: Parada): string[] {
  return [...new Set(parada.encuadrar.flatMap((e) => piezasDeEntrada(e)))];
}
