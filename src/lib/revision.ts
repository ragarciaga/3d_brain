// Modo revisión docente (F24): cada respuesta se refiere a una unidad revisable concreta.
export type Veredicto = 'correcto' | 'corregir' | 'no_es_mi_area';

export interface Respuesta {
  estructura: string; // id en estructuras.json
  campo: string; // 'pieza', 'nombre', 'latin', 'ubicacion', 'que_es', 'para_que_sirve', 'relaciones', 'relevancia.0', 'fuente.1', 'posicion', 'trazo.07' ...
  idioma?: 'es' | 'en';
  veredicto: Veredicto;
  propuesta?: string;
  comentario?: string;
  posicion?: [number, number, number]; // glTF, Y arriba (marcadores)
  malla?: string; // trazo del vago: nombre de la malla
  ramo?: string; // trazo del vago: id del marcador del ramo, 'no_es_ramo' o 'no_se'
  version: string; // versión del contenido revisado
  fecha: string;
}

export const claveRespuesta = (r: Pick<Respuesta, 'estructura' | 'campo' | 'idioma'>) =>
  `${r.estructura}|${r.campo}|${r.idioma ?? ''}`;

export interface ConfigFormulario {
  urlFormulario: string;
  campos: { codigo: string; estructura: string; revision: string };
}

/** Límite prudente de largo de URL para formularios de Google. */
export const MAX_URL = 7000;

export function formularioConfigurado(c: ConfigFormulario): boolean {
  return Boolean(c.urlFormulario && c.campos.codigo && c.campos.estructura && c.campos.revision);
}

/** Datos compactos de una revisión, listos para pegar o enviar. */
export function cargaRevision(codigo: string, estructura: string, respuestas: Respuesta[]): string {
  return JSON.stringify({ v: 1, revisor: codigo, estructura, respuestas });
}

/** URL prellenada del formulario, o null si no está configurado o la revisión es muy larga. */
export function urlFormulario(c: ConfigFormulario, codigo: string, estructura: string, respuestas: Respuesta[]): string | null {
  if (!formularioConfigurado(c)) return null;
  const p = new URLSearchParams({ usp: 'pp_url' });
  p.set(c.campos.codigo, codigo);
  p.set(c.campos.estructura, estructura);
  p.set(c.campos.revision, cargaRevision(codigo, estructura, respuestas));
  const url = `${c.urlFormulario}?${p.toString()}`;
  return url.length > MAX_URL ? null : url;
}

/** Respuestas cuya versión ya no coincide con la del contenido actual. */
export function desactualizadas(respuestas: Respuesta[], versionActual: (estructura: string) => string): Respuesta[] {
  return respuestas.filter((r) => r.version !== versionActual(r.estructura));
}
