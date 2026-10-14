import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { cajaDePuntos, type Caja } from './modelo.ts';

export async function io(): Promise<NodeIO> {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

/** Un nodo con malla a la vez, para que `cajasDelDocumento` no tenga todas las posiciones en memoria. */
function* nodosConVertices(doc: Document, nombres?: ReadonlySet<string>): Generator<[string, [number, number, number][]]> {
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (nombres && !nombres.has(node.getName())) continue;
    const m = node.getWorldMatrix();
    const puntos: [number, number, number][] = [];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const [x, y, z] = v as [number, number, number];
        puntos.push([
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        ]);
      }
    }
    yield [node.getName(), puntos];
  }
}

/**
 * Posiciones de mundo (glTF, Y arriba) de los vértices de cada nodo con malla, por nombre de nodo.
 * Con `nombres`, solo esos nodos: así no se arman millones de tuplas que nadie va a mirar.
 */
export function verticesDelDocumento(doc: Document, nombres?: ReadonlySet<string>): Record<string, [number, number, number][]> {
  return Object.fromEntries(nodosConVertices(doc, nombres));
}

/** Caja en coordenadas de mundo de cada nodo con malla, por nombre de nodo. */
export function cajasDelDocumento(doc: Document): Record<string, Caja> {
  const res: Record<string, Caja> = {};
  for (const [nombre, puntos] of nodosConVertices(doc)) res[nombre] = cajaDePuntos(puntos);
  return res;
}
