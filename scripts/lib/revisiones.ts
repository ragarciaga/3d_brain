// Convierte el CSV exportado del formulario de Google o de la pestaña Respuestas de la hoja del
// Apps Script (ADR 0012) en un resumen por estructura. El repositorio es público: los issues
// muestran el alias del revisor (D01, D02...), nunca su código ni su nombre (#15). El padrón
// código -> alias vive solo en el portátil del editor (pipeline/revisores.local.json, ignorado por
// git) y un envío con un código fuera del padrón se descarta. Las fichas nunca muestran datos del
// revisor.
// La casilla del vago (S2, #163): las respuestas de trazos y de rutas trazadas del vago solo entran al
// resumen normal si la última fila del código en la pestaña Autorizaciones dice `sí`; el resto sale en
// una sección aparte, sin aplicarse (`separarSinVago`, `seccionSinVago`).
import { CLAVES_V2, esObjeto, fechaValida, respuestaValida, REVISOR_VALIDO, type Respuesta } from '../../src/lib/revision.ts';

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
 * Expande una carga `v:2` ({"v":2,"r":<código>,"e":{<id>:[{<claves cortas>}]}}) en un envío por
 * estructura. Cada clave de `e` termina como nombre de archivo (`<id>.md`), así que debe pasar `idOk`.
 * Los elementos se copian solo por las claves conocidas de `CLAVES_V2` (el resto se descarta), llevan
 * la estructura de su clave y pasan `respuestaValida`. Si traen `f` (la fecha de la respuesta), debe
 * pasar `fechaValida` (texto de hasta 40 caracteres que `Date.parse` entiende); sin `f` la fecha queda
 * ''. Devuelve null si algo está mal: una respuesta mala invalida la fila entera, igual que en `v:1`.
 */
function expandirV2(d: Record<string, unknown>, idOk: (id: unknown) => boolean, marcaTemporal: string): Envio[] | null {
  const revisor = d['r'];
  const e = d['e'];
  if (typeof revisor !== 'string' || !REVISOR_VALIDO.test(revisor)) return null;
  if (!esObjeto(e)) return null;
  const entradas = Object.entries(e);
  if (entradas.length === 0) return null;
  const envios: Envio[] = [];
  for (const [id, valor] of entradas) {
    if (!idOk(id) || !Array.isArray(valor) || valor.length === 0) return null;
    const respuestas: Respuesta[] = [];
    for (const el of valor as unknown[]) {
      if (!esObjeto(el)) return null;
      const r: Record<string, unknown> = { estructura: id, fecha: '' };
      for (const [largo, corto] of Object.entries(CLAVES_V2)) {
        if (Object.hasOwn(el, corto)) r[largo] = el[corto];
      }
      if (Object.hasOwn(el, CLAVES_V2.fecha) && !fechaValida(el[CLAVES_V2.fecha])) return null;
      if (!respuestaValida(r, idOk)) return null;
      respuestas.push(r);
    }
    envios.push({ revisor, estructura: id, respuestas, marcaTemporal });
  }
  return envios;
}

const SI_NO = ['sí', 'no'];

/**
 * Fila con la forma exacta de las otras pestañas de la hoja del Apps Script, que no son envíos:
 * Autorizaciones (4 columnas: código, fecha legible, versión del texto, sí o no) o Padrón (3 columnas:
 * código, alias, sí o no). Las celdas se comparan sin recortar.
 */
function esFilaDeOtraPestana(fila: string[]): boolean {
  const [a = '', b = '', c = '', d = ''] = fila;
  if (fila.length === 4) return REVISOR_VALIDO.test(a) && Number.isFinite(Date.parse(b)) && c !== '' && SI_NO.includes(d);
  if (fila.length === 3) return REVISOR_VALIDO.test(a) && ALIAS_VALIDO.test(b) && SI_NO.includes(c);
  return false;
}

/**
 * Busca en cada fila, en cualquier columna, la celda con la carga JSON de la app ({"v":1,...} o
 * {"v":2,...}), sea el CSV del formulario o el de la pestaña Respuestas del Apps Script. Un envío solo
 * vale si su estructura (y la de cada respuesta) es un id conocido y con forma de slug, así nadie puede
 * escribir fuera de la carpeta de salida, si el código del revisor son solo letras, dígitos, guion
 * y guion bajo (hasta 40, sin truncar) y si cada respuesta pasa `respuestaValida`. Las filas sin carga
 * con la forma de Autorizaciones o de Padrón se ignoran sin contarse; cualquier otra fila mal formada
 * se cuenta como inválida y nunca aborta la importación completa.
 */
export function leerEnvios(filas: string[][], idsValidos?: Set<string>): { envios: Envio[]; invalidas: number } {
  const envios: Envio[] = [];
  let invalidas = 0;
  const idOk = (id: unknown) => typeof id === 'string' && ID_VALIDO.test(id) && (!idsValidos || idsValidos.has(id));
  for (const fila of filas.slice(1)) {
    try {
      const celda = fila.find((c) => c.trim().startsWith('{"v":'));
      if (!celda) {
        if (!esFilaDeOtraPestana(fila)) invalidas++;
        continue;
      }
      const d: unknown = JSON.parse(celda);
      if (esObjeto(d) && d['v'] === 2) {
        const expandidos = expandirV2(d, idOk, fila[0] ?? '');
        if (expandidos) envios.push(...expandidos);
        else invalidas++;
        continue;
      }
      if (
        !esObjeto(d) ||
        d['v'] !== 1 ||
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
 * D01, D02... sin repetir. Devuelve el error en español o null si está bien. El error nombra la entrada
 * por su posición (y su alias si es válido), nunca por su código.
 */
export function errorDePadron(p: unknown): string | null {
  if (!esObjeto(p)) return 'el padrón debe ser un objeto {"CODIGO": "D01", ...}';
  const alias = new Set<string>();
  let posicion = 0;
  for (const [codigo, a] of Object.entries(p)) {
    posicion++;
    // Nunca se imprime el código, ni entero ni cortado: un código con una errata sigue siendo casi el código.
    if (!REVISOR_VALIDO.test(codigo)) {
      const alias = typeof a === 'string' && ALIAS_VALIDO.test(a) ? ` (alias ${a})` : '';
      return `código inválido en la entrada ${posicion} del padrón${alias}`;
    }
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

/**
 * Campos de revisión por lado del recorrido trazado, de antes de que cada ruta tuviera el suyo (spec 02 R5.3).
 * No dicen a qué ruta se refieren, así que ninguna respuesta a ellos se aplica a una ruta.
 */
export const CAMPOS_POR_LADO: ReadonlySet<string> = new Set(['trazado_derecho', 'trazado_izquierdo']);

/** Texto libre como código en línea: no se interpreta como Markdown. Las comillas invertidas se cambian por comillas simples. */
const codigo = (t: string) => (t.trim() ? `\`${limpiar(t).replace(/`/g, "'")}\`` : '');

/**
 * Tabla de respuestas de una estructura: las dos líneas de cabecera (7 columnas) y una fila por la
 * última respuesta de cada revisor, campo e idioma. Todo valor que viene del CSV sale como código en línea.
 */
function tablaDe(envios: Envio[], versionActual: string): string[] {
  const lineas = ['| Revisor (alias) | Campo | Idioma | Veredicto | Propuesta | Versión revisada | Enviado |', '|---|---|---|---|---|---|---|'];
  for (const { revisor, r, marcaTemporal } of ultimasRespuestas(envios)) {
    const propuesta = r.propuesta !== undefined ? codigo(r.propuesta) : r.posicion ? `posición ${r.posicion.join(', ')}` : r.ramo ? `ramo: ${codigo(r.ramo)} (${codigo(r.malla ?? '')})` : '';
    const comentario = r.comentario?.trim() ? ` Comentario: ${codigo(r.comentario)}` : '';
    const vieja = CAMPOS_POR_LADO.has(r.campo)
      ? ' (desactualizada) campo por lado, no se aplica a ninguna ruta'
      : r.version !== versionActual
        ? ' (desactualizada)'
        : '';
    lineas.push(`| ${codigo(revisor)} | ${codigo(r.campo)} | ${r.idioma ?? ''} | ${r.veredicto} | ${propuesta}${comentario} | ${codigo(r.version)}${vieja} | ${codigo(marcaTemporal)} |`);
  }
  return lineas;
}

/**
 * Todo valor que viene del CSV (revisor, campo, versión, marca temporal, propuesta, comentario, ramo
 * y malla) sale como código en línea, así enlaces, HTML y referencias `#123` o `owner/repo#123` del
 * formulario público no se interpretan en el issue. Solo el texto fijo y los valores de conjuntos
 * cerrados (veredicto, idioma) van sin código.
 * Una respuesta a un campo por lado (`CAMPOS_POR_LADO`) sale siempre como desactualizada, aunque traiga la
 * versión vigente, con la nota de que no se aplica a ninguna ruta; las de `trazado_<id de la ruta>` salen
 * como cualquier otro campo.
 */
export function resumenMarkdown(estructura: string, envios: Envio[], versionActual: string): string {
  const lineas = [`## Revisiones de \`${estructura}\``, '', `Versión actual del contenido: ${versionActual}`, '', ...tablaDe(envios, versionActual)];
  lineas.push('', 'Siguiente paso: preparar el cambio en `src/data/estructuras.json` y que el editor lo apruebe (tier C).');
  return lineas.join('\n');
}

/**
 * Respuesta del vago: un trazo (`trazo:<malla>`), una ruta trazada (`trazado_<id>`, también los campos por
 * lado) o cualquiera que traiga `malla` o `ramo`, que `respuestaValida` acepta en cualquier campo y la
 * tabla dibuja. Los campos de ficha de `vagus-nerve-x` (`nombre`, `que_es`...) no lo son: igual que en la
 * app, siguen revisables sin la casilla del vago (R5.1).
 */
export function esRespuestaDelVago(r: Pick<Respuesta, 'campo' | 'malla' | 'ramo'>): boolean {
  return r.campo.startsWith('trazo:') || r.campo.startsWith('trazado_') || r.malla !== undefined || r.ramo !== undefined;
}

/**
 * Lee las filas de la pestaña Autorizaciones (A código, B fecha, C versión, D vago) con la regla de
 * `autorizacionDe` del Apps Script: salta la cabecera, manda la última fila de cada código y el vago
 * vale solo si la columna D recortada es exactamente `sí`. Las filas con un código inválido se ignoran.
 * Devuelve código -> vago; nunca lanza. Solo se usa el código como llave de un `Map`.
 */
export function leerAutorizaciones(filas: string[][]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const fila of filas.slice(1)) {
    const a = (fila[0] ?? '').trim();
    if (!REVISOR_VALIDO.test(a)) continue;
    m.set(a, (fila[3] ?? '').trim() === 'sí');
  }
  return m;
}

/**
 * Aparta las respuestas del vago de los revisores sin la casilla (`puedeVago(revisor)` falso). El envío
 * de un revisor con la casilla pasa entero; el de uno sin ella se parte: lo que no es del vago queda en
 * `envios` y lo del vago en `sinVago`. No muta la entrada.
 */
export function separarSinVago(envios: Envio[], puedeVago: (revisor: string) => boolean): { envios: Envio[]; sinVago: Envio[] } {
  const normales: Envio[] = [];
  const sinVago: Envio[] = [];
  for (const e of envios) {
    if (puedeVago(e.revisor)) {
      normales.push(e);
      continue;
    }
    const delVago = e.respuestas.filter(esRespuestaDelVago);
    const resto = e.respuestas.filter((r) => !esRespuestaDelVago(r));
    if (resto.length) normales.push({ ...e, respuestas: resto });
    if (delVago.length) sinVago.push({ ...e, respuestas: delVago });
  }
  return { envios: normales, sinVago };
}

/**
 * Sección de `resumen.md` con las respuestas del vago que no se aplican por falta de la casilla, con la
 * misma tabla neutralizada de las demás. Devuelve '' si no hay ninguna. `sinArchivo`: no se pasó el CSV de
 * Autorizaciones, así que ninguna respuesta del vago entra al resumen.
 */
export function seccionSinVago(envios: Envio[], versionDe: (id: string) => string, sinArchivo: boolean): string {
  const n = ultimasRespuestas(envios).length;
  if (n === 0) return '';
  const lineas = [
    '## Descartadas: sin la casilla del vago',
    '',
    `${n} respuestas de trazos y rutas del vago de revisores cuya última autorización no marca la casilla del vago, o que no tienen autorización. No se aplican.`,
  ];
  if (sinArchivo) lineas.push('No se pasó el CSV de Autorizaciones (--autorizaciones): ninguna respuesta del vago entra al resumen.');
  for (const id of [...new Set(envios.map((e) => e.estructura))].sort()) {
    lineas.push('', `### \`${id}\``, '', `Versión actual del contenido: ${versionDe(id)}`, '', ...tablaDe(envios.filter((e) => e.estructura === id), versionDe(id)));
  }
  return lineas.join('\n');
}

/** Un solo resumen con todas las estructuras de la importación (un issue por importación). */
export function resumenConsolidado(
  envios: Envio[],
  versionDe: (id: string) => string,
  desconocidos = 0,
  vago: { descartadas: Envio[]; sinArchivo: boolean } = { descartadas: [], sinArchivo: false },
  sinAutorizacion = 0,
): string {
  const ids = [...new Set(envios.map((e) => e.estructura))].sort();
  const partes = ids.map((id) => resumenMarkdown(id, envios.filter((e) => e.estructura === id), versionDe(id)));
  const total = ultimasRespuestas(envios).length;
  const aviso = desconocidos
    ? [`Se descartaron ${desconocidos} envíos con un código que no está en el padrón de revisores.`, '']
    : [];
  // Marca para el editor: quita de las tablas las filas de esos alias antes de crear el issue público.
  if (sinAutorizacion > 0) aviso.push(`Hay ${sinAutorizacion} respuestas de revisores sin ninguna autorización en \`Autorizaciones\`.`, '');
  const sinVago = seccionSinVago(vago.descartadas, versionDe, vago.sinArchivo);
  return [`# Revisiones docentes (${total} respuestas, ${ids.length} estructuras)`, '', ...aviso, ...partes, ...(sinVago ? [sinVago] : [])].join('\n\n');
}

export interface Importacion {
  /** Nombre de archivo -> contenido: un `<id>.md` por estructura y `resumen.md` con todo. */
  archivos: Map<string, string>;
  /**
   * Envíos válidos por estructura: una fila `v:2` cuenta una vez por cada estructura que trae, igual que
   * `desconocidos`. Incluye los envíos cuyas respuestas fueron todas a "Descartadas".
   */
  validos: number;
  invalidas: number;
  /** Envíos bien formados pero con un código fuera del padrón (descartados). */
  desconocidos: number;
  /** Respuestas únicas del vago que salen en "Descartadas: sin la casilla del vago" y no se aplican. */
  sinVago: number;
  /** Códigos distintos leídos del CSV de Autorizaciones, o null si no se pasó. */
  autorizaciones: number | null;
  /**
   * Respuestas únicas que no son del vago de alias con algún código del padrón sin ninguna fila en
   * Autorizaciones. Siguen en las tablas (son solo un conteo); `null` si no se pasó el CSV.
   */
  sinAutorizacion: number | null;
  /** Alias (nunca códigos) de esas respuestas, en orden alfabético; vacío si no hay o no se pasó el CSV. */
  aliasSinAutorizacion: string[];
}

/**
 * Todo el trabajo del script de importación sin tocar el disco: el CSV entra como texto y salen los
 * archivos por escribir. Solo cuentan los envíos de estructuras que existen en `estructuras`.
 * `autorizacionesCsv` es el CSV de la pestaña Autorizaciones: las respuestas del vago (`esRespuestaDelVago`)
 * de un alias cuya última autorización no dice `vago = sí` salen solo en la sección "Descartadas: sin la
 * casilla del vago" de `resumen.md`, no en las tablas normales ni en `<id>.md`. Con `null` (sin archivo)
 * ninguna respuesta del vago entra al resumen. Los códigos del CSV solo sirven de llave y no salen en
 * ningún archivo. Con el CSV, `sinAutorizacion` cuenta las respuestas normales de alias con algún código sin
 * ninguna fila en Autorizaciones: no se apartan, solo se avisa con una línea en `resumen.md` (nunca en los
 * `<id>.md`) y se devuelven sus alias para que el editor las revise antes del issue público.
 */
export function importar(
  csvTexto: string,
  estructuras: Record<string, { ficha: { version: string } | null }>,
  padron: Padron,
  autorizacionesCsv: string | null = null,
): Importacion {
  const ids = new Set(Object.keys(estructuras));
  const versionDe = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
  const leidos = leerEnvios(parsearCsv(csvTexto), ids);
  const { envios: conAlias, desconocidos } = aplicarPadron(leidos.envios, padron);
  const invalidas = leidos.invalidas;
  const codigos = autorizacionesCsv === null ? new Map<string, boolean>() : leerAutorizaciones(parsearCsv(autorizacionesCsv));
  // Falla cerrada: un alias solo puede con el vago si todos sus códigos del padrón tienen vago = sí.
  const porAlias = new Map<string, boolean>();
  for (const [c, alias] of Object.entries(padron)) porAlias.set(alias, (porAlias.get(alias) ?? true) && codigos.get(c) === true);
  const { envios, sinVago } = separarSinVago(conAlias, (a) => porAlias.get(a) === true);
  // Falla cerrada también aquí: basta un código del alias sin fila en Autorizaciones. `envios` ya no trae
  // respuestas del vago de esos alias, así que el conteo es de las respuestas normales.
  const sinFila = new Set<string>();
  for (const [c, alias] of Object.entries(padron)) if (!codigos.has(c)) sinFila.add(alias);
  const afectadas = autorizacionesCsv === null ? [] : ultimasRespuestas(envios.filter((e) => sinFila.has(e.revisor)));
  const sinAutorizacion = autorizacionesCsv === null ? null : afectadas.length;
  const aliasSinAutorizacion = [...new Set(afectadas.map((a) => a.revisor))].sort();
  const porEstructura = new Map<string, Envio[]>();
  for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);
  const archivos = new Map<string, string>();
  for (const [id, lista] of porEstructura) archivos.set(`${id}.md`, resumenMarkdown(id, lista, versionDe(id)));
  archivos.set(
    'resumen.md',
    resumenConsolidado(envios, versionDe, desconocidos, { descartadas: sinVago, sinArchivo: autorizacionesCsv === null }, sinAutorizacion ?? 0),
  );
  return {
    archivos,
    validos: conAlias.length,
    invalidas,
    desconocidos,
    sinVago: ultimasRespuestas(sinVago).length,
    autorizaciones: autorizacionesCsv === null ? null : codigos.size,
    sinAutorizacion,
    aliasSinAutorizacion,
  };
}

/**
 * Argumentos del script de importación: `respuestas.csv [padrón] [--autorizaciones <csv>]`, con la bandera
 * en cualquier posición. Devuelve null ante un uso indebido: sin CSV, bandera sin valor o seguida de otra
 * bandera, bandera repetida o desconocida, o más de dos posicionales.
 */
export function argumentosImportar(args: string[]): { csv: string; padron?: string; autorizaciones?: string } | null {
  const posicionales: string[] = [];
  let autorizaciones: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--autorizaciones') {
      const valor = args[i + 1];
      if (autorizaciones !== undefined || !valor || valor.startsWith('--')) return null;
      autorizaciones = valor;
      i++;
    } else if (a.startsWith('--')) return null;
    else posicionales.push(a);
  }
  if (posicionales.length < 1 || posicionales.length > 2) return null;
  const res: { csv: string; padron?: string; autorizaciones?: string } = { csv: posicionales[0]! };
  if (posicionales[1] !== undefined) res.padron = posicionales[1];
  if (autorizaciones !== undefined) res.autorizaciones = autorizaciones;
  return res;
}
