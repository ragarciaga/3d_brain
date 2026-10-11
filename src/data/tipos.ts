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
}

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

export interface Marcador {
  id: string; // llave en estructuras.json
  padre: string; // nodo del árbol donde se lista
  ancla: string | null; // pieza o estructura cuyo centro da la posición aproximada
  posicion: [number, number, number] | null; // glTF, Y arriba; null = sin ubicar
  estado: 'sin_ubicar' | 'aproximada' | 'validada';
  fuente_ubicacion: Bilingue; // vacío ("") si no hay fuente escrita
}

export interface GrupoEstudio {
  id: string;
  nombre: Bilingue;
  descripcion: Bilingue;
  miembros: string[]; // ids de nodos del árbol (grupos o piezas) o de estructuras
  fuentes: Fuente[];
  estado: EstadoRevision;
}
