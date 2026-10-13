// Rutas trazadas del vago (ADR 0009, SPEC F25). No vienen del cuerpo escaneado: las calcula
// pipeline/generar-ramas-vago.py sobre anclajes del modelo. Mientras una ruta está en revisión solo la
// ven los revisores (F24); con la aprobación la ve todo el mundo.
import type { Bilingue } from '../data/tipos';

export type P3 = [number, number, number];

export interface RutaTrazada {
  id: string;
  nombre: Bilingue;
  lado: 'izquierdo' | 'derecho';
  entrada: string; // ficha que abre al tocarla y donde se revisa
  revision: { estado: 'en_revision' | 'aprobada'; revisado_por: string | null; fecha: string | null };
  radio: [number, number];
  puntos: P3[];
}

interface ArchivoRutas {
  rutas: Record<string, Omit<RutaTrazada, 'id'>>;
}

const esPunto = (p: unknown): p is P3 => Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

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
    res.push({ ...r, id });
  }
  return res;
}

/** Descarga las rutas publicadas. Sin archivo, o con uno inválido, no hay rutas. */
export async function cargarRutas(base: string, traer: typeof fetch = fetch): Promise<RutaTrazada[]> {
  try {
    const r = await traer(`${base}modelos/rutas-vago.json`);
    if (!r.ok) return [];
    return leerRutas(await r.json());
  } catch {
    return [];
  }
}

/** Una ruta en revisión solo la ve quien está en modo revisión. */
export function rutaVisible(r: RutaTrazada, revisor: boolean): boolean {
  return r.revision.estado === 'aprobada' || revisor;
}

/** Campo de revisión (F24) del recorrido trazado de una ruta: uno por lado en la ficha. */
export const campoTrazado = (r: Pick<RutaTrazada, 'lado'>) => `trazado_${r.lado}`;
