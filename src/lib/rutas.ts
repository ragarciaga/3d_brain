// Rutas trazadas del vago (ADR 0009, SPEC F25). No vienen del cuerpo escaneado: las calcula
// pipeline/generar-ramas-vago.py sobre anclajes del modelo. Si el archivo trae rutas, se ven con su estado
// de revisión en la ficha y los docentes las juzgan en modo revisión (F24). En el lanzamiento docente no
// trae ninguna (Plan B, ADR 0010): trae `huecos`, los tramos del vago que se dejan sin trazar.
import type { Bilingue } from '../data/tipos';

export type P3 = [number, number, number];

/** Banda de alturas glTF (m) del tronco escaneado que reemplaza una ruta torácica. `y_min` nulo: hasta abajo (ADR 0010). */
export interface Reemplaza {
  lado: 'izquierdo' | 'derecho';
  y_max: number;
  y_min: number | null;
}

export interface RutaTrazada {
  id: string;
  nombre: Bilingue;
  lado: 'izquierdo' | 'derecho';
  entrada: string; // ficha que abre al tocarla y donde se revisa
  revision: { estado: 'en_revision' | 'aprobada'; revisado_por: string | null; fecha: string | null };
  radio: [number, number];
  puntos: P3[];
  reemplaza?: Reemplaza;
}

interface ArchivoRutas {
  rutas: Record<string, Omit<RutaTrazada, 'id'>>;
}

const esPunto = (p: unknown): p is P3 => Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const esReemplaza = (x: unknown): x is Reemplaza => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const b = x as Record<string, unknown>;
  return (
    (b.lado === 'izquierdo' || b.lado === 'derecho') &&
    esNumero(b.y_max) &&
    (b.y_min === null || (esNumero(b.y_min) && b.y_min < b.y_max))
  );
};

/** Valida lo que llega del archivo publicado: una ruta mal formada se descarta, no rompe la app. */
export function leerRutas(datos: unknown): RutaTrazada[] {
  const rutas = (datos as Partial<ArchivoRutas> | null)?.rutas;
  if (!rutas || typeof rutas !== 'object') return [];
  const res: RutaTrazada[] = [];
  for (const [id, r] of Object.entries(rutas)) {
    if (
      !r ||
      (r.lado !== 'izquierdo' && r.lado !== 'derecho') ||
      typeof r.entrada !== 'string' ||
      (r.revision?.estado !== 'en_revision' && r.revision?.estado !== 'aprobada') ||
      !Array.isArray(r.puntos) ||
      r.puntos.length < 2 ||
      !r.puntos.every(esPunto) ||
      !Array.isArray(r.radio) ||
      !r.radio.every((v) => typeof v === 'number' && v > 0)
    ) {
      continue;
    }
    if (r.reemplaza !== undefined && !esReemplaza(r.reemplaza)) continue;
    const { reemplaza, ...resto } = r;
    res.push(reemplaza ? { ...resto, id, reemplaza: { lado: reemplaza.lado, y_max: reemplaza.y_max, y_min: reemplaza.y_min } } : { ...resto, id });
  }
  return res;
}

/** Los huecos del archivo publicado (`huecos`): un hueco mal formado se descarta y solo se copian sus 3 claves. */
export function leerHuecos(datos: unknown): Reemplaza[] {
  const huecos = (datos as { huecos?: unknown } | null)?.huecos;
  if (!Array.isArray(huecos)) return [];
  return huecos.filter(esReemplaza).map((h) => ({ lado: h.lado, y_max: h.y_max, y_min: h.y_min }));
}

/** Descarga las rutas y los huecos publicados. Sin archivo, o con uno inválido, no hay ninguno. */
export async function cargarRutas(
  base: string,
  traer: typeof fetch = fetch,
): Promise<{ rutas: RutaTrazada[]; huecos: Reemplaza[] }> {
  try {
    const r = await traer(`${base}modelos/rutas-vago.json`);
    if (!r.ok) return { rutas: [], huecos: [] };
    const datos: unknown = await r.json();
    return { rutas: leerRutas(datos), huecos: leerHuecos(datos) };
  } catch {
    return { rutas: [], huecos: [] };
  }
}

/**
 * Campo de revisión (F24) del recorrido trazado de una ruta: uno por ruta (spec 02 R5.1). Los campos por
 * lado `trazado_derecho` y `trazado_izquierdo` quedan obsoletos: el importador los marca como desactualizados.
 */
export const campoTrazado = (r: Pick<RutaTrazada, 'id'>) => `trazado_${r.id}`;
