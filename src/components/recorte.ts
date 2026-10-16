// Recortes del visor. Dos usos de los planos de three, sin tocar jamás la geometría ni la posición de una pieza:
// el revelado progresivo del recorrido del vago (F14), con su plano propio, y los planos de corte del encéfalo (F8),
// con el fantasma opcional del lado oculto, el relleno de la cara del corte con las caras traseras de las mallas
// cerradas (ADR 0011), el contorno del corte (líneas calculadas con el BVH, sin relleno: en las mallas abiertas, y en
// todas las cortadas cuando el relleno se apaga por lentitud o por un shader que no compila) y el toque que descarta
// lo que quedó oculto (`raycastCorte`).
// Todo lo que se prueba vive aquí, sin montar el Canvas; `Visor.tsx` solo lo usa.
import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import cerradasJson from '../config/mallas-cerradas.json';
import { esFragmentable, esMallaDeToque, nodos, origenDe } from '../data/atlas';
import {
  EJE,
  esEncefalo,
  hayCortes,
  piezasCruzadas,
  piezasEncefalo,
  planoDe,
  PLANOS,
  rangoCerebro,
  vigilarCuadros,
  type Cortes,
  type EstadoCuadros,
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

/**
 * Árbol de intersección de una geometría (el que usan el toque y el contorno del corte). `MeshBVH` reordena el índice de
 * la geometría en sitio, y en el GLB varias mallas comparten el mismo índice (los núcleos del tronco, de topología
 * idéntica): sin una copia propia, cada árbol nuevo desordena el índice de los anteriores y esos árboles dejan de
 * encontrar triángulos. Por eso la geometría recibe su propio índice antes de construir el árbol.
 */
export function construirBvh(geometria: THREE.BufferGeometry): MeshBVH {
  if (geometria.index) geometria.setIndex(geometria.index.clone());
  return new MeshBVH(geometria);
}

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

type EstadoCortada = Omit<EstadoFantasma, 'fantasmaCorte'>;

/** `rellenoApagado`: el relleno se apagó en este equipo (R8.2, R3.4); todas las piezas cortadas pasan a contorno. */
export type EstadoRelleno = EstadoCortada & { rellenoApagado: boolean };

/**
 * Pieza cortada y visible: es del encéfalo, hay cortes activos, se ve (ni oculta, ni fuera del aislamiento, ni
 * aproximada con solo escaneada) y algún plano activo cruza su caja (cruce estricto). Mismo filtro que el fantasma.
 * Es la base del relleno y del contorno.
 */
function piezaCortadaVisible(pieza: string, s: EstadoCortada): boolean {
  if (!hayCortes(s.cortes) || !esEncefalo(pieza)) return false;
  if (s.ocultas.has(pieza)) return false;
  if (s.aislar && !s.aislar.piezas.has(pieza)) return false;
  if (origenDe(pieza) === 'aproximada' && s.soloEscaneada) return false;
  return piezasCruzadas(s.cajas, [pieza], s.cortes, rangoActual(s.cajas)).length > 0;
}

/**
 * Si la pieza lleva relleno del corte: está cortada y visible (ver `piezaCortadaVisible`) y el relleno no se apagó.
 * Con el relleno apagado nunca lleva: pasa a contorno.
 */
export function piezaConRelleno(pieza: string, s: EstadoRelleno): boolean {
  return !s.rellenoApagado && piezaCortadaVisible(pieza, s);
}

/** De las mallas de una pieza, las que se rellenan: cerradas y que no son el tubo del toque. Conserva el orden. */
export function mallasRellenables(nombres: readonly string[], cerradas: ReadonlySet<string> = MALLAS_CERRADAS): string[] {
  return nombres.filter((n) => !esMallaDeToque(n) && cerradas.has(n));
}

/** Mallas de `pieza` que llevan relleno ahora (vacío sin planos activos o con el relleno apagado). `nombres` son las mallas de la pieza. */
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

/**
 * Planos activos como `THREE.Plane` nuevos, en el orden de `PLANOS` y con la convención de `PLANOS_CORTE` (se ve donde
 * normal·p + constante >= 0). Salen del estado y no de `PLANOS_CORTE`: el orden de los `useFrame` no está fijado.
 */
export function planosActivos(cortes: Cortes, rango: Rango): THREE.Plane[] {
  return PLANOS.filter((p) => cortes[p].activo).map((p) => {
    const { normal, constante } = planoDe(p, cortes[p], rango);
    return new THREE.Plane(new THREE.Vector3(normal[0], normal[1], normal[2]), constante);
  });
}

const _cruce = new THREE.Vector3();

/** Recorta el segmento p-q (en sitio) contra todos los planos menos `omitir`; false si no queda nada del lado visible. */
function recortarSegmento(p: THREE.Vector3, q: THREE.Vector3, planos: readonly THREE.Plane[], omitir: number): boolean {
  for (let j = 0; j < planos.length; j++) {
    if (j === omitir) continue;
    const dp = planos[j]!.distanceToPoint(p);
    const dq = planos[j]!.distanceToPoint(q);
    const pFuera = dp < 0;
    const qFuera = dq < 0;
    if (pFuera && qFuera) return false;
    if (pFuera || qFuera) {
      _cruce.lerpVectors(p, q, dp / (dp - dq));
      (pFuera ? p : q).copy(_cruce);
    }
  }
  return true;
}

/**
 * Segmentos donde los planos cortan la geometría, ya recortados al lado visible de los demás planos (el contorno del
 * corte, sin relleno). Posiciones en el espacio local de la geometría, 6 floats por segmento: se dibujan con la misma
 * `matriz`. Usa el BVH de la geometría (un `shapecast` por plano); sin BVH o sin planos devuelve vacío y nunca construye
 * uno (esto corre dentro de un cuadro). Un vértice sobre el plano cuenta del lado visible (`d >= 0`, como `seVeConRecorte`).
 */
export function segmentosDeCorte(geometria: THREE.BufferGeometry, matriz: THREE.Matrix4, planos: readonly THREE.Plane[]): Float32Array {
  const arbol = geometria.boundsTree;
  if (!arbol || !planos.length) return new Float32Array(0);
  const inversa = matriz.clone().invert();
  const locales = planos.map((p) => p.clone().applyMatrix4(inversa));
  const salida: number[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  locales.forEach((plano, i) => {
    arbol.shapecast({
      intersectsBounds: (caja) => plano.intersectsBox(caja),
      // El triángulo es de un pool: se lee en el momento. `false` sigue el recorrido.
      intersectsTriangle: (tri) => {
        const da = plano.distanceToPoint(tri.a);
        const db = plano.distanceToPoint(tri.b);
        const dc = plano.distanceToPoint(tri.c);
        let n = 0;
        const arista = (u: THREE.Vector3, v: THREE.Vector3, du: number, dv: number) => {
          if (du < 0 === (dv < 0)) return;
          (n === 0 ? p : q).lerpVectors(u, v, du / (du - dv));
          n++;
        };
        arista(tri.a, tri.b, da, db);
        arista(tri.b, tri.c, db, dc);
        arista(tri.c, tri.a, dc, da);
        if (n === 2 && p.distanceToSquared(q) > 0 && recortarSegmento(p, q, locales, i)) {
          salida.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
        return false;
      },
    });
  });
  return new Float32Array(salida);
}

/** Piezas del encéfalo que llevan contorno: cortadas y visibles, y abiertas (o todas, si el relleno se apagó). En el orden de `piezasEncefalo`. */
export function piezasConContorno(s: EstadoRelleno, cerradas: ReadonlySet<string> = MALLAS_CERRADAS): string[] {
  return piezasEncefalo.filter(
    (p) => piezaCortadaVisible(p, s) && (s.rellenoApagado || !cerradas.has(nodos[p]?.malla ?? '')),
  );
}

/** De las mallas de una pieza, las que llevan contorno: sin el tubo del toque, y solo las abiertas con el relleno encendido. */
export function mallasDeContorno(nombres: readonly string[], rellenoApagado: boolean, cerradas: ReadonlySet<string> = MALLAS_CERRADAS): string[] {
  return nombres.filter((n) => !esMallaDeToque(n) && (rellenoApagado || !cerradas.has(n)));
}

export interface MallaParaContorno {
  nombre: string;
  geometria: THREE.BufferGeometry;
  matriz: THREE.Matrix4;
}

/**
 * Líneas del contorno de una malla, vacías hasta el primer `refrescarContorno`. Sin `clippingPlanes`: el recorte se hace
 * en CPU contra los otros planos. Nunca se toca (el umbral de línea de three, 1 unidad, taparía todos los toques) y no
 * lleva `nombreMalla`, así que no cuenta como malla de pieza.
 */
export function crearLineaContorno(matriz: THREE.Matrix4, color: THREE.ColorRepresentation, pieza: string): THREE.LineSegments {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(0, 3));
  const linea = new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({ color }));
  linea.matrixAutoUpdate = false;
  linea.matrix.copy(matriz);
  // Sin padre que la actualice cada cuadro, la matriz del mundo se calcula una vez.
  linea.matrixWorldNeedsUpdate = true;
  linea.raycast = raycastNulo;
  linea.userData = { contorno: true, pieza };
  return linea;
}

/**
 * Recalcula las líneas solo si cambió la referencia de `cortes` o de `rango`, o el árbol de la geometría, desde la última
 * vez (el índice de toque llega después del primer cuadro: sin árbol la línea queda vacía y debe rehacerse cuando llega).
 * Reemplaza la geometría de la línea (libera la anterior) y devuelve true; false si no había nada que hacer. Muta `linea`.
 */
export function refrescarContorno(linea: THREE.LineSegments, geometria: THREE.BufferGeometry, cortes: Cortes, rango: Rango): boolean {
  const arbol = geometria.boundsTree ?? null;
  if (linea.userData.cortes === cortes && linea.userData.rango === rango && linea.userData.arbol === arbol) return false;
  const nueva = new THREE.BufferGeometry();
  nueva.setAttribute('position', new THREE.Float32BufferAttribute(segmentosDeCorte(geometria, linea.matrix, planosActivos(cortes, rango)), 3));
  const anterior = linea.geometry;
  linea.geometry = nueva;
  anterior.dispose();
  linea.userData.cortes = cortes;
  linea.userData.rango = rango;
  linea.userData.arbol = arbol;
  return true;
}

/** Libera la geometría y el material de cada línea (la geometría de la pieza no se toca: es compartida). */
export function liberarContornos(lineas: readonly THREE.LineSegments[]): void {
  for (const l of lineas) {
    l.geometry.dispose();
    (l.material as THREE.Material).dispose();
  }
}

/**
 * Un shader no compiló (`renderer.debug.onShaderError`): se apaga el relleno y las piezas pasan a contorno. No escribe
 * en consola; al asignarse, three deja de llamar a su propio `console.error`. No sabe qué material falló: apaga siempre.
 */
export function alErrorShaderRelleno(estado: { apagarRelleno(): void }): void {
  estado.apagarRelleno();
}

/** Una muestra de cuadros por segundo: si el vigilante dice que ya van 5 s bajo el umbral con cortes, apaga el relleno (R8.2). */
export function alMuestraFps(vigilante: EstadoCuadros, fps: number, estado: { cortes: Cortes; apagarRelleno(): void }): void {
  if (vigilarCuadros(vigilante, fps, hayCortes(estado.cortes))) estado.apagarRelleno();
}

export interface AcumuladoCuadros {
  cuadros: number;
  tiempo: number;
}

/**
 * Un cuadro dibujado: acumula y, cada 0,5 s, calcula los cuadros por segundo, los publica con `publicar` y se los da al
 * vigilante (R8.2), salvo con `sinVigilante` (solo E2E en DEV). Muta `acumulado` y `vigilante`.
 */
export function alCuadro(
  acumulado: AcumuladoCuadros,
  dt: number,
  vigilante: EstadoCuadros,
  estado: { cortes: Cortes; apagarRelleno(): void },
  publicar: (fps: number) => void,
  sinVigilante = false,
): void {
  acumulado.cuadros += 1;
  acumulado.tiempo += dt;
  if (acumulado.tiempo < 0.5) return;
  const fps = Math.round(acumulado.cuadros / acumulado.tiempo);
  publicar(fps);
  if (!sinVigilante) alMuestraFps(vigilante, fps, estado);
  acumulado.cuadros = 0;
  acumulado.tiempo = 0;
}

/** El renderer que se asigna en `onCreated`: solo lo que `configurarRenderer` toca. */
export interface RendererConfigurable {
  localClippingEnabled: boolean;
  debug: { onShaderError: THREE.WebGLDebug['onShaderError'] };
}

/**
 * Configura el renderer: recortes locales (recorrido del vago y planos de corte, F8) y el manejador de shaders que no
 * compilan (R3.4), que apaga el relleno. `estado` se lee al fallar, no al configurar. Con un manejador propio three no
 * escribe su `console.error`.
 */
export function configurarRenderer(gl: RendererConfigurable, estado: () => { apagarRelleno(): void }): void {
  gl.localClippingEnabled = true;
  gl.debug.onShaderError = () => alErrorShaderRelleno(estado());
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
 * Null también si alguna candidata aún no tiene árbol (el índice de toque se arma después del primer cuadro): sin todos
 * los árboles no puede asegurar qué impacto se ve. Quien consulta repite la pregunta hasta que haya respuesta.
 */
export function puntoDeCorte(
  objetivo: string,
  candidatas: readonly CandidataCorte[],
  camara: THREE.Camera,
  planos: readonly THREE.Plane[] = PLANOS_CORTE,
  lado: 'corte' | 'oculto' = 'corte',
): { x: number; y: number } | null {
  if (candidatas.some((c) => !c.malla.geometry.boundsTree)) return null;
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
