// Orden de revisión docente (F24): el tiempo de un docente es poco, así que primero va lo que más
// necesita su criterio. 1) fichas con una duda abierta para él, 2) el nervio vago (trazos, recorridos
// trazados y ramos sin ubicar), 3) los grupos que pide el lanzamiento, en su orden, 4) todo lo demás.
import { dudas, estructuras, grupos, marcadores, nodos, piezasDeEntrada } from '../data/atlas';
import type { Idioma } from '../data/tipos';
import { claveRespuesta } from './revision';
import { campoTrazado, type RutaTrazada } from './rutas';

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

type RutasDeFicha = Pick<RutaTrazada, 'lado' | 'entrada'>[];

/**
 * Claves de respuesta (`claveRespuesta`) de los controles de tres botones que `Ficha.tsx` dibuja para una
 * entrada en modo revisión, en el idioma activo y en el mismo orden. Es `[]` si la entrada no tiene ficha.
 * No entran la posición de un marcador ni los trazos del vago, que no son controles de tres botones.
 * OJO: si cambia algún `rev(...)` de Ficha.tsx (un campo nuevo, uno quitado, otro idioma), el mismo cambio
 * va aquí; si no, el avance y la lista "Qué revisar" cuentan campos que la ficha no muestra.
 * Esta misma lista decide qué campos responde "Marcar todo como correcto" (Ficha.tsx): si falta un campo,
 * el docente cree haber respondido toda la ficha.
 */
export function camposDeFicha(id: string, idioma: Idioma, rutas: RutasDeFicha = []): string[] {
  const e = estructuras[id];
  const f = e?.ficha;
  if (!e || !f) return [];
  const c = (campo: string, idiomaCampo?: Idioma) => claveRespuesta({ estructura: id, campo, idioma: idiomaCampo });
  const claves = [
    ...(dudas[id] ?? []).map((_, i) => c(`duda.${i}`)),
    c('nombre', 'es'),
    c('nombre', 'en'),
    c('latin'),
    ...(['es', 'en'] as const).filter((i) => e.sinonimos[i].length).map((i) => c('sinonimos', i)),
    ...(piezasDeEntrada(id).length > 0 ? [c('pieza')] : []),
    ...rutas.filter((r) => r.entrada === id).map((r) => c(campoTrazado(r))),
    c('que_es', idioma),
    c('para_que_sirve', idioma),
    c('ubicacion', idioma),
    ...(f.relaciones.length > 0 ? [c('relaciones')] : []),
    ...f.relevancia.map((_, i) => c(`relevancia.${i}`, idioma)),
    ...f.fuentes.map((_, i) => c(`fuente.${i}`)),
  ];
  return [...new Set(claves)];
}

/** Campos respondidos de una ficha y total de campos revisables. `respondidas`: claves de `claveRespuesta`. */
export function avanceDeFicha(id: string, respondidas: Set<string>, idioma: Idioma, rutas: RutasDeFicha = []): { hechos: number; total: number } {
  const campos = camposDeFicha(id, idioma, rutas);
  return { hechos: campos.filter((k) => respondidas.has(k)).length, total: campos.length };
}

// Una ficha está completa cuando tiene respondidos todos sus campos (y tiene alguno).
const completa = (a: { hechos: number; total: number }) => a.total > 0 && a.hechos === a.total;

/** Fichas completas sobre todas las entradas con ficha, en el idioma activo. */
export function avanceGlobal(respondidas: Set<string>, idioma: Idioma, rutas: RutasDeFicha = []): { completas: number; total: number } {
  let completas = 0;
  let total = 0;
  for (const id of Object.keys(estructuras)) {
    if (!estructuras[id]?.ficha) continue;
    total++;
    if (completa(avanceDeFicha(id, respondidas, idioma, rutas))) completas++;
  }
  return { completas, total };
}

/**
 * Lo que falta por revisar, por secciones y sin repetir. Una ficha sigue en la lista mientras le falte algún
 * campo en el idioma activo y sale cuando los tiene todos. En cada sección, las empezadas (con algún campo
 * respondido) van primero, cada grupo en su orden de prioridad previo. `respondidas`: claves de `claveRespuesta`.
 */
export function ordenDeRevision(respondidas: Set<string>, idioma: Idioma, rutas: RutasDeFicha = []): { seccion: Seccion; ids: string[] }[] {
  const extrasVago = rutas.map((r) => r.entrada);
  const usadas = new Set<string>();
  const tomar = (ids: string[]) => {
    const r: string[] = [];
    for (const id of ids) {
      if (!estructuras[id]?.ficha || usadas.has(id)) continue;
      const a = avanceDeFicha(id, respondidas, idioma, rutas);
      if (completa(a)) continue;
      usadas.add(id);
      r.push(id);
    }
    const empezada = (id: string) => avanceDeFicha(id, respondidas, idioma, rutas).hechos > 0;
    return [...r.filter(empezada), ...r.filter((id) => !empezada(id))];
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
