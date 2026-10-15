// Recortes del visor. Dos usos de los planos de three, sin tocar jamás la geometría ni la posición de una pieza:
// el revelado progresivo del recorrido del vago (F14), con su plano propio, y los planos de corte del encéfalo (F8),
// con el fantasma opcional del lado oculto, el relleno de la cara del corte con las caras traseras de las mallas
// cerradas (ADR 0011) y el toque que descarta lo que quedó oculto (`raycastCorte`).
// Todo lo que se prueba vive aquí, sin montar el Canvas; `Visor.tsx` solo lo usa.
import * as THREE from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import cerradasJson from '../config/mallas-cerradas.json';
import { esFragmentable, esMallaDeToque, origenDe } from '../data/atlas';
import {
  EJE,
  esEncefalo,
  hayCortes,
  piezasCruzadas,
  piezasEncefalo,
  planoDe,
  PLANOS,
  rangoCerebro,
  type Cortes,
  type Rango,
} from '../lib/cortes';
import type { Caja } from '../lib/inventario';

/** Mallas del encéfalo cerradas (sin bordes abiertos): solo ellas se rellenan, porque su cara trasera tapa el hueco. */
export const MALLAS_CERRADAS: ReadonlySet<string> = new Set(cerradasJson as string[]);

/** Constante del plano que no recorta nada (el modelo está entre 1 y 2 m de altura). */
export const SIN_RECORTE = 100;

/** Normal hacia arriba: se ve lo que tiene y >= -constant. */
export const planoRecorrido = new THREE.Plane(new THREE.Vector3(0, 1, 0), SIN_RECORTE);

/** Plano del recorrido del vago (F14): el vago lo lleva siempre; los planos de corte nunca. */
export const PLANOS_RECORRIDO = [planoRecorrido];

/** Un `raycast` que nunca da impactos (piezas ocultas, órganos y fantasmas). */
export const raycastNulo = () => null;

/** Altura visible ahora (null si no recorta); para las pruebas E2E. */
export function alturaRecorte(): number | null {
  return planoRecorrido.constant >= SIN_RECORTE ? null : -planoRecorrido.constant;
}

const lejos = (plano: THREE.Plane) => plano.set(new THREE.Vector3(0, 1, 0), SIN_RECORTE);

/** Planos de corte compartidos (sagital, coronal, axial, en el orden de `PLANOS`). Se mutan en sitio en cada cuadro. */
export const PLANOS_CORTE: THREE.Plane[] = PLANOS.map(() => lejos(new THREE.Plane()));

/** Siempre la negación de `PLANOS_CORTE`: con `clipIntersection` el fantasma muestra solo el lado oculto. */
export const PLANOS_FANTASMA: THREE.Plane[] = PLANOS.map(() => lejos(new THREE.Plane()).negate());

export const OPACIDAD_FANTASMA_CORTE = 0.2;

let ultimasCajas: Record<string, Caja> | null = null;
let ultimoRango: Rango | null = null;

/** Rango del encéfalo, recalculado solo cuando cambia la referencia de `cajas` (se pide en cada cuadro). */
export function rangoActual(cajas: Record<string, Caja>): Rango {
  if (ultimasCajas !== cajas || !ultimoRango) {
    ultimoRango = rangoCerebro(cajas, piezasEncefalo);
    ultimasCajas = cajas;
  }
  return ultimoRango;
}

/** Copia los cortes activos en `PLANOS_CORTE` (los inactivos quedan lejos) y niega `PLANOS_FANTASMA`. Muta en sitio. */
export function actualizarPlanos(cortes: Cortes, rango: Rango): void {
  PLANOS.forEach((plano, i) => {
    const destino = PLANOS_CORTE[i]!;
    if (cortes[plano].activo) {
      const { normal, constante } = planoDe(plano, cortes[plano], rango);
      destino.normal.set(normal[0], normal[1], normal[2]);
      destino.constant = constante;
    } else {
      lejos(destino);
    }
    PLANOS_FANTASMA[i]!.copy(destino).negate();
  });
}

/**
 * La regla de recorte de three: con unión se ve el punto si ningún plano lo descarta; con `clipIntersection`
 * se descarta solo si todos lo descartan. Un plano descarta cuando la distancia del punto es negativa.
 */
export function seVeConRecorte(p: THREE.Vector3, planos: readonly THREE.Plane[] | null, interseccion = false): boolean {
  if (!planos || !planos.length) return true;
  return interseccion ? planos.some((pl) => pl.distanceToPoint(p) >= 0) : planos.every((pl) => pl.distanceToPoint(p) >= 0);
}

/** Planos de una pieza: los de corte solo para el encéfalo con cortes; el vago lleva el del recorrido; el resto, ninguno. */
export function planosDePieza(pieza: string, conCortes: boolean): THREE.Plane[] | null {
  if (conCortes && esEncefalo(pieza)) return PLANOS_CORTE;
  return esFragmentable(pieza) ? null : PLANOS_RECORRIDO;
}

/** `raycast` del encéfalo con cortes: descarta los impactos del lado oculto de cualquier plano activo. */
export function raycastCorte(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
  const primero = raycaster.firstHitOnly === true;
  const propios: THREE.Intersection[] = [];
  // Con firstHitOnly el primer impacto podría ser el oculto y se perdería el visible: se piden todos y se elige.
  raycaster.firstHitOnly = false;
  try {
    acceleratedRaycast.call(this, raycaster, propios);
  } finally {
    raycaster.firstHitOnly = primero;
  }
  const vistos = propios.filter((hit) => seVeConRecorte(hit.point, PLANOS_CORTE));
  if (primero && vistos.length > 1) {
    intersects.push(vistos.reduce((a, b) => (b.distance < a.distance ? b : a)));
    return;
  }
  intersects.push(...vistos);
}

export interface EstadoFantasma {
  cortes: Cortes;
  fantasmaCorte: boolean;
  ocultas: ReadonlySet<string>;
  aislar: { modo: 'solo' | 'contexto'; piezas: ReadonlySet<string> } | null;
  soloEscaneada: boolean;
  cajas: Record<string, Caja>;
}

/** Piezas del encéfalo visibles con parte del lado oculto de algún plano activo: cruzadas o enteras de ese lado (R5.2). */
export function piezasFantasmaCorte(s: EstadoFantasma): string[] {
  if (!s.fantasmaCorte || !hayCortes(s.cortes)) return [];
  const visibles = piezasEncefalo.filter(
    (p) => !s.ocultas.has(p) && (!s.aislar || s.aislar.piezas.has(p)) && !(origenDe(p) === 'aproximada' && s.soloEscaneada),
  );
  // Cruzada o entera del lado oculto: la esquina de la caja más hacia el lado oculto ya está oculta para algún plano.
  const conParteOculta = (c: Caja) =>
    PLANOS.some((pl) => {
      const { normal: n, constante } = planoDe(pl, s.cortes[pl], rangoActual(s.cajas));
      return s.cortes[pl].activo && (n[EJE[pl]]! > 0 ? c[0][EJE[pl]]! : c[1][EJE[pl]]!) * n[EJE[pl]]! + constante < 0;
    });
  return visibles.filter((p) => s.cajas[p] !== undefined && conParteOculta(s.cajas[p]!));
}

/** Copia translúcida de una malla: misma geometría (nunca se libera), solo el lado oculto, sin toque. */
export function crearMallaFantasma(geometria: THREE.BufferGeometry, matriz: THREE.Matrix4, color: THREE.ColorRepresentation, pieza: string): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: OPACIDAD_FANTASMA_CORTE,
    depthWrite: false,
    clippingPlanes: PLANOS_FANTASMA,
    clipIntersection: true,
    roughness: 0.65,
    metalness: 0,
  });
  const malla = new THREE.Mesh(geometria, material);
  malla.matrixAutoUpdate = false;
  malla.matrix.copy(matriz);
  // Sin padre que la actualice cada cuadro, la matriz del mundo se calcula una vez.
  malla.matrixWorldNeedsUpdate = true;
  malla.raycast = raycastNulo;
  malla.userData = { fantasmaCorte: true, pieza };
  return malla;
}

export type EstadoRelleno = Omit<EstadoFantasma, 'fantasmaCorte'>;

/**
 * Si la pieza lleva relleno del corte: es del encéfalo, hay cortes activos, se ve (ni oculta, ni fuera del aislamiento,
 * ni aproximada con solo escaneada) y algún plano activo cruza su caja (cruce estricto). Mismo filtro que el fantasma.
 */
export function piezaConRelleno(pieza: string, s: EstadoRelleno): boolean {
  if (!hayCortes(s.cortes) || !esEncefalo(pieza)) return false;
  if (s.ocultas.has(pieza)) return false;
  if (s.aislar && !s.aislar.piezas.has(pieza)) return false;
  if (origenDe(pieza) === 'aproximada' && s.soloEscaneada) return false;
  return piezasCruzadas(s.cajas, [pieza], s.cortes, rangoActual(s.cajas)).length > 0;
}

/** De las mallas de una pieza, las que se rellenan: cerradas y que no son el tubo del toque. Conserva el orden. */
export function mallasRellenables(nombres: readonly string[], cerradas: ReadonlySet<string> = MALLAS_CERRADAS): string[] {
  return nombres.filter((n) => !esMallaDeToque(n) && cerradas.has(n));
}

/** Mallas de `pieza` que llevan relleno ahora (vacío sin planos activos). `nombres` son las mallas de la pieza. */
export function mallasDeRelleno(
  pieza: string,
  nombres: readonly string[],
  s: EstadoRelleno,
  cerradas: ReadonlySet<string> = MALLAS_CERRADAS,
): string[] {
  return piezaConRelleno(pieza, s) ? mallasRellenables(nombres, cerradas) : [];
}

/**
 * Hermana de una malla cerrada que pinta su cara trasera con el color de la pieza: donde el plano abre el sólido se ve
 * el interior de la pared del fondo, que llena el hueco (ADR 0011). Comparte la geometría (nunca se libera) y se toca
 * como la pieza: lleva su `nombreMalla`.
 */
export function crearMallaRelleno(geometria: THREE.BufferGeometry, matriz: THREE.Matrix4, color: THREE.ColorRepresentation, nombreMalla: string): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, clippingPlanes: PLANOS_CORTE });
  const malla = new THREE.Mesh(geometria, material);
  malla.matrixAutoUpdate = false;
  malla.matrix.copy(matriz);
  // Sin padre que la actualice cada cuadro, la matriz del mundo se calcula una vez.
  malla.matrixWorldNeedsUpdate = true;
  malla.raycast = raycastCorte;
  malla.userData = { nombreMalla, relleno: true };
  return malla;
}

export interface CandidataCorte {
  pieza: string;
  malla: THREE.Mesh;
  /** True si los planos de corte la recortan (piezas del encéfalo). */
  cortada: boolean;
}

// Fina a propósito: la sección de una pieza delgada (un ventrículo) mide pocos píxeles y una grilla gruesa cae en su borde.
const CELDAS = 40;

/**
 * Un punto (NDC) sobre `objetivo` según `lado`. Elige la celda válida más lejos de una inválida o del borde. Null si ninguna celda sirve.
 * - `'corte'` (por defecto): el primer impacto visible es una cara trasera de `objetivo`: se ve por el hueco que deja
 *   el corte, sobre la cara del corte.
 * - `'oculto'`: el rayo cruza `objetivo` solo del lado oculto de los planos: ningún impacto de ninguna candidata es
 *   visible y al menos uno es de `objetivo`. Es un clic que no debe tocar nada.
 */
export function puntoDeCorte(
  objetivo: string,
  candidatas: readonly CandidataCorte[],
  camara: THREE.Camera,
  planos: readonly THREE.Plane[] = PLANOS_CORTE,
  lado: 'corte' | 'oculto' = 'corte',
): { x: number; y: number } | null {
  camara.updateMatrixWorld();
  const cajas = candidatas.map((c) => {
    c.malla.updateWorldMatrix(true, false);
    if (!c.malla.geometry.boundingBox) c.malla.geometry.computeBoundingBox();
    return c.malla.geometry.boundingBox!.clone().applyMatrix4(c.malla.matrixWorld);
  });
  const propia = new THREE.Box3();
  candidatas.forEach((c, i) => c.pieza === objetivo && propia.union(cajas[i]!));
  if (propia.isEmpty()) return null;
  // Rectángulo en pantalla de la caja del objetivo, recortado a [-1, 1].
  const esquinas = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
    const q = new THREE.Vector3(k & 1 ? propia.max.x : propia.min.x, k & 2 ? propia.max.y : propia.min.y, k & 4 ? propia.max.z : propia.min.z).project(camara);
    return new THREE.Vector2(q.x, q.y);
  });
  const { min, max } = new THREE.Box2().setFromPoints(esquinas).intersect(new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1)));
  if (!(max.x > min.x && max.y > min.y)) return null;

  const raycaster = new THREE.Raycaster();
  const rayoLocal = new THREE.Ray();
  const cuenta = (nx: number, ny: number): boolean => {
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camara);
    const rayo = raycaster.ray;
    let mejor = { d: Infinity, ok: false };
    // Lado oculto: basta un impacto visible, de cualquier candidata, para invalidar la celda.
    let hayVisible = false;
    let hayOculto = false;
    candidatas.forEach((c, i) => {
      const arbol = c.malla.geometry.boundsTree;
      if (!arbol || !rayo.intersectsBox(cajas[i]!)) return;
      const mundo = c.malla.matrixWorld;
      rayoLocal.copy(rayo).applyMatrix4(mundo.clone().invert());
      for (const hit of arbol.raycast(rayoLocal, THREE.DoubleSide)) {
        const punto = hit.point.clone().applyMatrix4(mundo);
        if (lado === 'oculto') {
          if (c.cortada && !seVeConRecorte(punto, planos)) hayOculto ||= c.pieza === objetivo;
          else hayVisible = true;
          continue;
        }
        const d = punto.distanceTo(rayo.origin);
        if (d >= mejor.d || (c.cortada && !seVeConRecorte(punto, planos))) continue;
        // Cara trasera: la normal local mira en el sentido del rayo (al revés si la matriz está espejada).
        const trasera = hit.face!.normal.dot(rayoLocal.direction) * (mundo.determinant() < 0 ? -1 : 1) > 0;
        mejor = { d, ok: c.pieza === objetivo && trasera };
      }
    });
    return lado === 'oculto' ? hayOculto && !hayVisible : mejor.ok;
  };

  const centro = (i: number, a: number, b: number) => a + ((i + 0.5) / CELDAS) * (b - a);
  const celdas = Array.from({ length: CELDAS }, (_, i) => Array.from({ length: CELDAS }, (_, j) => cuenta(centro(i, min.x, max.x), centro(j, min.y, max.y))));
  const ok = (i: number, j: number) => celdas[i]?.[j] === true;
  // Margen de una celda válida: cuántas celdas (distancia de ajedrez) hasta la primera inválida o el borde de la grilla.
  // Se elige la de mayor margen (la primera en recorrer la grilla si empatan): un punto en el medio de la región aguanta
  // un desfase de pocos píxeles de la cámara o del puntero, uno pegado al borde no.
  const margen = (i: number, j: number) => {
    for (let r = 1; r <= CELDAS; r++) {
      // Solo el anillo de radio r: lo de adentro ya se revisó con radios menores.
      for (let a = -r; a <= r; a++) {
        if (!ok(i + a, j - r) || !ok(i + a, j + r)) return r;
      }
      for (let b = -r + 1; b <= r - 1; b++) {
        if (!ok(i - r, j + b) || !ok(i + r, j + b)) return r;
      }
    }
    return CELDAS;
  };
  let mejorCelda: { x: number; y: number; margen: number } | null = null;
  for (let i = 0; i < CELDAS; i++) {
    for (let j = 0; j < CELDAS; j++) {
      if (!ok(i, j)) continue;
      const m = margen(i, j);
      if (!mejorCelda || m > mejorCelda.margen) mejorCelda = { x: centro(i, min.x, max.x), y: centro(j, min.y, max.y), margen: m };
    }
  }
  return mejorCelda && { x: mejorCelda.x, y: mejorCelda.y };
}
