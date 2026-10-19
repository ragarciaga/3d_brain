// Reportar un error (F12, ADR 0016): funciones puras del reporte. Sin `window` ni `document`.
import { MAX_DESCRIPCION } from '../config/reporte';
import { estructuras } from '../data/atlas';
import { camposDeFicha } from './prioridad';

// Campos que `camposDeFicha` no debería producir para un reporte: dudas abiertas, posición del marcador y trazos.
const EXCLUIDOS = /^duda\.\d+$|^posicion$|^trazo:/;

/**
 * Partes de una ficha que el visitante puede señalar en un reporte: `general` primero, luego los campos únicos
 * de `camposDeFicha` (sin idioma), y `recursos` al final si la ficha tiene recursos propios. Sin ficha, solo
 * `general` y `nombre`. El vocabulario es el mismo de la revisión docente (F24), por eso se deriva de
 * `camposDeFicha` y no se repite aquí (R7.1).
 */
export function partesDeFicha(id: string): string[] {
  const f = estructuras[id]?.ficha;
  if (!f) return ['general', 'nombre'];
  // La clave es `${id}|${campo}|${idioma}`: se quita el id del inicio y el idioma del final sin partir el id.
  const campos = camposDeFicha(id, 'es').map((clave) => clave.slice(id.length + 1, clave.lastIndexOf('|')));
  const unicos = [...new Set(campos.filter((c) => !EXCLUIDOS.test(c)))];
  return ['general', ...unicos, ...(f.recursos.length > 0 ? ['recursos'] : [])];
}

/** La descripción tiene al menos un carácter que no es espacio y cabe en `MAX_DESCRIPCION` (largo del texto crudo). */
export function descripcionValida(texto: string): boolean {
  return texto.trim().length > 0 && texto.length <= MAX_DESCRIPCION;
}
