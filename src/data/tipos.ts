export type Idioma = 'es' | 'en';
export type Bilingue = Record<Idioma, string>;

export interface NodoArbol {
  id: string;
  tipo: 'grupo' | 'pieza';
  en: string; // nombre original en Z-Anatomy (llave con la fuente, no contenido)
  padre: string | null;
  hijos: string[];
  lado?: 'l' | 'r' | '';
  malla?: string;
  estructura?: string;
  clase?: 'estudio' | 'referencia';
  curva?: boolean;
  /** F25: sin el campo, la pieza viene del cuerpo escaneado; "aproximada" es un trazado sobre anclajes (ADR 0009). */
  origen?: 'aproximada';
}

export type OrigenGeometria = 'escaneada' | 'aproximada' | 'marcador';

export interface Arbol {
  fuente: string;
  raices: string[];
  nodos: Record<string, NodoArbol>;
}

export type EstadoRevision = 'borrador' | 'en_revision' | 'verificado';

export interface Fuente {
  cita: string;
  url?: string;
  verificada?: boolean; // false: la referencia aún no se abrió y confirmó contra el original
}

export interface Afirmacion {
  texto: Bilingue;
  evidencia: 'consenso' | 'moderada' | 'debatida';
  fuentes: Fuente[];
}

export interface Recurso {
  titulo: string;
  url: string;
  tipo: 'video' | 'articulo' | 'paper' | 'libro' | 'imagen';
  idioma: Idioma;
  nota: Bilingue;
}

export interface Ficha {
  version: string;
  ubicacion: Bilingue;
  que_es: Bilingue;
  para_que_sirve: Bilingue;
  relaciones: string[];
  relevancia: Afirmacion[];
  recursos: Recurso[];
  fuentes: Fuente[];
  revision: Record<Idioma, { estado: EstadoRevision; revisado_por: string | null; fecha: string | null }>;
}

export interface Estructura {
  id: string;
  tipo: 'estructura' | 'grupo' | 'marcador';
  nombre: Bilingue;
  latin: string;
  fuente_nombre: string;
  slug: Bilingue;
  sinonimos: Record<Idioma, string[]>;
  ficha: Ficha | null;
}

export interface Estructuras {
  version: string;
  licencia: string;
  estructuras: Record<string, Estructura>;
}

export type Punto3 = [number, number, number];

/** glTF, Y arriba; un punto, un punto por lado (`l`, `r`) o `null` = sin ubicar. */
export type PosicionMarcador = Punto3 | { l?: Punto3; r?: Punto3 } | null;

export interface Marcador {
  id: string; // llave en estructuras.json
  padre: string; // nodo del árbol donde se lista
  ancla: string | null; // pieza o estructura que el marcador sigue al separar; sin posición propia, su centro da la posición aproximada
  unir?: boolean; // un solo punto en el centro de todas las piezas del ancla (estructuras de la línea media)
  posicion: PosicionMarcador;
  estado: 'sin_ubicar' | 'aproximada' | 'validada';
  fuente_ubicacion: Bilingue; // vacío ("") si no hay fuente escrita
}

/** Qué tan firme es la propuesta de un trazo, según la medición (pipeline/reglas_vago.py). */
export type ConfianzaTrazo = 'alta' | 'media' | 'baja';

/**
 * Propuesta de la auditoría del modelo para un trazo del vago (docs/research/vago/auditoria-vago.md).
 * La escribe `scripts/aplicar-trazos.ts` a partir de la medición de `pipeline/auditar-vago.py`: es una
 * propuesta para revisión docente, no una asignación definitiva.
 */
export interface PropuestaTrazo {
  malla: string; // nombre de la malla, igual que en el GLB
  auditoria: string; // texto de la propuesta que da la regla
  propuesta: string | null; // id de marcador o 'no_es_ramo' cuando la regla propone una sola opción de la lista; null si no
  fuente: string; // clave de la bibliografía de docs/research/marcadores/fuentes.md (spec 04)
  evidencia?: Bilingue; // medidas del trazo, regla aplicada y razón de la confianza, en es y en
  confianza?: ConfianzaTrazo | null; // null cuando la regla no distingue entre ramos
}

export interface GrupoEstudio {
  id: string;
  nombre: Bilingue;
  descripcion: Bilingue;
  miembros: string[]; // ids de nodos del árbol (grupos o piezas) o de estructuras
  fuentes: Fuente[];
  estado: EstadoRevision;
}
