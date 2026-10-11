// Fragmentar (F6): el desplazamiento de cada pieza se calcula aparte de su posición original.
// Posición en pantalla = posición original + desplazamiento. Reensamblar = desplazamiento cero.
export type Vec3 = [number, number, number];
export type Nivel = 'hemisferios' | 'lobulos' | 'piezas';

export type Lado = 'l' | 'r' | 'medio';

// Explosión (F6). Magnitud de cada bloque al factor 1: DISTANCIA_BASE + FACTOR_RADIAL * min(r, RADIO_MAXIMO),
// con r la distancia del bloque al origen de la explosión. Todo en metros.
/** Un tercio del ancho del encéfalo: saca del núcleo a las piezas profundas, cuyo r es casi cero. */
export const DISTANCIA_BASE = 0.05;
/** Con ×3 la separación entre dos bloques al 100 % es al menos ×4 la armada (antes, ×2,6). */
export const FACTOR_RADIAL = 3;
/** Tope del término radial. Los centros del encéfalo están a 0,093 o menos del origen (medido); una prueba exige que ninguno pase de este tope, así que solo frena al vago. */
export const RADIO_MAXIMO = 0.12;
/** Adónde llega una pieza separada: la superficie armada del encéfalo está a 0,069 a 0,094 del origen. */
export const RADIO_SALIDA = 0.12;
/** El modelo es simétrico respecto a x = 0 (cajas.json espeja cada par .l/.r; las .l están en +X). */
export const PLANO_MEDIO_X = 0;
export const DISTANCIA_SEPARAR = 0.06; // metros, mínimo que se mueve una pieza al "Separar" desde la ficha

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

/** Origen de la explosión: el centro del conjunto, pero con X en el plano medio del modelo. */
export function origenExplosion(conjunto: Vec3): Vec3 {
  return [PLANO_MEDIO_X, conjunto[1], conjunto[2]];
}

/**
 * Vector del origen al centro. En X se mide desde el plano medio con el signo del lado (l en +X, r en -X),
 * así una pieza nunca cambia de lado aunque su centro esté un poco pasado del plano.
 */
export function relativoAlOrigen(centro: Vec3, origen: Vec3, lado: Lado): Vec3 {
  const dx = centro[0] - origen[0];
  const x = lado === 'l' ? Math.abs(dx) : lado === 'r' ? 0 - Math.abs(dx) : dx;
  return [x, centro[1] - origen[1], centro[2] - origen[2]];
}

/** Distancia (al factor 1) que se aleja un bloque que está a r metros del origen. */
export function magnitudExplosion(r: number): number {
  return DISTANCIA_BASE + FACTOR_RADIAL * Math.min(r, RADIO_MAXIMO);
}

/**
 * Desplazamiento de explosión para cada pieza visible.
 * @param centros centro original de cada pieza (no se modifica)
 * @param visibles piezas que se dibujan; con menos de dos bloques no hay explosión
 * @param bloque  pieza -> clave del bloque que se mueve junto (lóbulo, hemisferio o la pieza misma)
 * @param factor  0 a 1 (deslizador)
 * @param lado    pieza -> lado anatómico; se usa el de la primera pieza de cada bloque
 */
export function desplazamientosExplosion(
  centros: Record<string, Vec3>,
  visibles: string[],
  bloque: (pieza: string) => string,
  factor: number,
  lado: (pieza: string) => Lado = () => 'medio',
): Record<string, Vec3> {
  const res: Record<string, Vec3> = {};
  if (factor <= 0 || !visibles.length) return res;
  const conCentro = visibles.filter((p) => centros[p]);
  const porBloque = new Map<string, { centros: Vec3[]; lado: Lado }>();
  for (const p of conCentro) {
    const k = bloque(p);
    const b = porBloque.get(k) ?? { centros: [], lado: lado(p) };
    b.centros.push(centros[p]!);
    porBloque.set(k, b);
  }
  if (porBloque.size < 2) return res;
  const origen = origenExplosion(promedio(conCentro.map((p) => centros[p]!)));
  const desplazamiento = new Map<string, Vec3>();
  for (const [k, b] of porBloque) {
    const rel = relativoAlOrigen(promedio(b.centros), origen, b.lado);
    const r = Math.hypot(rel[0], rel[1], rel[2]);
    desplazamiento.set(k, escalar(normalizar(rel), factor * magnitudExplosion(r)));
  }
  for (const p of conCentro) res[p] = desplazamiento.get(bloque(p))!;
  return res;
}

/**
 * Desplazamiento para separar una pieza: sale en su dirección de explosión hasta quedar fuera del
 * conjunto armado (a RADIO_SALIDA del origen), y nunca se mueve menos de DISTANCIA_SEPARAR.
 */
export function desplazamientoSeparar(centro: Vec3, conjunto: Vec3, lado: Lado = 'medio'): Vec3 {
  const rel = relativoAlOrigen(centro, origenExplosion(conjunto), lado);
  const r = Math.hypot(rel[0], rel[1], rel[2]);
  return escalar(normalizar(rel), Math.max(DISTANCIA_SEPARAR, RADIO_SALIDA - r));
}

/** Interpolación hacia el objetivo; cuando llega cerca, devuelve exactamente el objetivo. */
export function acercar(actual: Vec3, objetivo: Vec3, t: number): Vec3 {
  const d = restar(objetivo, actual);
  if (Math.hypot(d[0], d[1], d[2]) < 1e-5) return objetivo;
  return sumar(actual, escalar(d, Math.min(1, t)));
}
