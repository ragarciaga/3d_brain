// Direcciones de cámara de las vistas anatómicas (F1), en coordenadas glTF (Y arriba).
// Medido en el modelo: las piezas izquierdas (.l) están en +X y lo anterior en +Z.
import type { Vista } from './enlaces';

export const DIRECCIONES: Record<Vista | 'inicio', [number, number, number]> = {
  anterior: [0, 0, 1],
  posterior: [0, 0, -1],
  'lateral-izq': [1, 0, 0],
  'lateral-der': [-1, 0, 0],
  superior: [0, 1, 0.0001],
  inferior: [0, -1, 0.0001],
  inicio: [0.75, 0.3, 0.9],
};

/**
 * Si una pieza responde a toques: nunca oculta ni de referencia; en "aislar con contexto" los
 * fantasmas no se tocan, salvo con Shift para sumarlos al aislamiento (F5).
 */
export function esSeleccionable(p: { visible: boolean; referencia: boolean; fantasma: boolean; shift: boolean }): boolean {
  return p.visible && !p.referencia && (!p.fantasma || p.shift);
}
