// Enlaces compartibles (F11): el estado de la vista viaja en la URL.
// Ejemplo: /es/insula?vista=lateral-izq&aislar=contexto&explosion=40&nivel=lobulos&corte=coronal:12,axial:-8:inv
import { PLANOS, piezasEncefalo, rangoCerebro } from './cortes';
import type { Cortes, Plano, Rango } from './cortes';
import type { Nivel } from './explosion';
import { useAtlas } from '../store/useAtlas';

export const VISTAS = ['anterior', 'posterior', 'lateral-izq', 'lateral-der', 'superior', 'inferior'] as const;
export type Vista = (typeof VISTAS)[number];

/** Un plano de corte en el enlace: mm enteros con signo desde el centro de la caja del cerebro. */
export interface EntradaCorte {
  plano: Plano;
  mm: number;
  invertido: boolean;
}

export interface EstadoEnlace {
  vista?: Vista;
  camara?: number[]; // posición (3) y objetivo (3), redondeados a 0,1 mm
  aislar?: 'solo' | 'contexto';
  explosion?: number; // 0 a 100
  nivel?: Nivel;
  corte?: EntradaCorte[]; // `corte=plano:mm[:inv],...`
}

const NIVELES: Nivel[] = ['hemisferios', 'lobulos', 'piezas'];
/** Una entrada de `corte=`: plano, mm enteros con signo (hasta 4 dígitos) y `:inv` opcional. */
export const RE_CORTE = /^(sagital|coronal|axial):(-?\d{1,4})(:inv)?$/;

export function serializar(e: EstadoEnlace): string {
  const p = new URLSearchParams();
  if (e.vista) p.set('vista', e.vista);
  if (e.camara && e.camara.length === 6) p.set('cam', e.camara.map((n) => n.toFixed(4)).join(','));
  if (e.aislar) p.set('aislar', e.aislar);
  if (e.explosion && e.explosion > 0) p.set('explosion', String(Math.round(e.explosion)));
  if (e.nivel && e.nivel !== 'piezas') p.set('nivel', e.nivel);
  let s = p.toString();
  if (e.corte?.length) {
    // Literal, sin pasar por URLSearchParams: `:` y `,` se quedan sin codificar para que el enlace se lea.
    const valor = [...e.corte]
      .sort((a, b) => PLANOS.indexOf(a.plano) - PLANOS.indexOf(b.plano))
      .map((c) => `${c.plano}:${Math.round(c.mm)}${c.invertido ? ':inv' : ''}`)
      .join(',');
    s += `${s ? '&' : ''}corte=${valor}`;
  }
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
  const corte: EntradaCorte[] = [];
  for (const trozo of p.get('corte')?.split(',') ?? []) {
    const m = RE_CORTE.exec(trozo);
    if (!m) continue; // la mal escrita se ignora sin afectar a las demás
    const plano = m[1] as Plano;
    if (corte.some((c) => c.plano === plano)) continue; // repetida: gana la primera bien formada
    corte.push({ plano, mm: Number(m[2]) || 0, invertido: !!m[3] });
  }
  if (corte.length) e.corte = corte;
  return e;
}

/** Entradas del enlace a partir del estado del store: solo los planos activos, en el orden de `PLANOS`. */
export function entradasDeCortes(cortes: Cortes): EntradaCorte[] {
  return PLANOS.filter((plano) => cortes[plano].activo).map((plano) => ({
    plano,
    mm: cortes[plano].mm,
    invertido: cortes[plano].invertido,
  }));
}

/** Descarta las entradas fuera del rango del cerebro, sin ajustarlas al borde. Los bordes son inclusivos. */
export function validarCortes(entradas: readonly EntradaCorte[], rango: Rango): EntradaCorte[] {
  return entradas.filter(
    ({ plano, mm }) => Number.isInteger(mm) && rango.min[plano] <= mm && mm <= rango.max[plano],
  );
}

/**
 * Aplica las entradas de `corte=` al store, una vez cargado el modelo. Sin modelo (sin cajas el rango es 0)
 * no hace nada. El primer `setCorte` que activa un plano ya arma el cerebro (explosión 0, sin separadas).
 * Devuelve las entradas aplicadas.
 */
export function aplicarCortesEnlace(entradas: readonly EntradaCorte[]): EntradaCorte[] {
  const s = useAtlas.getState();
  if (!s.cargado) return [];
  const validas = validarCortes(entradas, rangoCerebro(s.cajas, piezasEncefalo));
  for (const { plano, mm, invertido } of validas) {
    useAtlas.getState().setCorte(plano, { activo: true, mm, invertido });
  }
  return validas;
}
