// Enlaces compartibles (F11): el estado de la vista viaja en la URL.
// Ejemplo: /es/insula?vista=lateral-izq&aislar=contexto&explosion=40&nivel=lobulos
import type { Nivel } from './explosion';

export const VISTAS = ['anterior', 'posterior', 'lateral-izq', 'lateral-der', 'superior', 'inferior'] as const;
export type Vista = (typeof VISTAS)[number];

export interface EstadoEnlace {
  vista?: Vista;
  camara?: number[]; // posición (3) y objetivo (3), redondeados a 0,1 mm
  aislar?: 'solo' | 'contexto';
  explosion?: number; // 0 a 100
  nivel?: Nivel;
  ambos?: boolean;
}

const NIVELES: Nivel[] = ['hemisferios', 'lobulos', 'piezas'];

export function serializar(e: EstadoEnlace): string {
  const p = new URLSearchParams();
  if (e.vista) p.set('vista', e.vista);
  if (e.camara && e.camara.length === 6) p.set('cam', e.camara.map((n) => n.toFixed(4)).join(','));
  if (e.aislar) p.set('aislar', e.aislar);
  if (e.explosion && e.explosion > 0) p.set('explosion', String(Math.round(e.explosion)));
  if (e.nivel && e.nivel !== 'piezas') p.set('nivel', e.nivel);
  if (e.ambos) p.set('ambos', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function leer(search: string): EstadoEnlace {
  const p = new URLSearchParams(search);
  const e: EstadoEnlace = {};
  const vista = p.get('vista');
  if (vista && (VISTAS as readonly string[]).includes(vista)) e.vista = vista as Vista;
  const cam = p.get('cam')?.split(',').map(Number);
  if (cam && cam.length === 6 && cam.every(Number.isFinite)) e.camara = cam;
  const aislar = p.get('aislar');
  if (aislar === 'solo' || aislar === 'contexto') e.aislar = aislar;
  const ex = Number(p.get('explosion'));
  if (Number.isFinite(ex) && ex > 0) e.explosion = Math.min(100, Math.max(0, ex));
  const nivel = p.get('nivel');
  if (nivel && (NIVELES as string[]).includes(nivel)) e.nivel = nivel as Nivel;
  if (p.get('ambos') === '1') e.ambos = true;
  return e;
}
