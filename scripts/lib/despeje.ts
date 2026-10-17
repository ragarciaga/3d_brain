// Despeje de las rutas trazadas del vago: ningún punto de una ruta publicada puede quedar dentro de un
// órgano (SPEC F25, ADR 0010). Es una implementación propia en TypeScript del modelo de obstáculos que
// usa pipeline/generar-ramas-vago.py, a propósito: si las dos se equivocan igual, la prueba no sirve.
//
// Modelo (todo sale de pipeline/anclajes-vago.json, coordenadas glTF en metros, Y arriba, +X izquierda):
// - Cajas por franja: Trachea, Oesophagus, Cricoid cartilage y Thyroid cartilage. En cada franja de
//   altura, la caja x/z de sus vértices. Las franjas de menos de 1 mm de alto se ignoran (láminas
//   sueltas, como el último corte de la tráquea). Entre dos franjas no hay órgano.
// - Pared común: si en una misma altura la cara posterior de la tráquea queda detrás de la anterior del
//   esófago (los dos se tocan), las dos caras se mueven a su punto medio. Así un punto sobre la pared
//   no cuenta como dentro de uno y de otro a la vez.
// - Tubos: las nueve arterias y bronquios, con su línea central y su radio.
// La profundidad es positiva dentro del obstáculo, en metros.
import { signoAnterior, type Ancla, type Anclajes, type P, type Rutas } from './asimetrias.ts';

export interface Corte {
  y: number;
  caja: [P, P];
}

export interface AnclaConCortes extends Ancla {
  cortes: Corte[];
}

export interface DatosDespeje extends Anclajes {
  anclas: Record<string, AnclaConCortes>;
}

/** Franjas de menos de 1 mm de alto: láminas, no sección del órgano. */
export const CORTE_MINIMO = 0.001;
/** El radio del nervio: hasta 0,5 mm dentro se tolera. */
export const TOLERANCIA = 0.0005;
/** Decisión del editor, 2026-10-17: contra la tráquea y el esófago se tolera hasta 1 mm (dos radios del nervio), porque el recurrente va en el surco traqueoesofágico, en contacto con sus paredes. Debe coincidir con pipeline/generar-ramas-vago.py. */
export const TOLERANCIA_SURCO = 0.001;
const TOLERANCIA_POR_ANCLAJE: Record<string, number> = { Trachea: TOLERANCIA_SURCO, Oesophagus: TOLERANCIA_SURCO };
/** Hasta cuánto puede entrar un punto de una ruta en ese órgano, en metros. */
export const toleranciaDe = (nombre: string): number => TOLERANCIA_POR_ANCLAJE[nombre] ?? TOLERANCIA;
export const OBSTACULOS_CAJA = ['Trachea', 'Oesophagus', 'Cricoid cartilage', 'Thyroid cartilage'] as const;
export const OBSTACULOS_TUBO = [
  'Aortic arch',
  'Thoracic aorta',
  'Brachiocephalic trunk',
  'Left common carotid artery',
  'Right common carotid artery',
  'Left subclavian artery',
  'Right subclavian artery',
  'Left main bronchus',
  'Right main bronchus',
] as const;

export const obstaculos = (): string[] => [...OBSTACULOS_CAJA, ...OBSTACULOS_TUBO];

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function ancla(d: DatosDespeje, nombre: string): AnclaConCortes {
  const a = d.anclas[nombre];
  if (!a) throw new Error(`Falta el anclaje "${nombre}": corre pipeline/auditar-vago.py`);
  return a;
}

/** La franja no degenerada que contiene la altura y, o null. */
function franja(a: AnclaConCortes, y: number): Corte | null {
  for (const c of a.cortes) {
    if (c.caja[1][1] - c.caja[0][1] >= CORTE_MINIMO && c.caja[0][1] <= y && y <= c.caja[1][1]) return c;
  }
  return null;
}

/** Distancia de un punto a una polilínea, con los segmentos acotados en sus extremos. */
export function distanciaAPolilinea(p: P, pts: P[]): number {
  if (pts.length === 1) return dist(p, pts[0]!);
  let mejor = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const ab: P = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const largo2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / largo2));
    mejor = Math.min(mejor, dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
  }
  return mejor;
}

/** Separación mínima entre dos rutas: la menor distancia de un punto de una a la polilínea de la otra, en los dos sentidos. */
export function separacion(a: P[], b: P[]): number {
  return Math.min(...a.map((p) => distanciaAPolilinea(p, b)), ...b.map((p) => distanciaAPolilinea(p, a)));
}

/** Caja x/z de la franja, con la pared común tráquea-esófago partida por la mitad. */
function cajaEfectiva(d: DatosDespeje, nombre: string, y: number, ant: 1 | -1): { x0: number; x1: number; z0: number; z1: number } | null {
  const c = franja(ancla(d, nombre), y);
  if (!c) return null;
  const r = { x0: c.caja[0][0], x1: c.caja[1][0], z0: c.caja[0][2], z1: c.caja[1][2] };
  if (nombre === 'Trachea' || nombre === 'Oesophagus') {
    const t = franja(ancla(d, 'Trachea'), y);
    const e = franja(ancla(d, 'Oesophagus'), y);
    if (t && e) {
      const traseraT = ant > 0 ? t.caja[0][2] : t.caja[1][2];
      const delanteE = ant > 0 ? e.caja[1][2] : e.caja[0][2];
      if ((delanteE - traseraT) * ant > 0) {
        const medio = (traseraT + delanteE) / 2;
        if (nombre === 'Trachea') {
          if (ant > 0) r.z0 = medio;
          else r.z1 = medio;
        } else if (ant > 0) r.z1 = medio;
        else r.z0 = medio;
      }
    }
  }
  return r;
}

/**
 * Cuánto está p dentro del obstáculo, en metros: positivo dentro, negativo fuera (−Infinity si no hay
 * órgano a esa altura). Cajas: distancia a la cara más cercana; tubos: radio menos la distancia al eje.
 */
export function profundidad(d: DatosDespeje, nombre: string, p: P, ant: 1 | -1 = signoAnterior(d)): number {
  if ((OBSTACULOS_TUBO as readonly string[]).includes(nombre)) {
    const a = ancla(d, nombre);
    if (!a.puntos?.length || a.radio === undefined) throw new Error(`El anclaje "${nombre}" no trae línea central y radio`);
    return a.radio - distanciaAPolilinea(p, a.puntos);
  }
  const c = cajaEfectiva(d, nombre, p[1], ant);
  if (!c) return -Infinity;
  return Math.min(p[0] - c.x0, c.x1 - p[0], p[2] - c.z0, c.z1 - p[2]);
}

/** El obstáculo en el que p está más adentro, con su profundidad. */
export function peor(d: DatosDespeje, p: P): { ancla: string; profundidad: number } {
  const ant = signoAnterior(d);
  let mejor = { ancla: '', profundidad: -Infinity };
  for (const n of obstaculos()) {
    const prof = profundidad(d, n, p, ant);
    if (prof > mejor.profundidad) mejor = { ancla: n, profundidad: prof };
  }
  return mejor;
}

export interface Penetracion {
  ruta: string;
  ancla: string;
  profundidad: number;
  y: number;
  punto: P;
}

/** Para cada ruta y obstáculo, el punto más adentro (solo los que pasan de la tolerancia de ese obstáculo, si `soloFallas`). */
export function penetraciones(d: DatosDespeje, r: Rutas, soloFallas = true): Penetracion[] {
  const ant = signoAnterior(d);
  const res: Penetracion[] = [];
  for (const [id, ruta] of Object.entries(r.rutas)) {
    for (const n of obstaculos()) {
      let mejor: Penetracion | null = null;
      for (const p of ruta.puntos) {
        const prof = profundidad(d, n, p, ant);
        if (!mejor || prof > mejor.profundidad) mejor = { ruta: id, ancla: n, profundidad: prof, y: p[1], punto: p };
      }
      if (mejor && Number.isFinite(mejor.profundidad) && (!soloFallas || mejor.profundidad > toleranciaDe(n))) res.push(mejor);
    }
  }
  return res;
}

/** Texto de una penetración: ruta, anclaje, profundidad y altura, en mm. */
export function describir(p: Penetracion): string {
  return `${p.ruta} pasa ${(p.profundidad * 1000).toFixed(2)} mm dentro de ${p.ancla} en y = ${(p.y * 1000).toFixed(1)} mm`;
}
