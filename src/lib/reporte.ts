// Reportar un error (F12, ADR 0016): funciones puras del reporte (enlace a GitHub y enlace de correo). Sin `window` ni `document`.
import type { TFunction } from 'i18next';
import { CORREO_REPORTES, MAX_DESCRIPCION, MAX_URL, PLANTILLA, TIPOS, URL_ISSUES, type TipoReporte } from '../config/reporte';
import { estructuras } from '../data/atlas';
import type { Idioma } from '../data/tipos';
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

/** Lo que el visitante reporta. `parte` es una de `partesDeFicha`; `version` es la `ficha.version` de la estructura. */
export interface Reporte {
  tipo: TipoReporte;
  estructura: string;
  nombre: string;
  idioma: Idioma;
  version: string;
  parte: string;
  descripcion: string;
}

/** Lanza si `r.tipo` no es uno de `TIPOS`. */
function exigirTipo(r: Reporte): void {
  // `includes` y no `in PLANTILLA`: 'constructor' y otros nombres heredados no son tipos.
  if (!(TIPOS as readonly string[]).includes(r.tipo)) throw new Error(`Tipo de reporte desconocido: ${String(r.tipo)}`);
}

/**
 * Enlace al formulario de issue de GitHub con el reporte ya llenado. Solo usa los campos de `r`: nunca lee la
 * ubicación de la página, así el código de un revisor docente (`?r=`/`#r=`) no sale en el enlace. El largo de la
 * descripción no se valida aquí (ver `descripcionValida`). Lanza si `r.tipo` no es uno de `TIPOS`.
 */
export function enlaceGithub(r: Reporte, t: TFunction): string {
  exigirTipo(r);
  const params = new URLSearchParams({
    template: PLANTILLA[r.tipo],
    title: `[${t(`reporte.tipo.${r.tipo}`)}] ${r.nombre} (${r.estructura})`,
    estructura: r.estructura,
    idioma: r.idioma,
    version: r.version,
    parte: r.parte,
    descripcion: r.descripcion,
  });
  return `${URL_ISSUES}?${params.toString()}`;
}

/**
 * Enlace `mailto:` al correo de reportes con el asunto y el cuerpo ya llenados, para cuando el enlace de GitHub no
 * cabe o el visitante no tiene cuenta. Solo usa los campos de `r`: nunca lee la ubicación de la página, así el código
 * de un revisor docente (`?r=`/`#r=`) no sale en el enlace. Usa `encodeURIComponent` y no `URLSearchParams`, que
 * escribe el espacio como `+` y muchos clientes de correo lo muestran tal cual. No corta el cuerpo ni valida el largo
 * de la descripción (ver `descripcionValida`). `escapeValue: false` evita que un `t` que escapa HTML cambie `&` o `"`.
 * Lanza si `r.tipo` no es uno de `TIPOS`.
 */
export function enlaceCorreo(r: Reporte, t: TFunction): string {
  exigirTipo(r);
  const interpolation = { escapeValue: false };
  const asunto = t('reporte.correo.asunto', {
    tipo: t(`reporte.tipo.${r.tipo}`, { interpolation }),
    id: r.estructura,
    idioma: r.idioma,
    version: r.version,
    interpolation,
  });
  const cuerpo = t('reporte.correo.cuerpo', {
    estructura: r.estructura,
    idioma: r.idioma,
    version: r.version,
    parte: r.parte,
    descripcion: r.descripcion,
    interpolation,
  });
  return `mailto:${CORREO_REPORTES}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/** El enlace de `enlaceGithub` mide `MAX_URL` o menos. Si no cabe, el visitante usa el correo. */
export function cabeEnGithub(r: Reporte, t: TFunction): boolean {
  return enlaceGithub(r, t).length <= MAX_URL;
}
