// Color con lógica de atlas (SPEC sección 11): nervios en amarillo, cada lóbulo con su color fijo.
// El color nunca es la única pista: toda pieza tiene nombre en el árbol, la ficha y la etiqueta.
import { nodos } from '../data/atlas';

const POR_GRUPO: Record<string, string> = {
  'g-frontal-lobe': '#7fa8d6',
  'g-parietal-lobe': '#93c47d',
  'g-temporal-lobe': '#f2b56b',
  'g-occipital-lobe': '#c58bb0',
  'g-limbic-lobe': '#e07a7a',
  'g-insula': '#e8cf6a',
  'g-interlobar-sulci': '#c9c9c9',
  'g-diencephalon': '#9b8fd0',
  'g-brainstem': '#b9a89a',
  'g-cerebellum': '#7fb3bd',
  'g-corpus-striatum': '#c98a4b',
  'g-basal-forebrain': '#e39a5c',
  'g-commissural-fibres-of-telencephalon': '#f1efe6',
  'g-projection-fibres-of-telencephalon': '#f1efe6',
  'g-vagus-nerve-x': '#e5c12e',
  'g-organos-referencia': '#c98f8f',
};
const NEUTRO = '#d8c3b4';
const cache = new Map<string, string>();

export function colorDePieza(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  let p = nodos[id]?.padre ?? null;
  let color = NEUTRO;
  while (p) {
    const c = POR_GRUPO[p];
    if (c) {
      color = c;
      break;
    }
    p = nodos[p]?.padre ?? null;
  }
  if (/ventricle|aqueduct|choroid/i.test(nodos[id]?.en ?? '')) color = '#8fc3e8';
  if (/nucleus|nuclei/i.test(nodos[id]?.en ?? '') && nodos[id]?.padre === 'g-brainstem') color = '#d9534f';
  cache.set(id, color);
  return color;
}
