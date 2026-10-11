// Índices de solo lectura sobre los datos del atlas. Se construyen una vez al cargar.
import arbolJson from './arbol.json';
import estructurasJson from './estructuras.json';
import gruposJson from './grupos.json';
import marcadoresJson from './marcadores.json';
import type { Arbol, Estructura, Estructuras, GrupoEstudio, Idioma, Marcador, NodoArbol } from './tipos';

export const arbol = arbolJson as unknown as Arbol;
export const datos = estructurasJson as unknown as Estructuras;
export const grupos = gruposJson as unknown as GrupoEstudio[];
export const marcadores = marcadoresJson as unknown as Marcador[];

export const nodos = arbol.nodos;
export const estructuras = datos.estructuras;

/** Malla visible o de toque en el GLB -> id de pieza. 'Vagus nerve (X).r#t03#toque' -> 'vagus-nerve-x-r'. */
const piezaPorMalla = new Map<string, string>();
for (const n of Object.values(nodos)) if (n.tipo === 'pieza' && n.malla) piezaPorMalla.set(n.malla, n.id);

export function mallaBase(nombreNodo: string): string {
  return nombreNodo.split('#')[0]!;
}

export function piezaDeMalla(nombreNodo: string): string | undefined {
  return piezaPorMalla.get(mallaBase(nombreNodo));
}

export const esMallaDeToque = (nombre: string) => nombre.endsWith('#toque');

/** Número de trazo del vago en el nombre de la malla, o null. */
export function trazoDeMalla(nombre: string): number | null {
  const m = /#t(\d+)/.exec(nombre);
  return m ? Number(m[1]) : null;
}

export const todasLasPiezas: string[] = Object.values(nodos)
  .filter((n) => n.tipo === 'pieza')
  .map((n) => n.id);

export const piezasDeEstudio: string[] = todasLasPiezas.filter((id) => nodos[id]!.clase === 'estudio');

const cacheDescendientes = new Map<string, string[]>();
/** Piezas bajo un nodo del árbol (incluido él mismo si es pieza). */
export function piezasBajo(id: string): string[] {
  const hit = cacheDescendientes.get(id);
  if (hit) return hit;
  const n = nodos[id];
  let res: string[] = [];
  if (n) {
    if (n.tipo === 'pieza') res = [id];
    else res = n.hijos.flatMap((h) => piezasBajo(h));
  }
  cacheDescendientes.set(id, res);
  return res;
}

/** Piezas de una entrada de estructuras.json: una estructura (sus lados) o un grupo (todo lo de abajo). */
const piezasPorEstructura = new Map<string, string[]>();
for (const n of Object.values(nodos)) {
  if (n.tipo === 'pieza' && n.estructura) {
    const l = piezasPorEstructura.get(n.estructura) ?? [];
    l.push(n.id);
    piezasPorEstructura.set(n.estructura, l);
  }
}
export function piezasDeEntrada(id: string): string[] {
  if (nodos[id]?.tipo === 'grupo') return piezasBajo(id);
  return piezasPorEstructura.get(id) ?? [];
}

/** Entrada de estructuras.json que describe un nodo del árbol. */
export function entradaDeNodo(n: NodoArbol): Estructura | undefined {
  return estructuras[n.tipo === 'pieza' ? n.estructura! : n.id];
}

export function entradaDePieza(piezaId: string): Estructura | undefined {
  const n = nodos[piezaId];
  return n ? entradaDeNodo(n) : undefined;
}

/** Nodo del árbol que contiene a la entrada (para "Hipocampo, en Lóbulo límbico"). */
export function padreDeEntrada(id: string): string | null {
  if (nodos[id]) return nodos[id]!.padre;
  const pieza = piezasPorEstructura.get(id)?.[0];
  if (pieza) return nodos[pieza]!.padre;
  const m = marcadores.find((x) => x.id === id);
  return m?.padre ?? null;
}

const porSlug: Record<Idioma, Map<string, string>> = { es: new Map(), en: new Map() };
for (const e of Object.values(estructuras)) {
  porSlug.es.set(e.slug.es, e.id);
  porSlug.en.set(e.slug.en, e.id);
}
/** Resuelve un slug en el idioma pedido y, si no existe, en el otro (enlaces cruzados). */
export function entradaPorSlug(slug: string, idioma: Idioma): string | undefined {
  const otro: Idioma = idioma === 'es' ? 'en' : 'es';
  return porSlug[idioma].get(slug) ?? porSlug[otro].get(slug);
}

export const PENDIENTE = 'PENDIENTE';

export function marcadorPorId(id: string): Marcador | undefined {
  return marcadores.find((m) => m.id === id);
}

export const marcadoresPorPadre = new Map<string, Marcador[]>();
for (const m of marcadores) {
  const l = marcadoresPorPadre.get(m.padre) ?? [];
  l.push(m);
  marcadoresPorPadre.set(m.padre, l);
}
