// Orden de revisión docente (F24): el tiempo de un docente es poco, así que primero va lo que más
// necesita su criterio. 1) fichas con una duda abierta para él, 2) el nervio vago (trazos, recorridos
// trazados y ramos sin ubicar), 3) los grupos que pide el lanzamiento, en su orden, 4) todo lo demás.
import { dudas, estructuras, grupos, marcadores, nodos } from '../data/atlas';

export type Seccion = 'dudas' | 'vago' | 'grupos' | 'resto';

/** Grupos de estudio en el orden de la meta del lanzamiento (SPEC sección 4, hito 2). */
export const GRUPOS_PRIORITARIOS = ['sistema-limbico', 'ganglios-basales', 'diencefalo', 'tronco-encefalico'];

/** Entradas con ficha bajo un nodo del árbol: el nodo, sus descendientes y los marcadores que cuelgan de ellos. */
export function entradasBajo(id: string): string[] {
  const res: string[] = [];
  const visitar = (n: string) => {
    const nodo = nodos[n];
    const entrada = nodo?.tipo === 'pieza' ? nodo.estructura : n;
    if (entrada && estructuras[entrada]?.ficha && !res.includes(entrada)) res.push(entrada);
    for (const m of marcadores) if (m.padre === n && estructuras[m.id]?.ficha && !res.includes(m.id)) res.push(m.id);
    for (const h of nodo?.hijos ?? []) visitar(h);
  };
  visitar(id);
  return res;
}

/** Lo que falta por revisar, por secciones y sin repetir. `hechas`: entradas con alguna respuesta. */
export function ordenDeRevision(hechas: Set<string>, extrasVago: string[] = []): { seccion: Seccion; ids: string[] }[] {
  const usadas = new Set<string>();
  const tomar = (ids: string[]) => {
    const r: string[] = [];
    for (const id of ids) {
      if (!estructuras[id]?.ficha || hechas.has(id) || usadas.has(id)) continue;
      usadas.add(id);
      r.push(id);
    }
    return r;
  };
  const secciones: { seccion: Seccion; ids: string[] }[] = [
    { seccion: 'dudas', ids: tomar(Object.keys(dudas)) },
    { seccion: 'vago', ids: tomar([...extrasVago, ...entradasBajo('g-vagus-nerve-x')]) },
    {
      seccion: 'grupos',
      ids: tomar(
        GRUPOS_PRIORITARIOS.flatMap((g) => grupos.find((x) => x.id === g)?.miembros.flatMap((m) => (nodos[m] ? entradasBajo(m) : [m])) ?? []),
      ),
    },
    { seccion: 'resto', ids: tomar(Object.keys(estructuras)) },
  ];
  return secciones.filter((s) => s.ids.length);
}
