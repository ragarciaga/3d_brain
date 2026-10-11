// Convierte las respuestas del formulario de Google (CSV exportado de la hoja) en un resumen por
// estructura. Los issues usan el código del revisor, nunca su nombre: el nombre solo vive en la
// hoja del editor y aparece en la ficha cuando el editor aprueba la revisión.
import type { Respuesta } from '../../src/lib/revision.ts';

export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else celda += c;
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

export interface Envio {
  revisor: string;
  estructura: string;
  respuestas: Respuesta[];
  marcaTemporal: string;
}

const ID_VALIDO = /^[a-z0-9-]+$/;
/** Código del revisor: 8 caracteres A-Z0-9 según docs/revision-docente.md; se admiten guion y guion bajo. */
const REVISOR_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
/** Campos que genera la app (nombre, latin, relevancia.N, fuente.N, posicion...) o `trazo:<malla>` sin comillas invertidas, barras verticales, saltos de línea ni ángulos. */
const CAMPO_VALIDO = /^([a-z_]+(\.\d+)?|trazo:[^\r\n`|<>]{1,120})$/;
/** Versión semántica de la ficha, o `sin-ficha` para un marcador. */
const VERSION_VALIDA = /^(\d+\.\d+\.\d+|sin-ficha)$/;
/** Tope de caracteres de los textos libres. */
const MAX_TEXTO_LARGO = 4000;
const MAX_TEXTO_CORTO = 200;
const VEREDICTOS: readonly unknown[] = ['correcto', 'corregir', 'no_es_mi_area'];
const IDIOMAS: readonly unknown[] = ['es', 'en'];
const CAMPOS_TEXTO = ['campo', 'propuesta', 'comentario', 'version', 'malla', 'ramo'] as const;
const TOPES: Partial<Record<(typeof CAMPOS_TEXTO)[number], number>> = { propuesta: MAX_TEXTO_LARGO, comentario: MAX_TEXTO_LARGO, malla: MAX_TEXTO_CORTO, ramo: MAX_TEXTO_CORTO };

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * El CSV viene de un formulario público: la carga JSON puede traer cualquier cosa. Una respuesta
 * solo vale con estructura conocida, veredicto del conjunto cerrado, idioma es o en (o ausente),
 * `campo` con la forma que genera la app, `version` semántica o `sin-ficha`, los demás textos (si
 * vienen) como texto con tope de largo (4000 propuesta y comentario, 200 malla y ramo) y `posicion`
 * (si viene) como tres números finitos. Nunca lanza: devuelve false.
 */
function respuestaValida(r: unknown, idOk: (id: unknown) => boolean): r is Respuesta {
  if (!esObjeto(r) || !idOk(r['estructura'])) return false;
  if (!VEREDICTOS.includes(r['veredicto'])) return false;
  if (r['idioma'] !== undefined && !IDIOMAS.includes(r['idioma'])) return false;
  if (typeof r['campo'] !== 'string' || !CAMPO_VALIDO.test(r['campo'])) return false;
  if (typeof r['version'] !== 'string' || !VERSION_VALIDA.test(r['version'])) return false;
  for (const k of CAMPOS_TEXTO) if (r[k] !== undefined && typeof r[k] !== 'string') return false;
  for (const [k, tope] of Object.entries(TOPES)) {
    const v = r[k];
    if (typeof v === 'string' && v.length > tope) return false;
  }
  const p = r['posicion'];
  if (p !== undefined && !(Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))) return false;
  return true;
}

/**
 * Busca en cada fila la celda con la carga JSON de la app ({"v":1,...}). Un envío solo vale si su
 * estructura (y la de cada respuesta) es un id conocido y con forma de slug, así nadie puede
 * escribir fuera de la carpeta de salida, si el código del revisor son solo letras, dígitos, guion
 * y guion bajo (hasta 40, sin truncar) y si cada respuesta pasa `respuestaValida`. Una fila mal
 * formada se cuenta como inválida y nunca aborta la importación completa.
 */
export function leerEnvios(filas: string[][], idsValidos?: Set<string>): { envios: Envio[]; invalidas: number } {
  const envios: Envio[] = [];
  let invalidas = 0;
  const idOk = (id: unknown) => typeof id === 'string' && ID_VALIDO.test(id) && (!idsValidos || idsValidos.has(id));
  for (const fila of filas.slice(1)) {
    try {
      const celda = fila.find((c) => c.trim().startsWith('{"v":'));
      if (!celda) {
        invalidas++;
        continue;
      }
      const d: unknown = JSON.parse(celda);
      if (
        !esObjeto(d) ||
        typeof d['revisor'] !== 'string' ||
        !REVISOR_VALIDO.test(d['revisor']) ||
        !idOk(d['estructura']) ||
        !Array.isArray(d['respuestas']) ||
        !d['respuestas'].every((r) => respuestaValida(r, idOk))
      ) {
        invalidas++;
        continue;
      }
      envios.push({ revisor: d['revisor'], estructura: d['estructura'] as string, respuestas: d['respuestas'] as Respuesta[], marcaTemporal: fila[0] ?? '' });
    } catch {
      invalidas++;
    }
  }
  return { envios, invalidas };
}

/**
 * Un docente puede reenviar la misma estructura (o enviarla en partes): por revisor, campo e idioma
 * queda la respuesta más reciente. Las filas del CSV de Google vienen en orden cronológico.
 */
export function ultimasRespuestas(envios: Envio[]): { revisor: string; r: Respuesta; marcaTemporal: string }[] {
  const m = new Map<string, { revisor: string; r: Respuesta; marcaTemporal: string }>();
  for (const e of envios) {
    for (const r of e.respuestas) m.set(`${e.revisor}|${r.estructura}|${r.campo}|${r.idioma ?? ''}`, { revisor: e.revisor, r, marcaTemporal: e.marcaTemporal });
  }
  return [...m.values()];
}

/**
 * Texto de un formulario público dentro de una tabla de un issue: sin barras verticales ni saltos
 * de línea (rompen la tabla) y con las menciones `@usuario` neutralizadas (un espacio de ancho
 * cero tras la arroba) para que el issue no notifique a nadie.
 */
const limpiar = (t: string) => t.replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').replace(/@/g, '@\u200B');
/** Texto libre como código en línea: no se interpreta como Markdown. Las comillas invertidas se cambian por comillas simples. */
const codigo = (t: string) => (t.trim() ? `\`${limpiar(t).replace(/`/g, "'")}\`` : '');

/**
 * Todo valor que viene del CSV (revisor, campo, versión, marca temporal, propuesta, comentario, ramo
 * y malla) sale como código en línea, así enlaces, HTML y referencias `#123` o `owner/repo#123` del
 * formulario público no se interpretan en el issue. Solo el texto fijo y los valores de conjuntos
 * cerrados (veredicto, idioma) van sin código.
 */
export function resumenMarkdown(estructura: string, envios: Envio[], versionActual: string): string {
  const lineas = [`## Revisiones de \`${estructura}\``, '', `Versión actual del contenido: ${versionActual}`, ''];
  lineas.push('| Revisor | Campo | Idioma | Veredicto | Propuesta | Versión revisada | Enviado |', '|---|---|---|---|---|---|---|');
  for (const { revisor, r, marcaTemporal } of ultimasRespuestas(envios)) {
    const propuesta = r.propuesta !== undefined ? codigo(r.propuesta) : r.posicion ? `posición ${r.posicion.join(', ')}` : r.ramo ? `ramo: ${codigo(r.ramo)} (${codigo(r.malla ?? '')})` : '';
    const comentario = r.comentario?.trim() ? ` Comentario: ${codigo(r.comentario)}` : '';
    const vieja = r.version !== versionActual ? ' (desactualizada)' : '';
    lineas.push(`| ${codigo(revisor)} | ${codigo(r.campo)} | ${r.idioma ?? ''} | ${r.veredicto} | ${propuesta}${comentario} | ${codigo(r.version)}${vieja} | ${codigo(marcaTemporal)} |`);
  }
  lineas.push('', 'Siguiente paso: preparar el cambio en `src/data/estructuras.json` y que el editor lo apruebe (tier C).');
  return lineas.join('\n');
}

/** Un solo resumen con todas las estructuras de la importación (un issue por importación). */
export function resumenConsolidado(envios: Envio[], versionDe: (id: string) => string): string {
  const ids = [...new Set(envios.map((e) => e.estructura))].sort();
  const partes = ids.map((id) => resumenMarkdown(id, envios.filter((e) => e.estructura === id), versionDe(id)));
  const total = ultimasRespuestas(envios).length;
  return [`# Revisiones docentes (${total} respuestas, ${ids.length} estructuras)`, '', ...partes].join('\n\n');
}

export interface Importacion {
  /** Nombre de archivo -> contenido: un `<id>.md` por estructura y `resumen.md` con todo. */
  archivos: Map<string, string>;
  validos: number;
  invalidas: number;
}

/**
 * Todo el trabajo del script de importación sin tocar el disco: el CSV entra como texto y salen los
 * archivos por escribir. Solo cuentan los envíos de estructuras que existen en `estructuras`.
 */
export function importar(csvTexto: string, estructuras: Record<string, { ficha: { version: string } | null }>): Importacion {
  const ids = new Set(Object.keys(estructuras));
  const versionDe = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
  const { envios, invalidas } = leerEnvios(parsearCsv(csvTexto), ids);
  const porEstructura = new Map<string, Envio[]>();
  for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);
  const archivos = new Map<string, string>();
  for (const [id, lista] of porEstructura) archivos.set(`${id}.md`, resumenMarkdown(id, lista, versionDe(id)));
  archivos.set('resumen.md', resumenConsolidado(envios, versionDe));
  return { archivos, validos: envios.length, invalidas };
}
