// Lógica pura del aplicador de propuestas de marcadores (spec 04, T3). Sin lectura ni escritura de
// archivos: eso lo hace scripts/aplicar-marcadores.ts. Solo se importan tipos de src/data/tipos.ts;
// src/data/atlas.ts no se puede importar desde Node porque importa JSON sin atributo y './tipos' sin extensión.
import type { Bilingue, Marcador, PosicionMarcador, Punto3 } from '../../src/data/tipos.ts';

/** Una propuesta tal como la emite `ubicar()` de pipeline/ubicar-marcadores.py. */
export interface Propuesta {
  id: string;
  posicion: PosicionMarcador;
  estado: 'aproximada' | 'sin_ubicar';
  metodo: Bilingue;
  cita: Bilingue;
  motivo?: string;
  ancla?: string;
  desacuerdo?: Bilingue;
}

const CLAVES_PROPUESTA = ['id', 'posicion', 'estado', 'metodo', 'cita', 'motivo', 'ancla', 'desacuerdo'];

export const RUTAS_POR_DEFECTO = {
  propuestas: 'pipeline/salida/marcadores-propuestos.json',
  marcadores: 'src/data/marcadores.json',
  resumen: 'docs/research/marcadores/resumen-propuestas.md',
};

function esPunto3(v: unknown): v is Punto3 {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

// Copia de `posicionValida` (src/data/atlas.ts), que no se puede importar desde Node; la prueba de paridad las mantiene iguales.
export function posicionPropuestaValida(v: unknown): v is PosicionMarcador {
  if (v === null || esPunto3(v)) return true;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const claves = Object.keys(v);
  return claves.length > 0 && claves.every((k) => (k === 'l' || k === 'r') && esPunto3((v as Record<string, unknown>)[k]));
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function esBilingue(v: unknown): v is Bilingue {
  return esObjeto(v) && typeof v['es'] === 'string' && typeof v['en'] === 'string';
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Valida la lista completa de propuestas antes de aplicar nada. Lanza un Error con "<id>: <problema>"
 * ante el primer problema, o con un mensaje general si la entrada no es una lista.
 */
export function validarPropuestas(datos: unknown, marcadores: readonly Marcador[]): Propuesta[] {
  if (!Array.isArray(datos)) throw new Error('la entrada no es una lista de propuestas');
  const conocidos = new Set(marcadores.map((m) => m.id));
  const vistos = new Set<string>();
  const salida: Propuesta[] = [];
  datos.forEach((p: unknown, i: number) => {
    if (!esObjeto(p)) throw new Error(`propuesta ${i + 1}: no es un objeto`);
    const id = p['id'];
    if (!textoNoVacio(id)) throw new Error(`propuesta ${i + 1}: falta el id`);
    for (const k of Object.keys(p)) {
      if (!CLAVES_PROPUESTA.includes(k)) throw new Error(`${id}: clave desconocida "${k}"`);
    }
    if (!conocidos.has(id)) throw new Error(`${id}: id desconocido, no está en marcadores.json`);
    if (vistos.has(id)) throw new Error(`${id}: id repetido en las propuestas`);
    vistos.add(id);
    const posicion = p['posicion'];
    if (!posicionPropuestaValida(posicion)) throw new Error(`${id}: posición mal formada: ${JSON.stringify(posicion) ?? 'undefined'}`);
    const estadoEsperado = posicion !== null ? 'aproximada' : 'sin_ubicar';
    if (p['estado'] !== estadoEsperado) {
      throw new Error(`${id}: estado ${JSON.stringify(p['estado'])} no corresponde a la posición (se esperaba "${estadoEsperado}")`);
    }
    const metodo = p['metodo'];
    const cita = p['cita'];
    if (!esBilingue(metodo)) throw new Error(`${id}: metodo debe ser { es, en } de texto`);
    if (!esBilingue(cita)) throw new Error(`${id}: cita debe ser { es, en } de texto`);
    if (posicion !== null) {
      if (![metodo.es, metodo.en, cita.es, cita.en].every(textoNoVacio)) {
        throw new Error(`${id}: con posición, metodo y cita deben traer texto en es y en`);
      }
    } else if (!textoNoVacio(p['motivo'])) {
      throw new Error(`${id}: sin posición, falta el motivo`);
    }
    if (p['motivo'] !== undefined && typeof p['motivo'] !== 'string') throw new Error(`${id}: motivo debe ser texto`);
    if (p['ancla'] !== undefined && !textoNoVacio(p['ancla'])) throw new Error(`${id}: ancla debe ser texto no vacío`);
    const desacuerdo = p['desacuerdo'];
    if (desacuerdo !== undefined && !(esBilingue(desacuerdo) && textoNoVacio(desacuerdo.es) && textoNoVacio(desacuerdo.en))) {
      throw new Error(`${id}: desacuerdo debe ser { es, en } con texto en los dos idiomas`);
    }
    salida.push(p as unknown as Propuesta);
  });
  return salida;
}

/** `fuente_ubicacion` de un marcador con posición propuesta: método, cita y, si lo hay, el desacuerdo de fuentes. */
export function fuenteDeUbicacion(p: Propuesta): Bilingue {
  let es = `${p.metodo.es.trim()} Fuente: ${p.cita.es.trim()}`;
  let en = `${p.metodo.en.trim()} Source: ${p.cita.en.trim()}`;
  if (p.desacuerdo) {
    es += ` Las fuentes no coinciden: ${p.desacuerdo.es.trim()}`;
    en += ` Sources disagree: ${p.desacuerdo.en.trim()}`;
  }
  return { es, en };
}

function textoPosicion(pos: PosicionMarcador): string {
  return pos === null ? 'sin posición' : JSON.stringify(pos);
}

function descripcion(m: Marcador): string {
  const ancla = m.ancla ? `\`${m.ancla}\`` : 'ninguna';
  return `${m.estado}; posición ${textoPosicion(m.posicion)}; ancla ${ancla}`;
}

/**
 * Lleva las propuestas a los marcadores. Pura: no muta la entrada. Solo cambian `posicion`, `estado`
 * (a `aproximada`), `fuente_ubicacion` y `ancla` (si la propuesta la trae). Un marcador `validada` no se
 * toca, y una propuesta sin posición tampoco quita nada. Devuelve también el resumen en Markdown.
 */
export function aplicarPropuestas(
  marcadores: Marcador[],
  propuestas: Propuesta[],
): { marcadores: Marcador[]; resumen: string } {
  const validas = validarPropuestas(propuestas as unknown, marcadores);
  const porId = new Map(validas.map((p) => [p.id, p]));
  const secciones: string[] = [];
  const salida = marcadores.map((m): Marcador => {
    const p = porId.get(m.id);
    let nuevo: Marcador = structuredClone(m);
    let motivo: string | null = null;
    if (!p) {
      motivo = 'no hay propuesta para este marcador';
    } else if (m.estado === 'validada') {
      motivo = 'se omitió la propuesta: el marcador es validada y solo un docente cambia su posición';
    } else if (p.posicion !== null) {
      nuevo = {
        ...nuevo,
        posicion: structuredClone(p.posicion),
        estado: 'aproximada',
        fuente_ubicacion: fuenteDeUbicacion(p),
        ...(p.ancla ? { ancla: p.ancla } : {}),
      };
    } else if (m.estado === 'aproximada') {
      motivo = `la propuesta no trae posición (${p.motivo}); se conserva la ubicación aproximada actual`;
    } else {
      motivo = `sin posición: ${p.motivo}`;
    }
    const lineas = [
      `## ${m.id}`,
      '',
      `- Resultado: ${motivo === null ? 'actualizado' : 'sin cambios'}`,
      `- Antes: ${descripcion(m)}`,
      `- Después: ${descripcion(nuevo)}`,
      `- Regla: ${p ? p.metodo.es : 'sin propuesta'}`,
      `- Fuente: ${p ? p.cita.es.trim() || 'sin fuente' : 'sin propuesta'}`,
    ];
    if (p?.desacuerdo) lineas.push(`- Desacuerdo: ${p.desacuerdo.es}`);
    if (motivo !== null) lineas.push(`- Motivo: ${motivo}`);
    secciones.push(lineas.join('\n'));
    return nuevo;
  });
  const cabecera = [
    '# Resumen de las propuestas de marcadores',
    '',
    'Lo escribe `node scripts/aplicar-marcadores.ts` a partir de las propuestas de `pipeline/ubicar-marcadores.py`. Toda posición propuesta queda `aproximada` hasta que un docente la revise (ADR 0013).',
  ].join('\n');
  return { marcadores: salida, resumen: `${cabecera}\n\n${secciones.join('\n\n')}\n` };
}

/** Texto de `marcadores.json`: sangría de 1 espacio y un solo salto final, igual que el archivo actual. */
export function serializarMarcadores(m: Marcador[]): string {
  return `${JSON.stringify(m, null, 1)}\n`;
}

/**
 * Argumentos del CLI: `[--propuestas <ruta>] [--marcadores <ruta>] [--resumen <ruta>]`, cada una una sola vez.
 * Devuelve null ante un uso indebido: bandera desconocida, sin valor, repetida, o un argumento suelto.
 */
export function argumentosAplicar(args: string[]): { propuestas: string; marcadores: string; resumen: string } | null {
  const rutas = { ...RUTAS_POR_DEFECTO };
  const puestas = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a !== '--propuestas' && a !== '--marcadores' && a !== '--resumen') return null;
    const valor = args[i + 1];
    const clave = a.slice(2) as keyof typeof rutas;
    if (puestas.has(clave) || !valor || valor.startsWith('--')) return null;
    puestas.add(clave);
    rutas[clave] = valor;
    i++;
  }
  return rutas;
}
