// Fragmentar (F6): el desplazamiento de cada pieza se calcula aparte de su posición original.
// Posición en pantalla = posición original + desplazamiento. Reensamblar = desplazamiento cero.
export type Vec3 = [number, number, number];
export type Nivel = 'hemisferios' | 'lobulos' | 'piezas';

export const FACTOR_DISTANCIA = 1.6;
export const DISTANCIA_SEPARAR = 0.06; // metros, para "Separar" una pieza desde la ficha

export const sumar = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const restar = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const escalar = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const CERO: Vec3 = [0, 0, 0];

export function promedio(puntos: Vec3[]): Vec3 {
  if (!puntos.length) return CERO;
  const s = puntos.reduce((acc, p) => sumar(acc, p), CERO);
  return escalar(s, 1 / puntos.length);
}

export function normalizar(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-9 ? [0, 1, 0] : escalar(v, 1 / l);
}

/**
 * Desplazamiento de explosión para cada pieza visible.
 * @param centros centro original de cada pieza (no se modifica)
 * @param bloque  pieza -> clave del bloque que se mueve junto (lóbulo, hemisferio o la pieza misma)
 * @param factor  0 a 1 (deslizador)
 */
export function desplazamientosExplosion(
  centros: Record<string, Vec3>,
  visibles: string[],
  bloque: (pieza: string) => string,
  factor: number,
): Record<string, Vec3> {
  const res: Record<string, Vec3> = {};
  if (factor <= 0 || !visibles.length) return res;
  const conjunto = promedio(visibles.map((p) => centros[p]!).filter(Boolean));
  const porBloque = new Map<string, Vec3[]>();
  for (const p of visibles) {
    const c = centros[p];
    if (!c) continue;
    const k = bloque(p);
    const l = porBloque.get(k) ?? [];
    l.push(c);
    porBloque.set(k, l);
  }
  const centroBloque = new Map<string, Vec3>();
  for (const [k, l] of porBloque) centroBloque.set(k, promedio(l));
  for (const p of visibles) {
    const cb = centroBloque.get(bloque(p));
    if (cb) res[p] = escalar(restar(cb, conjunto), FACTOR_DISTANCIA * factor);
  }
  return res;
}

/** Desplazamiento para separar una pieza: se aleja del centro del conjunto una distancia fija. */
export function desplazamientoSeparar(centro: Vec3, conjunto: Vec3): Vec3 {
  return escalar(normalizar(restar(centro, conjunto)), DISTANCIA_SEPARAR);
}

/** Interpolación hacia el objetivo; cuando llega cerca, devuelve exactamente el objetivo. */
export function acercar(actual: Vec3, objetivo: Vec3, t: number): Vec3 {
  const d = restar(objetivo, actual);
  if (Math.hypot(d[0], d[1], d[2]) < 1e-5) return objetivo;
  return sumar(actual, escalar(d, Math.min(1, t)));
}
