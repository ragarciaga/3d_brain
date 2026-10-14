// Estado de la app. La posición original de las piezas no vive aquí ni se modifica nunca:
// aquí solo hay desplazamientos, visibilidad, selección y modos.
import { create } from 'zustand';
import { esFragmentable, nodos, piezaDeMalla, piezasBajo, piezasDeEntrada, todasLasPiezas } from '../data/atlas';
import {
  CERO,
  desplazamientoSeparar,
  promedio,
  sumar,
  type Lado,
  type Nivel,
  type Vec3,
} from '../lib/explosion';
import {
  ajustarAlRango,
  cortesApagados,
  hayCortes,
  piezasEncefalo,
  rangoCerebro,
  type Corte,
  type Cortes,
  type Plano,
} from '../lib/cortes';
import { VERSION_AUTORIZACION } from '../config/revision';
import { autorizar, ErrorCanal, type Autorizacion } from '../lib/canal';
import type { Vista } from '../lib/enlaces';
import { desplazamientosDeslizador, INICIO_INVENTARIO, usaInventario, type Caja } from '../lib/inventario';
import { encuadreDeParada, paradasVago, piezasDelRecorrido } from '../lib/recorrido';
import type { RutaTrazada } from '../lib/rutas';
import { fusionarRespuestas, piezasQueSiguen } from '../lib/respaldo';
import { claveRespuesta, type Respuesta } from '../lib/revision';
import { ENTRADA_VAGO } from '../lib/trazos';

/**
 * Estado de la lectura inicial del canal. `inactivo`: el canal respondió `codigo_no_activo` a `leer`, `autorizar`
 * o `guardar` para el revisor actual; con ese valor no se guarda nada en el canal.
 */
export type LecturaCanal = 'pendiente' | 'hecha' | 'fallida' | 'inactivo';

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

/** Grupo que comparte fila en el inventario (F6): el lóbulo, sin importar el lado. */
export function grupoInventario(pieza: string): string {
  return ancestroBloque(pieza);
}

/** Lado anatómico de una pieza; sin lado (o vacío) cuenta como medio. */
export function ladoDe(pieza: string): Lado {
  const l = nodos[pieza]?.lado;
  return l === 'l' || l === 'r' ? l : 'medio';
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
  malla: string | null; // malla tocada o abierta desde 'Qué revisar' (trazos del vago en modo revisión)
}

export interface PedidoCamara {
  vista?: Vista;
  camara?: number[];
  encuadrar?: string[]; // piezas
  malla?: string; // una malla (trazo del vago): se encuadra su caja, no la de la pieza
  t: number;
}

interface Estado {
  ocultas: Set<string>;
  seleccion: Seleccion;
  aislar: { modo: 'solo' | 'contexto'; piezas: Set<string> } | null;
  explosion: number; // 0 a 1
  nivel: Nivel;
  base: Record<string, Vec3>; // desplazamiento por explosión
  inventario: boolean; // el deslizador está en el tramo del inventario (más del 70 % y bloques suficientes)
  separadas: Record<string, Vec3>;
  devueltas: Set<string>;
  grupoActivo: string | null;
  centros: Record<string, Vec3>;
  cajas: Record<string, Caja>; // caja original de cada pieza, para el inventario
  cargado: boolean;
  camara: PedidoCamara | null;
  // Modo revisión (F24)
  revisor: string | null;
  autorizacion: Autorizacion | null; // vigente para el revisor actual; null es "falta autorizar o no se sabe"
  lecturaCanal: LecturaCanal; // estado del canal para el revisor actual: la lectura inicial `leer`, y `inactivo` también por `autorizar` o `guardar`
  respuestas: Record<string, Respuesta>;
  piezaPropuesta: Record<string, string>; // estructura -> id de la pieza tocada al proponer su posición; solo en esta sesión, no se envía
  dialogoRevision: boolean; // hay un diálogo de revisión abierto; Escape lo cierra (después de la confirmación de salida)
  cargaRespuestas: number; // sube cada vez que se cargan las respuestas guardadas; la ficha remonta sus controles
  ubicando: string | null; // marcador o estructura esperando un toque en el modelo
  shift: boolean; // Shift presionado: los fantasmas se pueden sumar al aislamiento (F5)
  hoja: number; // alto (px) de la hoja inferior de la ficha en celular; 0 si no hay o es escritorio
  enfocarFicha: string | null; // entrada cuya ficha debe recibir el foco (búsqueda, árbol, relaciones)
  recorrido: number | null; // parada actual del recorrido del vago (F14); null fuera del recorrido
  soloEscaneada: boolean; // F25: esconder la geometría trazada
  rutas: RutaTrazada[]; // rutas trazadas del vago (ADR 0009), cargadas de public/modelos/rutas-vago.json
  trazos: string[]; // mallas de trazo del GLB cargado, en orden (src/lib/trazos.ts); [] hasta que carga el modelo
  panelRecorrido: number; // alto (px) del panel del recorrido cuando tapa la parte de abajo del visor (celular)
  cortes: Cortes; // planos de corte (F8); mm desde el centro de la caja del encéfalo
  fantasmaCorte: boolean; // la parte cortada se ve como fantasma
  rellenoApagado: boolean; // el relleno de la sección se apaga una vez por sesión (R8.2, R3.4)

  setCorte(plano: Plano, cambios: Partial<Corte>): void;
  quitarCortes(): void;
  setFantasmaCorte(v: boolean): void;
  apagarRelleno(): void;
  setCentros(c: Record<string, Vec3>, cajas?: Record<string, Caja>): void;
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
  pedirCamara(p: Omit<PedidoCamara, 't'>): void;
  setRevisor(codigo: string | null): void;
  setAutorizacion(a: Autorizacion | null): void;
  setLecturaCanal(l: LecturaCanal): void;
  /**
   * Registra en el canal si el revisor puede revisar el vago; la autorización solo cambia si el canal confirma.
   * Falla con ErrorCanal; ante `codigo_no_activo`, además marca `lecturaCanal: 'inactivo'`.
   */
  cambiarAutorizacion(vago: boolean): Promise<void>;
  responder(r: Respuesta): void;
  borrarRespuesta(clave: string): void;
  cargarRespuestas(r: Record<string, Respuesta>, piezas?: Record<string, string>): void;
  importarRespuestas(nuevas: Respuesta[]): { agregadas: number; actualizadas: number; sinCambio: number };
  proponerPosicion(r: Respuesta, pieza: string): void;
  deshacerPosicion(estructura: string): void;
  setDialogoRevision(v: boolean): void;
  setUbicando(id: string | null): void;
  setShift(v: boolean): void;
  setHoja(px: number): void;
  pedirFocoFicha(entrada: string | null): void;
  iniciarRecorrido(): void;
  irAParada(i: number): void;
  salirRecorrido(): void;
  setPanelRecorrido(px: number): void;
  setSoloEscaneada(v: boolean): void;
  setRutas(r: RutaTrazada[]): void;
  setTrazos(l: string[]): void;
  abrirTrazo(malla: string): void;
}

/** Si hay algo que "Mostrar todo" deshacer: piezas ocultas, aislamiento o un grupo de estudio activo. */
export function hayFiltros(s: Pick<Estado, 'ocultas' | 'aislar' | 'grupoActivo'>): boolean {
  return s.ocultas.size > 0 || !!s.aislar || !!s.grupoActivo;
}

export function piezasVisibles(s: Pick<Estado, 'ocultas' | 'aislar'>): string[] {
  return todasLasPiezas.filter((p) => !s.ocultas.has(p) && (!s.aislar || s.aislar.piezas.has(p)));
}

/** Piezas sobre las que se encuadra la cámara: las de estudio visibles del encéfalo; si no hay, las de estudio visibles. */
export function piezasDeEncuadre(s: Pick<Estado, 'ocultas' | 'aislar'>): string[] {
  const visibles = piezasVisibles(s).filter((p) => nodos[p]?.clase === 'estudio');
  const encefalo = new Set(piezasBajo('g-brain'));
  const foco = visibles.filter((p) => encefalo.has(p));
  return foco.length ? foco : visibles;
}

/** Desplazamientos de explosión y si el deslizador está en el tramo del inventario (F6). */
function recalcularBase(s: Estado): Pick<Estado, 'base' | 'inventario'> {
  // El vago no se fragmenta: ni se mueve ni cuenta para el centro del conjunto (F6).
  const visibles = piezasVisibles(s).filter((p) => nodos[p]?.clase === 'estudio' && esFragmentable(p));
  const bloque = (p: string) => bloqueDe(p, s.nivel);
  return {
    base: desplazamientosDeslizador(s.centros, s.cajas, visibles, bloque, grupoInventario, s.explosion, ladoDe),
    inventario: s.explosion > INICIO_INVENTARIO && usaInventario(s.centros, visibles, bloque),
  };
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
  ocultas: new Set(),
  seleccion: { entrada: null, pieza: null, malla: null },
  aislar: null,
  explosion: 0,
  nivel: 'piezas',
  base: {},
  inventario: false,
  separadas: {},
  devueltas: new Set(),
  grupoActivo: null,
  centros: {},
  cajas: {},
  cargado: false,
  camara: null,
  revisor: null,
  autorizacion: null,
  lecturaCanal: 'pendiente',
  respuestas: {},
  piezaPropuesta: {},
  dialogoRevision: false,
  cargaRespuestas: 0,
  ubicando: null,
  shift: false,
  hoja: 0,
  enfocarFicha: null,
  recorrido: null,
  panelRecorrido: 0,
  soloEscaneada: false,
  rutas: [],
  trazos: [],
  cortes: cortesApagados(),
  fantasmaCorte: false,
  rellenoApagado: false,

  // Antes de cargar el modelo `cajas` es `{}` y todo `mm` se ajusta a 0 (el botón está deshabilitado sin
  // modelo, R6.6; el enlace aplica `corte=` después de cargar).
  setCorte: (plano, cambios) => {
    const s = get();
    const previo = s.cortes[plano];
    const siguiente: Corte = { ...previo, ...cambios };
    if (cambios.activo === true && !previo.activo && cambios.mm === undefined) siguiente.mm = 0;
    if (!Number.isFinite(siguiente.mm)) siguiente.mm = previo.mm;
    siguiente.mm = ajustarAlRango(plano, siguiente.mm, rangoCerebro(s.cajas, piezasEncefalo));
    const cortes: Cortes = { ...s.cortes, [plano]: siguiente };
    if (!hayCortes(s.cortes) && hayCortes(cortes)) {
      // Cortar arma el cerebro: en una sola notificación sin explosión, sin separadas y sin inventario.
      const devueltas = new Set<string>();
      const armado: Estado = { ...s, cortes, explosion: 0, separadas: {}, devueltas };
      set({ cortes, explosion: 0, separadas: {}, devueltas, ...recalcularBase(armado) });
    } else {
      set({ cortes });
    }
  },
  quitarCortes: () => set({ cortes: cortesApagados() }),
  setFantasmaCorte: (v) => {
    if (get().fantasmaCorte !== v) set({ fantasmaCorte: v });
  },
  apagarRelleno: () => {
    if (!get().rellenoApagado) set({ rellenoApagado: true });
  },

  setCentros: (c, cajas = {}) => {
    set({ centros: c, cajas, cargado: true });
    set(recalcularBase(get()));
  },
  seleccionar: (s) =>
    set({ seleccion: s ? { entrada: null, pieza: null, malla: null, ...s } : { entrada: null, pieza: null, malla: null } }),
  // Sin selección no tiene sentido dejar el resto como fantasma ("aislar con contexto" lo puso al resaltar).
  deseleccionar: () => {
    set({ seleccion: { entrada: null, pieza: null, malla: null } });
    // En el recorrido el fantasma es del recorrido, no de la selección: se queda.
    if (get().aislar?.modo === 'contexto' && get().recorrido === null) get().salirAislar();
  },
  alternarVisibles: (piezas, visibles) => {
    const ocultas = new Set(get().ocultas);
    for (const p of piezas) {
      if (visibles) ocultas.delete(p);
      else ocultas.add(p);
    }
    set({ ocultas, grupoActivo: null });
    set(recalcularBase(get()));
  },
  mostrarTodo: () => {
    set({ ocultas: new Set(), aislar: null, grupoActivo: null, recorrido: null });
    set(recalcularBase(get()));
  },
  activarGrupo: (id, piezas) => {
    if (!id || !piezas) {
      set({ ocultas: new Set(), grupoActivo: null });
    } else {
      const dentro = new Set(piezas);
      set({ ocultas: new Set(todasLasPiezas.filter((p) => !dentro.has(p))), grupoActivo: id, aislar: null });
    }
    set(recalcularBase(get()));
  },
  aislarPiezas: (piezas, modo, sumarAlActual = false) => {
    const actual = get().aislar;
    const conjunto = new Set(sumarAlActual && actual ? actual.piezas : []);
    for (const p of piezas) conjunto.add(p);
    set({ aislar: { modo, piezas: conjunto } });
    set(recalcularBase(get()));
  },
  // Salir del aislamiento (Escape, "Mostrar todo", el botón de la ficha) también termina el recorrido.
  salirAislar: () => {
    set({ aislar: null, recorrido: null });
    set(recalcularBase(get()));
  },
  setExplosion: (f) => {
    // Cortar arma el cerebro: sin explosión ni inventario mientras haya cortes (F8, R2.3).
    if (hayCortes(get().cortes)) return;
    set({ explosion: Math.min(1, Math.max(0, f)), devueltas: new Set() });
    set(recalcularBase(get()));
  },
  setNivel: (n) => {
    set({ nivel: n });
    set(recalcularBase(get()));
  },
  separar: (piezas) => {
    const s = get();
    if (hayCortes(s.cortes)) return;
    // Conjunto armado: las piezas de estudio que se dibujan (misma condición que `visible` en Visor.tsx,
    // donde "aislar con contexto" deja las demás como fantasma pero sí dibujadas).
    const dibujadas = todasLasPiezas.filter(
      (p) =>
        nodos[p]?.clase === 'estudio' &&
        esFragmentable(p) &&
        !s.ocultas.has(p) &&
        (!s.aislar || s.aislar.modo === 'contexto' || s.aislar.piezas.has(p)),
    );
    const conjunto = promedio(dibujadas.map((p) => s.centros[p]!).filter(Boolean));
    const separadas = { ...s.separadas };
    const devueltas = new Set(s.devueltas);
    for (const p of piezas) {
      const centro = s.centros[p];
      if (!centro || !esFragmentable(p)) continue;
      separadas[p] = desplazamientoSeparar(centro, conjunto, ladoDe(p));
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
    set({ explosion: 0, separadas: {}, devueltas: new Set() });
    set(recalcularBase(get()));
  },
  pedirCamara: (p) => set({ camara: { ...p, t: Date.now() + Math.random() } }),
  // Otro código es otro revisor: su autorización y su lectura del canal se vuelven a obtener.
  setRevisor: (codigo) => {
    if (codigo === get().revisor) return;
    set({ revisor: codigo, autorizacion: null, lecturaCanal: 'pendiente' });
  },
  setAutorizacion: (a) => set({ autorizacion: a }),
  setLecturaCanal: (l) => set({ lecturaCanal: l }),
  // El diálogo de autorización la usa al aceptar; T10 la usará para cambiar `vago` desde Acciones.
  cambiarAutorizacion: async (vago) => {
    const codigo = get().revisor;
    if (!codigo) throw new ErrorCanal('red');
    try {
      await autorizar(codigo, { version: VERSION_AUTORIZACION, vago });
    } catch (e) {
      // Un código que el canal no tiene activo no guarda nada: el panel lo muestra y la cola no envía.
      if (e instanceof ErrorCanal && e.tipo === 'codigo_no_activo' && get().revisor === codigo) set({ lecturaCanal: 'inactivo' });
      throw e;
    }
    if (get().revisor === codigo) set({ autorizacion: { version: VERSION_AUTORIZACION, vago } });
  },
  responder: (r) => set({ respuestas: { ...get().respuestas, [claveRespuesta(r)]: r } }),
  borrarRespuesta: (clave) => {
    const respuestas = { ...get().respuestas };
    delete respuestas[clave];
    set({ respuestas });
  },
  // Sin `piezas` se olvidan las piezas tocadas (#61); importar un respaldo pasa las que siguen valiendo.
  cargarRespuestas: (r, piezas = {}) => set({ respuestas: r, piezaPropuesta: piezas, cargaRespuestas: get().cargaRespuestas + 1 }),
  // Respaldo (#60): se fusiona con lo local; solo si algo cambia se recarga, y se conservan las piezas de los marcadores que no cambiaron.
  importarRespuestas: (nuevas) => {
    const { respuestas, piezaPropuesta } = get();
    const { respuestas: fusion, ...conteo } = fusionarRespuestas(respuestas, nuevas);
    if (conteo.agregadas + conteo.actualizadas > 0) get().cargarRespuestas(fusion, piezasQueSiguen(piezaPropuesta, respuestas, fusion));
    return conteo;
  },
  proponerPosicion: (r, pieza) =>
    set({
      respuestas: { ...get().respuestas, [claveRespuesta(r)]: r },
      piezaPropuesta: { ...get().piezaPropuesta, [r.estructura]: pieza },
      ubicando: null,
    }),
  deshacerPosicion: (estructura) => {
    const respuestas = { ...get().respuestas };
    delete respuestas[claveRespuesta({ estructura, campo: 'posicion' })];
    const piezaPropuesta = { ...get().piezaPropuesta };
    delete piezaPropuesta[estructura];
    set({ respuestas, piezaPropuesta, ubicando: estructura });
  },
  setDialogoRevision: (v) => {
    if (get().dialogoRevision !== v) set({ dialogoRevision: v });
  },
  setUbicando: (id) => set({ ubicando: id }),
  setShift: (v) => {
    if (get().shift !== v) set({ shift: v });
  },
  setHoja: (px) => {
    if (get().hoja !== px) set({ hoja: px });
  },
  pedirFocoFicha: (entrada) => set({ enfocarFicha: entrada }),
  // El recorrido arma el conjunto (el vago no se ve en el inventario), deja nítido lo que recorre y
  // el resto como fantasma, y encuadra la primera parada.
  iniciarRecorrido: () => {
    set({ explosion: 0, separadas: {}, devueltas: new Set(), ocultas: new Set(), grupoActivo: null });
    set({ aislar: { modo: 'contexto', piezas: new Set(piezasDelRecorrido()) } });
    set(recalcularBase(get()));
    get().irAParada(0);
  },
  irAParada: (i) => {
    const n = Math.min(paradasVago.length - 1, Math.max(0, i));
    set({ recorrido: n });
    get().pedirCamara({ encuadrar: encuadreDeParada(paradasVago[n]!) });
  },
  salirRecorrido: () => {
    if (get().recorrido === null) return;
    set({ recorrido: null, aislar: null });
    set(recalcularBase(get()));
  },
  setSoloEscaneada: (v) => set({ soloEscaneada: v }),
  setRutas: (r) => set({ rutas: r }),
  setTrazos: (l) => {
    if (get().trazos.join('\n') !== l.join('\n')) set({ trazos: l });
  },
  // Abre un trazo como si se hubiera tocado en el visor: lo selecciona (queda resaltado), deja el vago en
  // contexto (salvo en el recorrido, donde el fantasma es del recorrido) y pide encuadrar su malla.
  abrirTrazo: (malla) => {
    const pieza = piezaDeMalla(malla);
    if (!pieza) return;
    get().seleccionar({ entrada: nodos[pieza]?.estructura ?? null, pieza, malla });
    if (get().recorrido === null) get().aislarPiezas(piezasDeEntrada(ENTRADA_VAGO), 'contexto');
    get().pedirCamara({ malla });
  },
  setPanelRecorrido: (px) => {
    if (get().panelRecorrido !== px) set({ panelRecorrido: px });
  },
}));

/** Piezas que resalta la selección actual. */
export function piezasSeleccionadas(s: Seleccion): string[] {
  if (!s.entrada) return [];
  return piezasDeEntrada(s.entrada);
}

export { piezasBajo };
