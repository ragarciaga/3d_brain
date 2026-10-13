// Mallas cerradas del encéfalo (SPEC R3.2, ADR 0011): una malla es cerrada si no tiene bordes
// abiertos tras soldar vértices a 6 decimales. Solo las cerradas llevan relleno de corte.
import type { Document } from '@gltf-transform/core';
import type { Arbol } from '../../src/data/tipos.ts';

const TRIANGULOS = 4;

export interface Primitiva {
  posiciones: ArrayLike<number>;
  indices: ArrayLike<number> | null;
  /** Modo glTF; 4 (TRIANGLES) por defecto. */
  modo?: number;
}

export interface MedidaMalla {
  triangulos: number;
  bordes: number;
  cerrada: boolean;
}

/** Cuenta las aristas de borde (usadas por exactamente un triángulo) de una malla de varias primitivas. */
export function medirMalla(primitivas: Primitiva[]): MedidaMalla {
  const ids = new Map<string, number>();
  const aristas = new Map<string, number>();
  let triangulos = 0;
  let soloTriangulos = true;

  for (const prim of primitivas) {
    if ((prim.modo ?? TRIANGULOS) !== TRIANGULOS) {
      soloTriangulos = false;
      continue;
    }
    const pos = prim.posiciones;
    const global: number[] = [];
    for (let i = 0; i + 2 < pos.length; i += 3) {
      const llave = `${Math.round(pos[i]! * 1e6)},${Math.round(pos[i + 1]! * 1e6)},${Math.round(pos[i + 2]! * 1e6)}`;
      let id = ids.get(llave);
      if (id === undefined) {
        id = ids.size;
        ids.set(llave, id);
      }
      global.push(id);
    }
    const n = prim.indices ? prim.indices.length : global.length;
    for (let t = 0; t + 2 < n; t += 3) {
      const tri = [0, 1, 2].map((k) => global[prim.indices ? prim.indices[t + k]! : t + k]!);
      triangulos++;
      for (let k = 0; k < 3; k++) {
        const a = tri[k]!;
        const b = tri[(k + 1) % 3]!;
        if (a === b) continue;
        const llave = a < b ? `${a}-${b}` : `${b}-${a}`;
        aristas.set(llave, (aristas.get(llave) ?? 0) + 1);
      }
    }
  }

  let bordes = 0;
  for (const usos of aristas.values()) if (usos === 1) bordes++;
  return { triangulos, bordes, cerrada: soloTriangulos && triangulos > 0 && bordes === 0 };
}

/** Nombres de malla de las piezas de estudio bajo g-brain (sin #toque, sin vago ni órganos). */
export function mallasDelEncefalo(arbol: Arbol): string[] {
  const raiz = arbol.nodos['g-brain'];
  if (!raiz) throw new Error('arbol.json no tiene el grupo g-brain.');
  const res: string[] = [];
  const visitados = new Set<string>();
  const visitar = (id: string, bajoVago: boolean): void => {
    if (visitados.has(id)) return;
    visitados.add(id);
    const nodo = arbol.nodos[id];
    if (!nodo) return;
    const vago = bajoVago || id === 'g-vagus-nerve-x';
    if (nodo.tipo === 'pieza' && nodo.clase === 'estudio' && nodo.malla && !vago && !nodo.malla.endsWith('#toque')) {
      res.push(nodo.malla);
    }
    for (const h of nodo.hijos) visitar(h, vago);
  };
  for (const h of raiz.hijos) visitar(h, false);
  return res;
}

/** Compara la lista commiteada con lo medido en el GLB; devuelve los errores en español. */
export function compararMallasCerradas(
  lista: string[],
  medidas: Record<string, MedidaMalla>,
  nombresGlb: string[],
): string[] {
  const errores: string[] = [];
  const listadas = new Set(lista);
  for (const [nombre, m] of Object.entries(medidas)) {
    if (m.cerrada && !listadas.has(nombre)) {
      errores.push(`Falta en mallas-cerradas.json (cerrada en el GLB): ${nombre}`);
    } else if (!m.cerrada && listadas.has(nombre)) {
      errores.push(`Sobra en mallas-cerradas.json (tiene ${m.bordes} bordes abiertos en el GLB): ${nombre}`);
    }
  }
  const glb = new Set(nombresGlb);
  for (const nombre of lista) {
    if (nombre in medidas) continue;
    errores.push(
      glb.has(nombre)
        ? `mallas-cerradas.json nombra una malla que no es pieza de estudio del encéfalo: ${nombre}`
        : `mallas-cerradas.json nombra una malla que no existe en el GLB: ${nombre}`,
    );
  }
  return errores;
}

/** Primitivas (posiciones locales, índices y modo) de cada nodo con malla, por nombre de nodo. */
export function primitivasDelDocumento(doc: Document): Record<string, Primitiva[]> {
  const res: Record<string, Primitiva[]> = {};
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const lista: Primitiva[] = [];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const posiciones = new Float64Array(pos.getCount() * 3);
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        posiciones[i * 3] = v[0]!;
        posiciones[i * 3 + 1] = v[1]!;
        posiciones[i * 3 + 2] = v[2]!;
      }
      lista.push({ posiciones, indices: prim.getIndices()?.getArray() ?? null, modo: prim.getMode() });
    }
    res[node.getName()] = lista;
  }
  return res;
}
