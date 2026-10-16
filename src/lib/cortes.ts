// Planos de corte (F8): funciones puras, sin three, React ni store.
// Las cajas vienen en metros (las del Visor); el rango y la posición de cada corte se expresan en mm enteros
// desde el centro del encéfalo. Solo las piezas y los marcadores del encéfalo se cortan: nunca el vago, sus marcadores ni los órganos.
import type { TFunction } from 'i18next';
import { nodos, piezasBajo } from '../data/atlas';
import type { Vec3 } from './explosion';
import type { Caja } from './inventario';

export const PLANOS = ['sagital', 'coronal', 'axial'] as const;
export type Plano = (typeof PLANOS)[number];

export interface Corte {
  activo: boolean;
  /** Posición en mm enteros desde el centro del encéfalo. */
  mm: number;
  /** Por defecto se esconde el lado positivo del eje; invertido esconde el negativo. */
  invertido: boolean;
}
export type Cortes = Record<Plano, Corte>;

export interface Rango {
  /** Centro del encéfalo, en metros. */
  centro: Vec3;
  min: Record<Plano, number>;
  max: Record<Plano, number>;
}

/** Eje del mundo (glTF, Y arriba) que corta cada plano: sagital X, axial Y, coronal Z. */
export const EJE: Record<Plano, 0 | 1 | 2> = { sagital: 0, coronal: 2, axial: 1 };
export const GRUPO_ENCEFALO = 'g-brain';
export const UMBRAL_FPS = 30;
export const MUESTRAS_BAJAS = 10;
/** 10 muestras cada 0,5 s = 5 s seguidos bajo el umbral. */
export const INTERVALO_MUESTRA_MS = 500;

export const piezasEncefalo: string[] = piezasBajo(GRUPO_ENCEFALO);
const conjuntoEncefalo = new Set(piezasEncefalo);

export const esEncefalo = (pieza: string): boolean => conjuntoEncefalo.has(pieza);

/** True si el nodo es `g-brain` o cuelga de él en el árbol (un marcador toma el padre que declara). Tope de pasos contra ciclos. */
export function enEncefalo(nodo: string | null): boolean {
  let actual = nodo;
  for (let paso = 0; actual && paso < 64; paso++) {
    if (actual === GRUPO_ENCEFALO) return true;
    actual = nodos[actual]?.padre ?? null;
  }
  return false;
}

export const cortesApagados = (): Cortes => ({
  sagital: { activo: false, mm: 0, invertido: false },
  coronal: { activo: false, mm: 0, invertido: false },
  axial: { activo: false, mm: 0, invertido: false },
});

export const hayCortes = (c: Cortes): boolean => PLANOS.some((p) => c[p].activo);

/** Une las cajas (metros) de las piezas dadas. El borde en mm es el piso de la mitad del ancho, así el plano nunca sale de la caja. */
export function rangoCerebro(cajas: Record<string, Caja | undefined>, piezas: readonly string[]): Rango {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let hay = false;
  for (const pieza of piezas) {
    const caja = cajas[pieza];
    if (!caja) continue;
    hay = true;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, caja[0][i]!);
      max[i] = Math.max(max[i]!, caja[1][i]!);
    }
  }
  if (!hay) {
    const cero = { sagital: 0, coronal: 0, axial: 0 };
    return { centro: [0, 0, 0], min: { ...cero }, max: { ...cero } };
  }
  const centro: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const borde = (plano: Plano) => {
    const e = EJE[plano];
    return Math.floor(((max[e]! - min[e]!) / 2) * 1000 + 1e-6);
  };
  const b = { sagital: borde('sagital'), coronal: borde('coronal'), axial: borde('axial') };
  return {
    centro,
    min: { sagital: -b.sagital, coronal: -b.coronal, axial: -b.axial },
    max: { ...b },
  };
}

/** Redondea a 1 mm y ajusta al borde del rango. Nunca devuelve -0. */
export function ajustarAlRango(plano: Plano, mm: number, rango: Rango): number {
  const r = Math.min(rango.max[plano], Math.max(rango.min[plano], Math.round(mm)));
  return r === 0 ? 0 : r;
}

/** Plano en la convención de recorte de three: se ve el punto p cuando normal·p + constante >= 0. */
export function planoDe(plano: Plano, corte: Corte, rango: Rango): { normal: Vec3; constante: number } {
  const e = EJE[plano];
  const coord = rango.centro[e] + corte.mm / 1000;
  const normal: Vec3 = [0, 0, 0];
  normal[e] = corte.invertido ? 1 : -1;
  return { normal, constante: corte.invertido ? -coord : coord };
}

/** True si el punto (metros) queda del lado oculto de algún plano activo. */
export function ocultoPorCortes(p: Vec3, cortes: Cortes, rango: Rango): boolean {
  for (const plano of PLANOS) {
    const corte = cortes[plano];
    if (!corte.activo) continue;
    const { normal, constante } = planoDe(plano, corte, rango);
    if (normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2] + constante < 0) return true;
  }
  return false;
}

/** Texto del corte con dirección anatómica. Cada clave va literal para que `clavesFaltantes` la vea. */
export function etiquetaCorte(plano: Plano, mm: number, t: TFunction): string {
  const n = Math.abs(Math.round(mm));
  if (n === 0) return t('cortes.etiqueta.centro');
  const positivo = mm > 0;
  if (plano === 'sagital') {
    return positivo ? t('cortes.etiqueta.izquierda', { mm: n }) : t('cortes.etiqueta.derecha', { mm: n });
  }
  if (plano === 'coronal') {
    return positivo ? t('cortes.etiqueta.anterior', { mm: n }) : t('cortes.etiqueta.posterior', { mm: n });
  }
  return positivo ? t('cortes.etiqueta.superior', { mm: n }) : t('cortes.etiqueta.inferior', { mm: n });
}

/** Piezas del encéfalo que algún plano activo atraviesa (estricto: un plano en la cara no cruza). */
export function piezasCruzadas(
  cajas: Record<string, Caja | undefined>,
  piezas: readonly string[],
  cortes: Cortes,
  rango: Rango,
): string[] {
  const activos = PLANOS.filter((p) => cortes[p].activo).map((p) => ({
    e: EJE[p],
    coord: rango.centro[EJE[p]] + cortes[p].mm / 1000,
  }));
  if (!activos.length) return [];
  return piezas.filter((pieza) => {
    if (!esEncefalo(pieza)) return false;
    const caja = cajas[pieza];
    if (!caja) return false;
    return activos.some(({ e, coord }) => caja[0][e]! < coord && coord < caja[1][e]!);
  });
}

export interface EstadoCuadros {
  bajas: number;
  apagado: boolean;
}

/** Vigilante de cuadros: true una sola vez, en la muestra número MUESTRAS_BAJAS seguida bajo UMBRAL_FPS con cortes. Muta `estado`. */
export function vigilarCuadros(estado: EstadoCuadros, fps: number, hayCortesActivos: boolean): boolean {
  if (estado.apagado) return false;
  if (!hayCortesActivos) {
    estado.bajas = 0;
    return false;
  }
  if (!Number.isFinite(fps)) return false;
  if (fps < UMBRAL_FPS) estado.bajas += 1;
  else estado.bajas = 0;
  if (estado.bajas >= MUESTRAS_BAJAS) {
    estado.apagado = true;
    return true;
  }
  return false;
}
