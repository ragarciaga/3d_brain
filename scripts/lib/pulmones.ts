// Pulmones como obstáculo de las rutas del vago (SPEC F25, ADR 0010). Los cinco lóbulos no están en
// pipeline/anclajes-vago.json: se miden sobre la malla de public/modelos/atlas.glb, que es lo que ve el
// estudiante.
// - `profundidadMalla`: profundidad 3D de un punto en una malla de triángulos (la usa la prueba, que mide
//   sobre el GLB completo).
// - `seccionar`: la sección horizontal de la malla a una altura, como segmentos (x0, z0, x1, z1). De ahí
//   sale pipeline/salida/pulmones-vago.json, que lee el generador (scripts/exportar-pulmones.ts).
import type { P } from './asimetrias.ts';

/** Los cinco lóbulos pulmonares, con el nombre del nodo en el GLB. */
export const LOBULOS = [
  'Superior lobe of left lung',
  'Inferior lobe of left lung',
  'Superior lobe of right lung',
  'Middle lobe of right lung',
  'Inferior lobe of right lung',
] as const;

/** Segmento de una sección horizontal: x0, z0, x1, z1. */
export type Segmento = [number, number, number, number];

/** Lo que escribe scripts/exportar-pulmones.ts y lee pipeline/generar-ramas-vago.py. */
export interface PulmonesExportados {
  fuente: string;
  paso: number;
  lobulos: Record<string, { y: number; segmentos: Segmento[] }[]>;
}

/** Más lejos que esto de la caja de la malla, `profundidadMalla` devuelve una cota en vez de medir. */
export const ALCANCE = 0.03;

interface Indice {
  min: P;
  max: P;
  /** Caja de cada triángulo: mínimos (3 por triángulo) y máximos (3 por triángulo). */
  tmin: Float64Array;
  tmax: Float64Array;
}

const indices = new WeakMap<Float64Array, Indice>();

function indice(tris: Float64Array): Indice {
  const hecho = indices.get(tris);
  if (hecho) return hecho;
  const n = tris.length / 9;
  const tmin = new Float64Array(n * 3);
  const tmax = new Float64Array(n * 3);
  const min: P = [Infinity, Infinity, Infinity];
  const max: P = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const a = tris[t * 9 + k]!;
      const b = tris[t * 9 + 3 + k]!;
      const c = tris[t * 9 + 6 + k]!;
      const lo = Math.min(a, b, c);
      const hi = Math.max(a, b, c);
      tmin[t * 3 + k] = lo;
      tmax[t * 3 + k] = hi;
      if (lo < min[k]!) min[k] = lo;
      if (hi > max[k]!) max[k] = hi;
    }
  }
  const res = { min, max, tmin, tmax };
  indices.set(tris, res);
  return res;
}

/** Distancia al cuadrado de p al triángulo (a, b, c): el punto más cercano de Ericson, "Real-Time Collision Detection". */
function distancia2(p: P, a: P, b: P, c: P): number {
  const ab: P = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: P = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const ap: P = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dot = (u: P, v: P) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  const en = (q: P) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  if (d1 <= 0 && d2 <= 0) return en(a);
  const bp: P = [p[0] - b[0], p[1] - b[1], p[2] - b[2]];
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return en(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return en([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]);
  }
  const cp: P = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return en(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return en([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return en([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]);
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den;
  const w = vc * den;
  return en([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

/** Corrimiento del origen del rayo (0,2 µm): evita que un rayo caiga justo sobre la arista de dos triángulos. */
const DESVIO: [number, number] = [1.7e-7, 2.9e-7];

/** Cuántos triángulos cruza el rayo que sale de p en el sentido positivo del eje `eje`. */
function cruces(tris: Float64Array, ix: Indice, p: P, eje: 0 | 1 | 2): number {
  const u = (eje + 1) % 3;
  const w = (eje + 2) % 3;
  const pu = p[u]! + DESVIO[0];
  const pw = p[w]! + DESVIO[1];
  const n = tris.length / 9;
  let cuenta = 0;
  for (let t = 0; t < n; t++) {
    if (pu < ix.tmin[t * 3 + u]! || pu > ix.tmax[t * 3 + u]! || pw < ix.tmin[t * 3 + w]! || pw > ix.tmax[t * 3 + w]!) continue;
    if (ix.tmax[t * 3 + eje]! <= p[eje]!) continue;
    const o = t * 9;
    const au = tris[o + u]!;
    const aw = tris[o + w]!;
    const bu = tris[o + 3 + u]!;
    const bw = tris[o + 3 + w]!;
    const cu = tris[o + 6 + u]!;
    const cw = tris[o + 6 + w]!;
    const e0 = (bu - au) * (pw - aw) - (bw - aw) * (pu - au);
    const e1 = (cu - bu) * (pw - bw) - (cw - bw) * (pu - bu);
    const e2 = (au - cu) * (pw - cw) - (aw - cw) * (pu - cu);
    if (!((e0 > 0 && e1 > 0 && e2 > 0) || (e0 < 0 && e1 < 0 && e2 < 0))) continue;
    const area = e0 + e1 + e2;
    const x = (e1 * tris[o + eje]! + e2 * tris[o + 3 + eje]! + e0 * tris[o + 6 + eje]!) / area;
    if (x > p[eje]!) cuenta++;
  }
  return cuenta;
}

/**
 * Profundidad de p en la malla, en metros: positiva dentro, negativa fuera, con la distancia al triángulo más
 * cercano. Dentro es lo que dicen al menos 2 de 3 rayos (+x, +y, +z) por paridad: la malla de un lóbulo puede
 * tener algún hueco y un solo rayo se equivoca. A más de ALCANCE de la caja de la malla no se mide: devuelve
 * menos la distancia a la caja, una cota inferior de la distancia real.
 */
export function profundidadMalla(tris: Float64Array, p: P): number {
  const ix = indice(tris);
  let caja2 = 0;
  for (let k = 0; k < 3; k++) {
    const d = Math.max(ix.min[k]! - p[k]!, 0, p[k]! - ix.max[k]!);
    caja2 += d * d;
  }
  if (caja2 > ALCANCE * ALCANCE) return -Math.sqrt(caja2);
  let votos = 0;
  for (const eje of [0, 1, 2] as const) if (cruces(tris, ix, p, eje) % 2 === 1) votos++;
  let mejor = Infinity;
  const n = tris.length / 9;
  for (let t = 0; t < n; t++) {
    let caja = 0;
    for (let k = 0; k < 3; k++) {
      const d = Math.max(ix.tmin[t * 3 + k]! - p[k]!, 0, p[k]! - ix.tmax[t * 3 + k]!);
      caja += d * d;
    }
    if (caja >= mejor) continue;
    const o = t * 9;
    const d2 = distancia2(p, [tris[o]!, tris[o + 1]!, tris[o + 2]!], [tris[o + 3]!, tris[o + 4]!, tris[o + 5]!], [tris[o + 6]!, tris[o + 7]!, tris[o + 8]!]);
    if (d2 < mejor) mejor = d2;
  }
  const d = Math.sqrt(mejor);
  return votos >= 2 ? d : -d;
}

/**
 * Sección de la malla con el plano horizontal y = `y`: un segmento (x0, z0, x1, z1) por triángulo que lo
 * cruza. Un vértice a la altura exacta cuenta como "arriba", así dos triángulos vecinos no dejan hueco ni
 * repiten el cruce.
 */
export function seccionar(tris: Float64Array, y: number): Segmento[] {
  const res: Segmento[] = [];
  const n = tris.length / 9;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const arriba = [tris[o + 1]! >= y, tris[o + 4]! >= y, tris[o + 7]! >= y];
    const k = arriba.filter(Boolean).length;
    if (k === 0 || k === 3) continue;
    const cortes: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (arriba[i] === arriba[j]) continue;
      const a = o + i * 3;
      const b = o + j * 3;
      const s = (y - tris[a + 1]!) / (tris[b + 1]! - tris[a + 1]!);
      cortes.push([tris[a]! + (tris[b]! - tris[a]!) * s, tris[a + 2]! + (tris[b + 2]! - tris[a + 2]!) * s]);
    }
    res.push([cortes[0]![0], cortes[0]![1], cortes[1]![0], cortes[1]![1]]);
  }
  return res;
}
