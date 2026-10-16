// Índice de toque (issue 178): los árboles BVH que hacen rápido el toque y el contorno del corte se arman DESPUÉS del
// primer cuadro, en el hilo principal y por tandas. Cada tanda tiene un presupuesto de tiempo y se programa como una
// tarea del navegador: entre tanda y tanda el navegador dibuja y atiende el toque.
//
// Por qué por tandas y no con el worker de three-mesh-bvh 0.8.3 (`GenerateMeshBVHWorker`): transfiere (deja vacío) el
// arreglo `position` de la geometría mientras se dibuja; el GLB comparte buffers entre mallas gemelas y el worker
// escribe el índice reordenado en el atributo compartido, justo lo que `construirBvh` evita; falla con atributos
// intercalados; y no trae tipos (están comentados en su `index.d.ts`).
//
// Mientras falta el árbol de una malla, `acceleratedRaycast` cae solo al raycast normal de three: el toque funciona,
// solo que más lento.
import type * as THREE from 'three';
import { construirBvh } from './recorte';

/** Cuánto puede durar una tanda (ms). Deja unos 4 ms de un cuadro de 60 Hz para dibujar. Se ajusta con la medición del editor. */
export const PRESUPUESTO_INDICE_MS = 12;

const triangulos = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position!.count) / 3;

/**
 * Geometrías que hay que indexar: sin repetidas (una geometría compartida por dos mallas va una vez) y sin las que ya
 * tienen árbol. De más a menos triángulos, para que lleguen primero los árboles que más le cuestan al raycast normal;
 * a igual cantidad se conserva el orden de entrada.
 */
export function colaDeIndice(geometrias: Iterable<THREE.BufferGeometry>): THREE.BufferGeometry[] {
  const vistas = new Set<THREE.BufferGeometry>();
  const cola: THREE.BufferGeometry[] = [];
  for (const g of geometrias) {
    if (vistas.has(g)) continue;
    vistas.add(g);
    if (!g.boundsTree) cola.push(g);
  }
  return cola.sort((a, b) => triangulos(b) - triangulos(a));
}

/**
 * Arma árboles de la cola, desde el principio, hasta agotar el presupuesto. Siempre arma al menos uno por llamada (un
 * árbol no se puede partir) y nunca reconstruye una geometría que ya tiene árbol. Siempre con `construirBvh`.
 * Devuelve true cuando la cola quedó vacía.
 */
export function avanzarIndice(cola: THREE.BufferGeometry[], presupuestoMs: number, ahora: () => number): boolean {
  const inicio = ahora();
  while (cola.length) {
    const g = cola.shift()!;
    if (!g.boundsTree) g.boundsTree = construirBvh(g);
    if (ahora() - inicio >= presupuestoMs) break;
  }
  return cola.length === 0;
}

export interface OpcionesIndice {
  presupuestoMs: number;
  ahora(): number;
  /** Agenda una tanda como tarea del navegador. */
  programar(fn: () => void): void;
  /** Agenda una nueva revisión más adelante, mientras el índice está retenido. */
  esperar(fn: () => void): void;
  /** Solo E2E (DEV): mientras sea true no se arma nada. */
  retenido(): boolean;
  alEmpezar(): void;
  alTerminar(): void;
}

/**
 * Arma la cola por tandas. No construye nada al llamarse: la primera tanda es una tarea programada, así que corre
 * después de lo que esté en curso (el cuadro que se está dibujando). Devuelve la función que cancela las tandas siguientes.
 */
export function arrancarIndice(cola: THREE.BufferGeometry[], o: OpcionesIndice): () => void {
  let cancelado = false;
  let empezo = false;
  const tanda = () => {
    if (cancelado) return;
    if (o.retenido()) {
      o.esperar(tanda);
      return;
    }
    if (!empezo) {
      empezo = true;
      o.alEmpezar();
    }
    if (avanzarIndice(cola, o.presupuestoMs, o.ahora)) o.alTerminar();
    else o.programar(tanda);
  };
  o.programar(tanda);
  return () => {
    cancelado = true;
  };
}

/**
 * Programa `fn` como tarea del navegador. Un `MessageChannel` cede el hilo entre tandas sin la espera mínima de 4 ms
 * que `setTimeout` anidado suma; sin `MessageChannel` se usa `setTimeout`.
 */
export function programarTarea(fn: () => void): void {
  if (typeof MessageChannel === 'undefined') {
    setTimeout(fn, 0);
    return;
  }
  const canal = new MessageChannel();
  canal.port1.onmessage = () => {
    canal.port1.close();
    fn();
  };
  canal.port2.postMessage(null);
}
