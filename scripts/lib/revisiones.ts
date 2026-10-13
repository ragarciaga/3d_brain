// Convierte las respuestas del formulario de Google (CSV exportado de la hoja) en un resumen por
// estructura. El repositorio es público: los issues muestran el alias del revisor (D01, D02...),
// nunca su código ni su nombre (#15). El padrón código -> alias vive solo en el portátil del editor
// (pipeline/revisores.local.json, ignorado por git) y un envío con un código fuera del padrón se
// descarta. El nombre solo vive en la hoja de registro y aparece en la ficha cuando el editor
// aprueba la revisión.
import { esObjeto, respuestaValida, REVISOR_VALIDO, type Respuesta } from '../../src/lib/revision.ts';

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
/** Alias público del revisor en los issues: D seguido de dos o tres dígitos. */
export const ALIAS_VALIDO = /^D\d{2,3}$/;
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
/** Padrón privado del editor: código del revisor -> alias público. */
export type Padron = Record<string, string>;

/**
 * Valida el padrón leído de pipeline/revisores.local.json: un objeto con códigos válidos y alias
 * D01, D02... sin repetir. Devuelve el error en español o null si está bien.
 */
export function errorDePadron(p: unknown): string | null {
  if (!esObjeto(p)) return 'el padrón debe ser un objeto {"CODIGO": "D01", ...}';
  const alias = new Set<string>();
  for (const [codigo, a] of Object.entries(p)) {
    if (!REVISOR_VALIDO.test(codigo)) return `código inválido en el padrón: ${codigo.slice(0, 40)}`;
    if (typeof a !== 'string' || !ALIAS_VALIDO.test(a)) return `alias inválido para un código del padrón (usa D01, D02...)`;
    if (alias.has(a)) return `alias repetido en el padrón: ${a}`;
    alias.add(a);
  }
  return null;
}

/**
 * Cambia el código de cada envío por su alias y descarta los envíos cuyo código no está en el padrón.
 * Después de esto el código ya no aparece en ningún archivo de salida.
 */
export function aplicarPadron(envios: Envio[], padron: Padron): { envios: Envio[]; desconocidos: number } {
  const conocidos: Envio[] = [];
  let desconocidos = 0;
  for (const e of envios) {
    const alias = Object.hasOwn(padron, e.revisor) ? padron[e.revisor] : undefined;
    if (alias) conocidos.push({ ...e, revisor: alias });
    else desconocidos++;
  }
  return { envios: conocidos, desconocidos };
}

/** Letras y dígitos sin los que se confunden al dictar o copiar (0/O, 1/I/L). */
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Agrega `n` revisores al padrón: códigos de 8 caracteres que no se pueden adivinar y alias
 * consecutivos después del mayor que ya exista. `azar(max)` devuelve un entero en [0, max); el
 * script le pasa `crypto.randomInt`. Devuelve el padrón nuevo y los agregados, en orden.
 */
export function agregarRevisores(padron: Padron, n: number, azar: (max: number) => number): { padron: Padron; nuevos: [string, string][] } {
  const siguiente = Math.max(0, ...Object.values(padron).map((a) => Number(a.slice(1)))) + 1;
  const res: Padron = { ...padron };
  const nuevos: [string, string][] = [];
  for (let i = 0; i < n; i++) {
    const crear = () => Array.from({ length: 8 }, () => ALFABETO_CODIGO[azar(ALFABETO_CODIGO.length)]).join('');
    let codigo = crear();
    while (Object.hasOwn(res, codigo)) codigo = crear();
    const alias = `D${String(siguiente + i).padStart(2, '0')}`;
    res[codigo] = alias;
    nuevos.push([codigo, alias]);
  }
  return { padron: res, nuevos };
}

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
  lineas.push('| Revisor (alias) | Campo | Idioma | Veredicto | Propuesta | Versión revisada | Enviado |', '|---|---|---|---|---|---|---|');
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
export function resumenConsolidado(envios: Envio[], versionDe: (id: string) => string, desconocidos = 0): string {
  const ids = [...new Set(envios.map((e) => e.estructura))].sort();
  const partes = ids.map((id) => resumenMarkdown(id, envios.filter((e) => e.estructura === id), versionDe(id)));
  const total = ultimasRespuestas(envios).length;
  const aviso = desconocidos
    ? [`Se descartaron ${desconocidos} envíos con un código que no está en el padrón de revisores.`, '']
    : [];
  return [`# Revisiones docentes (${total} respuestas, ${ids.length} estructuras)`, '', ...aviso, ...partes].join('\n\n');
}

export interface Importacion {
  /** Nombre de archivo -> contenido: un `<id>.md` por estructura y `resumen.md` con todo. */
  archivos: Map<string, string>;
  validos: number;
  invalidas: number;
  /** Envíos bien formados pero con un código fuera del padrón (descartados). */
  desconocidos: number;
}

/**
 * Todo el trabajo del script de importación sin tocar el disco: el CSV entra como texto y salen los
 * archivos por escribir. Solo cuentan los envíos de estructuras que existen en `estructuras`.
 */
export function importar(
  csvTexto: string,
  estructuras: Record<string, { ficha: { version: string } | null }>,
  padron: Padron,
): Importacion {
  const ids = new Set(Object.keys(estructuras));
  const versionDe = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
  const leidos = leerEnvios(parsearCsv(csvTexto), ids);
  const { envios, desconocidos } = aplicarPadron(leidos.envios, padron);
  const invalidas = leidos.invalidas;
  const porEstructura = new Map<string, Envio[]>();
  for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);
  const archivos = new Map<string, string>();
  for (const [id, lista] of porEstructura) archivos.set(`${id}.md`, resumenMarkdown(id, lista, versionDe(id)));
  archivos.set('resumen.md', resumenConsolidado(envios, versionDe, desconocidos));
  return { archivos, validos: envios.length, invalidas, desconocidos };
}
