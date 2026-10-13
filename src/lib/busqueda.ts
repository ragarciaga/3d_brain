// Búsqueda bilingüe (F3): español, inglés, latín y sinónimos al mismo tiempo, sin importar el
// idioma de la interfaz, tolerante a errores de digitación y a la falta de tildes.
import Fuse from 'fuse.js';
import type { Estructura } from '../data/tipos';
import { normalizar } from './texto';

interface Doc {
  id: string;
  terminos: string[];
}

export interface Buscador {
  buscar(q: string, max?: number): string[];
}

export function crearBuscador(entradas: Estructura[]): Buscador {
  const docs: Doc[] = entradas.map((e) => ({
    id: e.id,
    terminos: [e.nombre.es, e.nombre.en, e.latin, ...e.sinonimos.es, ...e.sinonimos.en]
      .filter((t) => t && t !== 'PENDIENTE' && t !== 'SIN_TERMINO_OFICIAL')
      .map(normalizar),
  }));
  const fuse = new Fuse(docs, {
    keys: ['terminos'],
    threshold: 0.34,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  return {
    buscar(q, max = 12) {
      const nq = normalizar(q);
      if (nq.length < 2) return [];
      return fuse.search(nq, { limit: max }).map((r) => r.item.id);
    },
  };
}
