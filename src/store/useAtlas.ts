// Estado de la app. La posición original de las piezas no vive aquí ni se modifica nunca:
// aquí solo hay desplazamientos, visibilidad, selección y modos.
import { create } from 'zustand';
import { nodos, piezasBajo, piezasDeEntrada, todasLasPiezas } from '../data/atlas';
import {
  CERO,
  desplazamientoSeparar,
  desplazamientosExplosion,
  promedio,
  sumar,
  type Nivel,
  type Vec3,
} from '../lib/explosion';
import type { Vista } from '../lib/enlaces';
import { claveRespuesta, type Respuesta } from '../lib/revision';

/** Grupos que se mueven como bloque al separar por lóbulos. */
const BLOQUES_LOBULO = new Set([
  'g-frontal-lobe',
  'g-parietal-lobe',
  'g-temporal-lobe',
  'g-occipital-lobe',
  'g-limbic-lobe',
  'g-insula',
  'g-interlobar-sulci',
  'g-diencephalon',
  'g-brainstem',
  'g-cerebellum',
  'g-corpus-striatum',
  'g-basal-forebrain',
  'g-vagus-nerve-x',
]);

function ancestroBloque(pieza: string): string {
  let p = nodos[pieza]?.padre ?? null;
  let ultimo = pieza;
  while (p) {
    if (BLOQUES_LOBULO.has(p)) return p;
    ultimo = p;
    p = nodos[p]?.padre ?? null;
  }
  return ultimo;
}

export function bloqueDe(pieza: string, nivel: Nivel): string {
  const n = nodos[pieza];
  const lado = n?.lado || 'medio';
  if (nivel === 'piezas') return pieza;
  let raiz = pieza;
  let p = n?.padre ?? null;
  while (p) {
    raiz = p;
    p = nodos[p]?.padre ?? null;
  }
  if (nivel === 'hemisferios') return `${raiz}:${lado}`;
  return `${ancestroBloque(pieza)}:${lado}`;
}

export interface Seleccion {
  entrada: string | null; // id en estructuras.json (estructura, grupo o marcador)
  pieza: string | null; // pieza tocada, si la hay
  malla: string | null; // malla tocada (trazos del vago en modo revisión)
}

export interface PedidoCamara {
  vista?: Vista;
  camara?: number[];
  encuadrar?: string[]; // piezas
  t: number;
}

interface Estado {
  ambos: boolean;
  ocultas: Set<string>;
  seleccion: Seleccion;
  aislar: { modo: 'solo' | 'contexto'; piezas: Set<string> } | null;
  explosion: number; // 0 a 1
  nivel: Nivel;
  base: Record<string, Vec3>; // desplazamiento por explosión
  separadas: Record<string, Vec3>;
  devueltas: Set<string>;
  armando: { total: string[] } | null;
  grupoActivo: string | null;
  centros: Record<string, Vec3>;
  cargado: boolean;
  camara: PedidoCamara | null;
  // Modo revisión (F24)
  revisor: string | null;
  respuestas: Record<string, Respuesta>;
  ubicando: string | null; // marcador o estructura esperando un toque en el modelo
  shift: boolean; // Shift presionado: los fantasmas se pueden sumar al aislamiento (F5)
  hoja: number; // alto (px) de la hoja inferior de la ficha en celular; 0 si no hay o es escritorio
  enfocarFicha: string | null; // entrada cuya ficha debe recibir el foco (búsqueda, árbol, relaciones)

  setAmbos(v: boolean): void;
  setCentros(c: Record<string, Vec3>): void;
  seleccionar(s: Partial<Seleccion> | null): void;
  deseleccionar(): void;
  alternarVisibles(piezas: string[], visibles: boolean): void;
  mostrarTodo(): void;
  activarGrupo(id: string | null, piezas?: string[]): void;
  aislarPiezas(piezas: string[], modo: 'solo' | 'contexto', sumarAlActual?: boolean): void;
  salirAislar(): void;
  setExplosion(f: number): void;
  setNivel(n: Nivel): void;
  separar(piezas: string[]): void;
  devolver(piezas: string[]): void;
  reensamblarTodo(): void;
  armarPiezaPorPieza(): void;
  terminarArmado(): void;
  pedirCamara(p: Omit<PedidoCamara, 't'>): void;
  setRevisor(codigo: string | null): void;
  responder(r: Respuesta): void;
  borrarRespuesta(clave: string): void;
  cargarRespuestas(r: Record<string, Respuesta>): void;
  setUbicando(id: string | null): void;
  setShift(v: boolean): void;
  setHoja(px: number): void;
  pedirFocoFicha(entrada: string | null): void;
}

/** Si hay algo que "Mostrar todo" deshacer: piezas ocultas, aislamiento o un grupo de estudio activo. */
export function hayFiltros(s: Pick<Estado, 'ocultas' | 'aislar' | 'grupoActivo'>): boolean {
  return s.ocultas.size > 0 || !!s.aislar || !!s.grupoActivo;
}

export function piezasVisibles(s: Pick<Estado, 'ocultas' | 'aislar'>): string[] {
  return todasLasPiezas.filter((p) => !s.ocultas.has(p) && (!s.aislar || s.aislar.piezas.has(p)));
}

function recalcularBase(s: Estado): Record<string, Vec3> {
  const visibles = piezasVisibles(s).filter((p) => nodos[p]?.clase === 'estudio');
  return desplazamientosExplosion(s.centros, visibles, (p) => bloqueDe(p, s.nivel), s.explosion);
}

/** Desplazamiento objetivo de una pieza (la animación se acerca a este valor). */
export function objetivo(s: Estado, pieza: string): Vec3 {
  if (s.devueltas.has(pieza)) return CERO;
  const b = s.base[pieza] ?? CERO;
  const sep = s.separadas[pieza];
  return sep ? sumar(b, sep) : b;
}

/** Piezas que están fuera de su sitio (para el contador de armado). */
export function fueraDeSitio(s: Estado, pieza: string): boolean {
  const o = objetivo(s, pieza);
  return o[0] !== 0 || o[1] !== 0 || o[2] !== 0;
}

export const useAtlas = create<Estado>((set, get) => ({
  ambos: false,
  ocultas: new Set(),
  seleccion: { entrada: null, pieza: null, malla: null },
  aislar: null,
  explosion: 0,
  nivel: 'piezas',
  base: {},
  separadas: {},
  devueltas: new Set(),
  armando: null,
  grupoActivo: null,
  centros: {},
  cargado: false,
  camara: null,
  revisor: null,
  respuestas: {},
  ubicando: null,
  shift: false,
  hoja: 0,
  enfocarFicha: null,

  setAmbos: (v) => set({ ambos: v }),
  setCentros: (c) => {
    set({ centros: c, cargado: true });
    set({ base: recalcularBase(get()) });
  },
  seleccionar: (s) =>
    set({ seleccion: s ? { entrada: null, pieza: null, malla: null, ...s } : { entrada: null, pieza: null, malla: null } }),
  // Sin selección no tiene sentido dejar el resto como fantasma ("aislar con contexto" lo puso al resaltar).
  deseleccionar: () => {
    set({ seleccion: { entrada: null, pieza: null, malla: null } });
    if (get().aislar?.modo === 'contexto') get().salirAislar();
  },
  alternarVisibles: (piezas, visibles) => {
    const ocultas = new Set(get().ocultas);
    for (const p of piezas) {
      if (visibles) ocultas.delete(p);
      else ocultas.add(p);
    }
    set({ ocultas, grupoActivo: null });
    set({ base: recalcularBase(get()) });
  },
  mostrarTodo: () => {
    set({ ocultas: new Set(), aislar: null, grupoActivo: null });
    set({ base: recalcularBase(get()) });
  },
  activarGrupo: (id, piezas) => {
    if (!id || !piezas) {
      set({ ocultas: new Set(), grupoActivo: null });
    } else {
      const dentro = new Set(piezas);
      set({ ocultas: new Set(todasLasPiezas.filter((p) => !dentro.has(p))), grupoActivo: id, aislar: null });
    }
    set({ base: recalcularBase(get()) });
  },
  aislarPiezas: (piezas, modo, sumarAlActual = false) => {
    const actual = get().aislar;
    const conjunto = new Set(sumarAlActual && actual ? actual.piezas : []);
    for (const p of piezas) conjunto.add(p);
    set({ aislar: { modo, piezas: conjunto } });
    set({ base: recalcularBase(get()) });
  },
  salirAislar: () => {
    set({ aislar: null });
    set({ base: recalcularBase(get()) });
  },
  setExplosion: (f) => {
    set({ explosion: Math.min(1, Math.max(0, f)), devueltas: new Set() });
    set({ base: recalcularBase(get()) });
  },
  setNivel: (n) => {
    set({ nivel: n });
    set({ base: recalcularBase(get()) });
  },
  separar: (piezas) => {
    const s = get();
    const visibles = piezasVisibles(s).filter((p) => nodos[p]?.clase === 'estudio');
    const conjunto = promedio(visibles.map((p) => s.centros[p]!).filter(Boolean));
    const centro = promedio(piezas.map((p) => s.centros[p]!).filter(Boolean));
    const d = desplazamientoSeparar(centro, conjunto);
    const separadas = { ...s.separadas };
    const devueltas = new Set(s.devueltas);
    for (const p of piezas) {
      separadas[p] = d;
      devueltas.delete(p);
    }
    set({ separadas, devueltas });
  },
  devolver: (piezas) => {
    const s = get();
    const separadas = { ...s.separadas };
    const devueltas = new Set(s.devueltas);
    for (const p of piezas) {
      delete separadas[p];
      if (s.base[p]) devueltas.add(p);
    }
    set({ separadas, devueltas });
  },
  reensamblarTodo: () => {
    set({ explosion: 0, separadas: {}, devueltas: new Set(), armando: null });
    set({ base: recalcularBase(get()) });
  },
  armarPiezaPorPieza: () => {
    const s = get();
    const total = piezasVisibles(s).filter((p) => fueraDeSitio(s, p));
    set({ armando: total.length ? { total } : null });
  },
  terminarArmado: () => set({ armando: null }),
  pedirCamara: (p) => set({ camara: { ...p, t: Date.now() + Math.random() } }),
  setRevisor: (codigo) => set({ revisor: codigo }),
  responder: (r) => set({ respuestas: { ...get().respuestas, [claveRespuesta(r)]: r } }),
  borrarRespuesta: (clave) => {
    const respuestas = { ...get().respuestas };
    delete respuestas[clave];
    set({ respuestas });
  },
  cargarRespuestas: (r) => set({ respuestas: r }),
  setUbicando: (id) => set({ ubicando: id }),
  setShift: (v) => {
    if (get().shift !== v) set({ shift: v });
  },
  setHoja: (px) => {
    if (get().hoja !== px) set({ hoja: px });
  },
  pedirFocoFicha: (entrada) => set({ enfocarFicha: entrada }),
}));

/** Piezas que resalta la selección actual. */
export function piezasSeleccionadas(s: Seleccion): string[] {
  if (!s.entrada) return [];
  return piezasDeEntrada(s.entrada);
}

export { piezasBajo };
