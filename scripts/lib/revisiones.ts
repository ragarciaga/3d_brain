// Convierte el CSV exportado del formulario de Google o de la pestaña Respuestas de la hoja del
// Apps Script (ADR 0012) en un resumen por estructura. El repositorio es público: los issues
// muestran el alias del revisor (D01, D02...), nunca su código ni su nombre (#15). El padrón
// código -> alias es la pestaña `Padrón` de la hoja del canal, que el editor descarga como CSV
// (`padronDeCsv`, #257); un envío con un código fuera del padrón se descarta. Las fichas nunca
// muestran datos del revisor.
// Activo (#257): las filas de la pestaña Respuestas de cualquier código del padrón se importan, esté o no
// en `sí`; las del formulario de respaldo de un código que no está en `sí` se descartan, y el resumen y la
// consola dicen por alias cuántas filas aportó cada código inactivo (`seccionInactivos`).
// La casilla del vago (S2, #163): las respuestas de trazos y de rutas trazadas del vago solo entran al
// resumen normal si la última fila del código en la pestaña Autorizaciones dice `sí`; el resto sale en
// una sección aparte, sin aplicarse (`separarSinVago`, `seccionSinVago`).
// Con el CSV de Autorizaciones, todas las respuestas (del vago o no) de un alias con algún código sin
// ninguna fila salen solo en "Descartadas: sin autorización", con alias, campo, idioma y estructura
// (`seccionSinAutorizacion`): sin autorización de tratamiento de datos no se publica su texto.
import { CLAVES_V2, esObjeto, fechaValida, respuestaValida, retiroValido, REVISOR_VALIDO, type Respuesta, type Retiro } from '../../src/lib/revision.ts';

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
  /**
   * Retiros de marcas (#217) de esta estructura, solo en filas `v:2` de la pestaña Respuestas que los traen. Ausente
   * si no hay. `quitarRetiradas` los aplica solo a las respuestas anteriores del mismo revisor que llegaron en filas `v:2` con la forma de la
   * pestaña Respuestas (`deHoja`), nunca a las del formulario ni a las `v:1`.
   */
  retiros?: Retiro[];
  /**
   * La fila es una carga `v:2` con la forma de la pestaña Respuestas (`esFilaDeRespuestas`). Solo los envíos de ahí
   * pueden traer retiros y solo a ellos los quita un retiro (#217, R7.3): lo que llegó por el formulario o en `v:1`
   * se corrige con otro veredicto, nunca con un retiro. Ausente en los demás.
   */
  deHoja?: true;
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
 * Un elemento con `d` vacío es un retiro (#217): pasa por `retiroValido` y va a `Envio.retiros`. Solo se acepta si
 * `admiteRetiros` (la fila tiene la forma de la pestaña Respuestas); si no, la fila entera es inválida. La misma
 * clave como retiro y como veredicto en una estructura también la invalida (el script hace lo mismo).
 */
function expandirV2(
  d: Record<string, unknown>,
  idOk: (id: unknown) => boolean,
  marcaTemporal: string,
  admiteRetiros: boolean,
): Envio[] | null {
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
    const retiros: Retiro[] = [];
    const tipos = new Map<string, boolean>(); // campo|idioma -> es retiro
    for (const el of valor as unknown[]) {
      if (!esObjeto(el)) return null;
      const r: Record<string, unknown> = { estructura: id, fecha: '' };
      for (const [largo, corto] of Object.entries(CLAVES_V2)) {
        if (Object.hasOwn(el, corto)) r[largo] = el[corto];
      }
      if (Object.hasOwn(el, CLAVES_V2.fecha) && !fechaValida(el[CLAVES_V2.fecha])) return null;
      const esRetiro = r['veredicto'] === '';
      if (esRetiro) {
        if (!admiteRetiros || !retiroValido(r, idOk)) return null;
      } else if (!respuestaValida(r, idOk)) return null;
      const clave = `${r['campo'] as string}|${r['idioma'] === undefined ? '' : (r['idioma'] as string)}`;
      if (tipos.has(clave) && tipos.get(clave) !== esRetiro) return null;
      tipos.set(clave, esRetiro);
      if (esRetiro) retiros.push(r as unknown as Retiro);
      else respuestas.push(r as unknown as Respuesta);
    }
    envios.push({ revisor, estructura: id, respuestas, ...(retiros.length ? { retiros } : {}), ...(admiteRetiros ? { deHoja: true as const } : {}), marcaTemporal });
  }
  return envios;
}

const SI_NO = ['sí', 'no'];

/** Fecha de recepción que escribe el script en la columna A de `Respuestas`: `toISOString()`. */
const RECIBIDO_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * La fila tiene la forma de la pestaña Respuestas del Apps Script (R7.3, #217): cuatro columnas, A con la fecha de
 * recepción ISO, B igual al código `r` de la carga (el script exige que coincidan) y la carga en D. Solo esas filas
 * pueden traer retiros: el formulario de respaldo no los lleva, así que un retiro en otra fila es inválido.
 */
function esFilaDeRespuestas(fila: string[], r: unknown): boolean {
  return fila.length === 4 && typeof r === 'string' && fila[1] === r && RECIBIDO_ISO.test(fila[0] ?? '') && (fila[3] ?? '').trim().startsWith('{"v":');
}

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
        const expandidos = expandirV2(d, idOk, fila[0] ?? '', esFilaDeRespuestas(fila, d['r']));
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

/** Una marca que un retiro quitó: revisor (código o, después de `aplicarPadron`, alias), estructura, campo e idioma ('' si no tiene). Sin veredicto, propuesta ni comentario; el campo de un trazo admite hasta 120 caracteres. */
export interface MarcaRetirada {
  revisor: string;
  estructura: string;
  campo: string;
  idioma: string;
}

/**
 * Aplica los retiros (#217): cada retiro de un envío quita las respuestas de la misma clave
 * revisor|estructura|campo|idioma de los envíos anteriores a ese envío, en el orden de las filas (la última fila por
 * clave manda, R3.6), pero solo de los envíos con `deHoja` (carga `v:2` con la forma de la pestaña Respuestas): los `v:1` y
 * lo que llegó por el formulario nunca se quitan (R7.3). Un veredicto posterior al retiro, el de otro revisor y el de otra clave no se tocan. El idioma
 * ausente cuenta como '', igual que en `ultimasRespuestas`. Devuelve los envíos sin las respuestas quitadas (los
 * envíos sin retiros salen tal cual, y los que un retiro dejó sin respuestas o que solo traían retiros no salen) y
 * las claves que quitaron algo y siguen sin respuesta, sin repetir. No muta la entrada.
 */
export function quitarRetiradas(envios: Envio[]): { envios: Envio[]; retiradas: MarcaRetirada[] } {
  const clave = (revisor: string, estructura: string, campo: string, idioma: string | undefined) => `${revisor}|${estructura}|${campo}|${idioma ?? ''}`;
  const salida = envios.map((e) => ({ ...e, respuestas: [...e.respuestas] }));
  // Índices de los envíos que un retiro dejó sin ninguna respuesta.
  const vaciados = new Set<number>();
  // Clave -> la marca del último retiro que quitó algo de ella.
  const quitadas = new Map<string, { marca: MarcaRetirada }>();
  salida.forEach((e, i) => {
    for (const retiro of e.retiros ?? []) {
      const k = clave(e.revisor, retiro.estructura, retiro.campo, retiro.idioma);
      for (const [j, previo] of salida.slice(0, i).entries()) {
        if (!previo.deHoja) continue; // lo del formulario y los `v:1` no se retiran (R7.3)
        const quedan = previo.respuestas.filter((r) => clave(previo.revisor, r.estructura, r.campo, r.idioma) !== k);
        if (quedan.length === previo.respuestas.length) continue;
        previo.respuestas = quedan;
        if (quedan.length === 0) vaciados.add(j);
        quitadas.set(k, { marca: { revisor: e.revisor, estructura: retiro.estructura, campo: retiro.campo, idioma: retiro.idioma ?? '' } });
      }
    }
  });
  // Solo siguen quitadas las que quedan sin ninguna respuesta: ni un veredicto posterior al retiro ni uno del formulario.
  const retiradas = [...quitadas.entries()]
    .filter(([k]) => !salida.some((e) => e.respuestas.some((r) => clave(e.revisor, r.estructura, r.campo, r.idioma) === k)))
    .map(([, { marca }]) => marca);
  // Un envío que se quedó sin nada por un retiro, o que solo traía retiros, ya no tiene qué mostrar.
  const conservados = salida.filter((e, i) => !vaciados.has(i) && !(e.retiros && e.respuestas.length === 0));
  return { envios: conservados, retiradas };
}

/**
 * Sección de `resumen.md` con las marcas que un retiro quitó (#217), para que el editor vea qué desapareció además
 * del conteo. Solo alias, estructura, campo e idioma: nunca el veredicto, la propuesta ni el comentario. Devuelve ''
 * si no hay ninguna.
 */
export function seccionRetiradas(retiradas: MarcaRetirada[]): string {
  if (retiradas.length === 0) return '';
  const filas = [...retiradas].sort((a, b) => cmp(a.estructura, b.estructura) || cmp(a.revisor, b.revisor) || cmp(a.campo, b.campo) || cmp(a.idioma, b.idioma));
  return [
    '## Marcas retiradas',
    '',
    `${retiradas.length} marcas que el docente quitó después de responderlas. Sus respuestas anteriores ya no están en las tablas ni en las secciones "Descartadas"; aquí solo van el alias, el campo, el idioma y la estructura.`,
    '',
    '| Revisor (alias) | Campo | Idioma | Estructura |',
    '|---|---|---|---|',
    ...filas.map((f) => `| ${codigo(f.revisor)} | ${codigo(f.campo)} | ${f.idioma} | ${codigo(f.estructura)} |`),
  ].join('\n');
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
 * Valida el padrón (código -> alias) que arma `padronDeCsv`: un objeto con códigos válidos y alias
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
      const sufijoAlias = typeof a === 'string' && ALIAS_VALIDO.test(a) ? ` (alias ${a})` : '';
      return `código inválido en la entrada ${posicion} del padrón${sufijoAlias}`;
    }
    if (typeof a !== 'string' || !ALIAS_VALIDO.test(a)) return `alias inválido para un código del padrón (usa D01, D02...)`;
    if (alias.has(a)) return `alias repetido en el padrón: ${a}`;
    alias.add(a);
  }
  return null;
}

/** Cabecera exacta de la pestaña `Padrón` (tres columnas, sin otras). */
const CABECERA_PADRON = ['Código', 'Alias', 'Activo'];
/** Valor de Activo que deja un código vivo en el canal; igual que `ACTIVO` en apps-script/Codigo.js. */
const ACTIVO_SI = 'sí';

/** El padrón leído de un CSV de la pestaña `Padrón` (#257). */
export interface PadronLeido {
  /** Código -> alias, sin prototipo (un código llamado `constructor` no cuenta como conocido). Vacío si hay `error`. */
  padron: Padron;
  /** Códigos cuyo Activo no es exactamente `sí` en alguna de sus filas (falla cerrada si el código se repite). */
  inactivos: Set<string>;
  /** Una línea por fila descartada (código o alias inválido), con su posición y, si es válido, su alias; nunca el código. */
  avisos: string[];
  /** Por qué el CSV no sirve, con un texto fijo que no cita ninguna celda, o null si sirve. */
  error: string | null;
}

/**
 * Lee las filas de `parsearCsv` del CSV de la pestaña `Padrón` (A código, B alias, C activo). La primera fila,
 * recortada (también de la BOM), debe ser exactamente `Código,Alias,Activo`: si no, el error es un texto fijo (la fila
 * podría ser un código). Código y alias se recortan, como hace el script. Una fila con código o alias inválido
 * se descarta con un aviso (`entrada N del padrón`, con el alias solo si es válido). El mismo código con otro alias es un
 * error que nombra las entradas y los alias; con el mismo alias, las filas se juntan. Un alias en dos códigos
 * es un error (`errorDePadron`). Sin ningún código válido es un error. Activo no filtra aquí: solo se anota en `inactivos`.
 * Nunca imprime ni devuelve un código en un mensaje.
 */
export function padronDeCsv(filas: string[][]): PadronLeido {
  const vacio = (error: string): PadronLeido => ({ padron: Object.create(null) as Padron, inactivos: new Set(), avisos: [], error });
  // `trim` también quita la BOM (U+FEFF cuenta como espacio en blanco), que Sheets y Excel ponen al inicio del CSV.
  const cabecera = (filas[0] ?? []).map((c) => c.trim());
  if (cabecera.length !== CABECERA_PADRON.length || cabecera.some((c, i) => c !== CABECERA_PADRON[i])) {
    return vacio('la primera fila no es la cabecera Código,Alias,Activo: descarga el CSV de la pestaña Padrón de la hoja del canal');
  }
  const padron = Object.create(null) as Padron;
  const entradas = new Map<string, number>(); // código -> número de su primera entrada
  const inactivos = new Set<string>();
  const avisos: string[] = [];
  for (const [i, fila] of filas.slice(1).entries()) {
    const posicion = i + 1;
    const codigo = (fila[0] ?? '').trim();
    const alias = (fila[1] ?? '').trim();
    const aliasValido = ALIAS_VALIDO.test(alias);
    if (!REVISOR_VALIDO.test(codigo)) {
      avisos.push(`código inválido en la entrada ${posicion} del padrón${aliasValido ? ` (alias ${alias})` : ''}: se descartó`);
      continue;
    }
    if (!aliasValido) {
      avisos.push(`alias inválido en la entrada ${posicion} del padrón (usa D01, D02...): se descartó`);
      continue;
    }
    if (Object.hasOwn(padron, codigo) && padron[codigo] !== alias) {
      return vacio(`el mismo código está en las entradas ${entradas.get(codigo)} y ${posicion} del padrón con los alias ${padron[codigo]} y ${alias}`);
    }
    padron[codigo] = alias;
    if (!entradas.has(codigo)) entradas.set(codigo, posicion);
    if ((fila[2] ?? '').trim() !== ACTIVO_SI) inactivos.add(codigo);
  }
  if (Object.keys(padron).length === 0) return vacio('el padrón no tiene ningún código válido: revisa que sea el CSV de la pestaña Padrón');
  const repetido = errorDePadron(padron);
  if (repetido) return vacio(repetido);
  return { padron, inactivos, avisos, error: null };
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
 * Autorizaciones, así que ninguna respuesta del vago entra al resumen y no se sabe quién tiene autorización
 * (la frase lo dice). Con el CSV, los alias sin ninguna fila ya salieron a `seccionSinAutorizacion`.
 */
export function seccionSinVago(envios: Envio[], versionDe: (id: string) => string, sinArchivo: boolean): string {
  const n = ultimasRespuestas(envios).length;
  if (n === 0) return '';
  const lineas = [
    '## Descartadas: sin la casilla del vago',
    '',
    `${n} respuestas de trazos y rutas del vago de revisores cuya última autorización no marca la casilla del vago${sinArchivo ? ', o que no tienen autorización' : ''}. No se aplican.`,
  ];
  if (sinArchivo) lineas.push('No se pasó el CSV de Autorizaciones (--autorizaciones): ninguna respuesta del vago entra al resumen.');
  for (const id of [...new Set(envios.map((e) => e.estructura))].sort()) {
    lineas.push('', `### \`${id}\``, '', `Versión actual del contenido: ${versionDe(id)}`, '', ...tablaDe(envios.filter((e) => e.estructura === id), versionDe(id)));
  }
  return lineas.join('\n');
}

/**
 * Sección de `resumen.md` con las respuestas de alias sin ninguna fila en Autorizaciones (con el CSV).
 * Devuelve '' si no hay ninguna. Sin autorización de tratamiento de datos (Ley 1581 de 2012) y con
 * `resumen.md` como cuerpo de un issue público, solo trae el alias, el campo, el idioma y la estructura:
 * nunca el código, el veredicto, la propuesta, el comentario ni la marca temporal. No usa `tablaDe`.
 * Alias, campo y estructura salen como código en línea; el idioma es de un conjunto cerrado.
 */
export function seccionSinAutorizacion(envios: Envio[]): string {
  const respuestas = ultimasRespuestas(envios);
  if (respuestas.length === 0) return '';
  const filas = respuestas
    .map(({ revisor, r }) => ({ estructura: r.estructura, revisor, campo: r.campo, idioma: r.idioma ?? '' }))
    .sort((a, b) => cmp(a.estructura, b.estructura) || cmp(a.revisor, b.revisor) || cmp(a.campo, b.campo) || cmp(a.idioma, b.idioma));
  return [
    '## Descartadas: sin autorización',
    '',
    `${respuestas.length} respuestas de revisores sin ninguna autorización en \`Autorizaciones\`. No se aplican y, sin autorización de tratamiento de datos, aquí solo van el alias, el campo, el idioma y la estructura.`,
    '',
    '| Revisor (alias) | Campo | Idioma | Estructura |',
    '|---|---|---|---|',
    ...filas.map((f) => `| ${codigo(f.revisor)} | ${codigo(f.campo)} | ${f.idioma} | ${codigo(f.estructura)} |`),
  ].join('\n');
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Lo que un código del padrón con Activo distinto de `sí` aportó al CSV, por alias (nunca por código). */
export interface AporteInactivo {
  alias: string;
  /** Envíos de la pestaña Respuestas (`deHoja`) que se importaron. */
  aceptadas: number;
  /** Envíos del formulario de respaldo (o `v:1`) que se descartaron. */
  descartadasFormulario: number;
}

/**
 * Sección de `resumen.md` con los alias que tienen algún código del padrón con Activo distinto de `sí` y envíos en el
 * CSV (#257): cuántas filas de Respuestas se importaron y cuántas del formulario se descartaron. Solo alias y cuentas.
 * Devuelve '' si no hay ninguno.
 */
export function seccionInactivos(inactivos: AporteInactivo[]): string {
  if (inactivos.length === 0) return '';
  return [
    '## Códigos inactivos',
    '',
    'Alias con algún código del Padrón cuyo Activo no es `sí`. Las filas de la pestaña Respuestas se importaron igual; las del formulario de respaldo se descartaron. Si un código se filtró, revisa y borra de Respuestas las filas posteriores a la filtración y vuelve a importar.',
    '',
    '| Revisor (alias) | Filas de Respuestas importadas | Filas del formulario descartadas |',
    '|---|---|---|',
    ...inactivos.map((f) => `| ${codigo(f.alias)} | ${f.aceptadas} | ${f.descartadasFormulario} |`),
  ].join('\n');
}

/** Un solo resumen con todas las estructuras de la importación (un issue por importación). */
export function resumenConsolidado(
  envios: Envio[],
  versionDe: (id: string) => string,
  desconocidos = 0,
  vago: { descartadas: Envio[]; sinArchivo: boolean } = { descartadas: [], sinArchivo: false },
  sinAutorizacion: Envio[] = [],
  retiradas: MarcaRetirada[] = [],
  inactivos: AporteInactivo[] = [],
): string {
  const ids = [...new Set(envios.map((e) => e.estructura))].sort();
  const partes = ids.map((id) => resumenMarkdown(id, envios.filter((e) => e.estructura === id), versionDe(id)));
  const total = ultimasRespuestas(envios).length;
  const aviso = desconocidos
    ? [`Se descartaron ${desconocidos} envíos con un código que no está en el padrón de revisores.`, '']
    : [];
  const sinAut = seccionSinAutorizacion(sinAutorizacion);
  const sinVago = seccionSinVago(vago.descartadas, versionDe, vago.sinArchivo);
  const quitadas = seccionRetiradas(retiradas);
  const inactivas = seccionInactivos(inactivos);
  return [
    `# Revisiones docentes (${total} respuestas, ${ids.length} estructuras)`,
    '',
    ...aviso,
    ...(inactivas ? [inactivas] : []),
    ...partes,
    ...(quitadas ? [quitadas] : []),
    ...(sinAut ? [sinAut] : []),
    ...(sinVago ? [sinVago] : []),
  ].join('\n\n');
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
   * Respuestas únicas, del vago o no, de alias con algún código del padrón sin ninguna fila en
   * Autorizaciones. Salen solo en "Descartadas: sin autorización" y no se aplican; `null` si no se pasó el CSV.
   */
  sinAutorizacion: number | null;
  /** Alias (nunca códigos) de esas respuestas, en orden alfabético; vacío si no hay o no se pasó el CSV. */
  aliasSinAutorizacion: string[];
  /** Claves únicas que un retiro dejó sin ninguna respuesta (#217), de revisores del padrón; salen en "Marcas retiradas" de `resumen.md`. */
  retiradas: number;
  /** Por alias, lo que aportaron los códigos con Activo distinto de `sí` (#257), en orden alfabético; vacío si ninguno tuvo envíos. */
  inactivos: AporteInactivo[];
}

/**
 * Todo el trabajo del script de importación sin tocar el disco: el CSV entra como texto y salen los
 * archivos por escribir. Solo cuentan los envíos de estructuras que existen en `estructuras`.
 * `autorizacionesCsv` es el CSV de la pestaña Autorizaciones: las respuestas del vago (`esRespuestaDelVago`)
 * de un alias cuya última autorización no dice `vago = sí` salen solo en la sección "Descartadas: sin la
 * casilla del vago" de `resumen.md`, no en las tablas normales ni en `<id>.md`. Con `null` (sin archivo)
 * ninguna respuesta del vago entra al resumen. Los códigos del CSV solo sirven de llave y no salen en
 * ningún archivo. Con el CSV, todas las respuestas (del vago o no) de un alias con algún código del padrón
 * sin ninguna fila en Autorizaciones se apartan antes de separar las del vago: salen solo en la sección
 * "Descartadas: sin autorización" de `resumen.md` (alias, campo, idioma y estructura, sin texto libre) y
 * nunca en las tablas ni en los `<id>.md`. `sinAutorizacion` las cuenta y se devuelven sus alias.
 * Los retiros (#217, `quitarRetiradas`) se aplican justo después de leer, antes del padrón y de todo lo anterior: las
 * respuestas anteriores de la clave retirada de ese mismo revisor que llegaron en filas `v:2` de la pestaña Respuestas
 * (`deHoja`) no salen en las tablas, en los `<id>.md` ni en ninguna sección "Descartadas"; un retiro nunca quita lo del
 * formulario ni los `v:1`. `retiradas` cuenta, y "Marcas retiradas" de `resumen.md` lista, solo las claves que quedaron
 * sin ninguna respuesta (no las que un veredicto posterior o el formulario conservan), así que puede valer 0.
 * `inactivos` (#257): códigos del padrón con Activo distinto de `sí`. Sus envíos de la pestaña Respuestas (`deHoja`)
 * entran como los de cualquier código del padrón; los del formulario de respaldo (y los `v:1`) se descartan antes de
 * todo lo demás y no cuentan en `validos`. `Importacion.inactivos` y la sección "Códigos inactivos" de `resumen.md`
 * dicen, por alias, cuántos envíos se importaron y cuántos se descartaron. Sin ese conjunto, Activo no cambia nada.
 */
export function importar(
  csvTexto: string,
  estructuras: Record<string, { ficha: { version: string } | null }>,
  padron: Padron,
  autorizacionesCsv: string | null = null,
  inactivosDelPadron: ReadonlySet<string> = new Set(),
): Importacion {
  const ids = new Set(Object.keys(estructuras));
  const versionDe = (id: string) => estructuras[id]?.ficha?.version ?? 'sin-ficha';
  const todos = leerEnvios(parsearCsv(csvTexto), ids);
  // Activo (#257): lo que llegó por el formulario de respaldo de un código inactivo se descarta; lo de la pestaña Respuestas no.
  const aportes = new Map<string, AporteInactivo>();
  const leidos = {
    invalidas: todos.invalidas,
    envios: todos.envios.filter((e) => {
      if (!inactivosDelPadron.has(e.revisor) || !Object.hasOwn(padron, e.revisor)) return true;
      const alias = padron[e.revisor]!;
      const aporte = aportes.get(alias) ?? { alias, aceptadas: 0, descartadasFormulario: 0 };
      aportes.set(alias, aporte);
      if (e.deHoja) aporte.aceptadas++;
      else aporte.descartadasFormulario++;
      return e.deHoja === true;
    }),
  };
  const inactivos = [...aportes.values()].sort((a, b) => cmp(a.alias, b.alias));
  // Los retiros se aplican antes que el padrón, la autorización y la casilla del vago: lo retirado no sale en ninguna sección.
  const sinRetiradas = quitarRetiradas(leidos.envios);
  // Las cuentas (`validos`, `desconocidos`) son de los envíos leídos, también los que un retiro dejó sin nada.
  const { envios: conRetiros, desconocidos } = aplicarPadron(leidos.envios, padron);
  const { envios: conAlias } = aplicarPadron(sinRetiradas.envios, padron);
  // Con alias, sin repetir (dos códigos del mismo alias pueden retirar la misma clave); los códigos fuera del padrón no salen.
  const retiradas = [
    ...new Map(
      sinRetiradas.retiradas.flatMap((m) => (Object.hasOwn(padron, m.revisor) ? [{ ...m, revisor: padron[m.revisor]! }] : [])).map((m) => [JSON.stringify(m), m] as const),
    ).values(),
  ];
  const invalidas = leidos.invalidas;
  const codigos = autorizacionesCsv === null ? new Map<string, boolean>() : leerAutorizaciones(parsearCsv(autorizacionesCsv));
  // Falla cerrada: un alias solo puede con el vago si todos sus códigos del padrón tienen vago = sí.
  const porAlias = new Map<string, boolean>();
  for (const [c, alias] of Object.entries(padron)) porAlias.set(alias, (porAlias.get(alias) ?? true) && codigos.get(c) === true);
  // Falla cerrada también aquí: basta un código del alias sin fila en Autorizaciones para apartar todas las
  // respuestas del alias (de todos sus códigos), antes de separar las del vago. Sin el CSV no se sabe quién
  // autorizó y no se aparta nada.
  const sinFila = new Set<string>();
  if (autorizacionesCsv !== null) for (const [c, alias] of Object.entries(padron)) if (!codigos.has(c)) sinFila.add(alias);
  const apartadas = conAlias.filter((e) => sinFila.has(e.revisor));
  const conFila = conAlias.filter((e) => !sinFila.has(e.revisor));
  const { envios, sinVago } = separarSinVago(conFila, (a) => porAlias.get(a) === true);
  const afectadas = ultimasRespuestas(apartadas);
  const sinAutorizacion = autorizacionesCsv === null ? null : afectadas.length;
  const aliasSinAutorizacion = [...new Set(afectadas.map((a) => a.revisor))].sort();
  const porEstructura = new Map<string, Envio[]>();
  for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);
  const archivos = new Map<string, string>();
  for (const [id, lista] of porEstructura) archivos.set(`${id}.md`, resumenMarkdown(id, lista, versionDe(id)));
  archivos.set(
    'resumen.md',
    resumenConsolidado(envios, versionDe, desconocidos, { descartadas: sinVago, sinArchivo: autorizacionesCsv === null }, apartadas, retiradas, inactivos),
  );
  return {
    archivos,
    validos: conRetiros.length,
    invalidas,
    desconocidos,
    sinVago: ultimasRespuestas(sinVago).length,
    autorizaciones: autorizacionesCsv === null ? null : codigos.size,
    sinAutorizacion,
    aliasSinAutorizacion,
    retiradas: retiradas.length,
    inactivos,
  };
}

/**
 * Argumentos del script de importación: `respuestas.csv --padron <csv> [--autorizaciones <csv>]`, con las
 * banderas en cualquier posición. `--padron` es obligatorio (#257: el padrón es el CSV de la pestaña Padrón).
 * Devuelve null ante un uso indebido: sin CSV de respuestas, sin `--padron`, bandera sin valor, vacía o seguida
 * de otra bandera, bandera repetida o desconocida, o más de un posicional (también un JSON viejo como segundo).
 */
export function argumentosImportar(args: string[]): { csv: string; padron: string; autorizaciones?: string } | null {
  const posicionales: string[] = [];
  const banderas: { padron?: string; autorizaciones?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--autorizaciones' || a === '--padron') {
      const nombre = a === '--padron' ? 'padron' : 'autorizaciones';
      const valor = args[i + 1];
      if (banderas[nombre] !== undefined || !valor || valor.startsWith('--')) return null;
      banderas[nombre] = valor;
      i++;
    } else if (a.startsWith('--')) return null;
    else posicionales.push(a);
  }
  if (posicionales.length !== 1 || banderas.padron === undefined) return null;
  const res: { csv: string; padron: string; autorizaciones?: string } = { csv: posicionales[0]!, padron: banderas.padron };
  if (banderas.autorizaciones !== undefined) res.autorizaciones = banderas.autorizaciones;
  return res;
}
