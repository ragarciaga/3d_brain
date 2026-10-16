// Dobles para probar apps-script/Codigo.js (spec 03, T2): el script se carga en Node con `node:vm` y
// recibe dobles de SpreadsheetApp, CacheService, LockService y ContentService que siguen la
// documentación de Google. El oráculo real es la prueba manual del editor (docs/revision-docente.md).
// También guarda las tablas de casos que se pasan al script y a la app, para que exijan el mismo veredicto.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { VERSION_AUTORIZACION } from '../../../src/config/revision';
import { CLAVES_V2, cargaRevisionV2, type Respuesta } from '../../../src/lib/revision';

export const RUTA_SCRIPT = 'apps-script/Codigo.js';
export const MIME_JSON = 'application/json-doble';

export const CODIGO_ACTIVO = 'K7Q2M9XA';
export const CODIGO_GUION = '-K7Q2';
export const OTRO_ACTIVO = 'H3J5K8MP';
export const CODIGO_INACTIVO = 'N4R8T2WB';
export const CODIGO_AUSENTE = 'Z9Y8X7W6';

/** Padrón de prueba tal como lo llena el editor: código, alias, activo. */
export const PADRON_PRUEBA: string[][] = [
  [CODIGO_ACTIVO, 'D01', 'sí'],
  [CODIGO_GUION, 'D02', 'sí'],
  [OTRO_ACTIVO, 'D03', 'sí'],
  [CODIGO_INACTIVO, 'D04', 'no'],
];

export const CABECERAS = {
  Respuestas: ['Recibido', 'Código', 'Estructuras', 'Carga'],
  Autorizaciones: ['Código', 'Fecha', 'Versión', 'Vago'],
  Padrón: ['Código', 'Alias', 'Activo'],
} as const;

export type Celda = string | number | boolean;
export type NombreHoja = keyof typeof CABECERAS;

const TOPE_CELDA = 50000;

export interface Candado {
  esperas: number[];
  liberaciones: number;
  obtener: boolean;
  tomado: boolean;
  escriturasSinCandado: number;
}

/**
 * Hoja de Sheets. Modela lo que importa al script: una celda con texto que empieza con `=`, `+`, `-` o
 * `@` y sin formato `@` queda como fórmula; una celda no admite más de 50000 caracteres.
 */
export class HojaDoble {
  filas: Celda[][];
  /** Formato de cada celda, con clave `fila,columna` desde 1. */
  formatos = new Map<string, string>();
  /** Celdas que Sheets habría tomado como fórmula. */
  formulas = new Set<string>();
  falla = false;
  llamadasSetValues = 0;
  /** Veces que el script leyó la hoja entera (`getDataRange().getValues()`), para probar la caché del padrón. */
  lecturas = 0;

  constructor(
    cabecera: readonly string[],
    private readonly candado: Candado,
  ) {
    this.filas = [[...cabecera]];
  }

  getLastRow(): number {
    return this.filas.length;
  }

  getDataRange() {
    return {
      getValues: (): Celda[][] => {
        this.lecturas++;
        return this.filas.length ? this.filas.map((f) => [...f]) : [['']];
      },
    };
  }

  getRange(fila: number, columna: number, nFilas: number, nColumnas: number) {
    const celdas: [number, number][] = [];
    for (let i = 0; i < nFilas; i++) for (let j = 0; j < nColumnas; j++) celdas.push([fila + i, columna + j]);
    const rango = {
      setNumberFormat: (formato: string) => {
        for (const [f, c] of celdas) this.formatos.set(`${f},${c}`, formato);
        return rango;
      },
      setValues: (m: Celda[][]) => {
        this.llamadasSetValues++;
        if (this.falla) throw new Error('falla simulada de la hoja');
        if (m.length !== nFilas || m.some((f) => f.length !== nColumnas)) throw new Error('las dimensiones no coinciden');
        for (const f of m) for (const v of f) if (typeof v === 'string' && v.length > TOPE_CELDA) throw new Error('celda de más de 50000 caracteres');
        if (!this.candado.tomado) this.candado.escriturasSinCandado++;
        m.forEach((f, i) =>
          f.forEach((v, j) => {
            const clave = `${fila + i},${columna + j}`;
            if (typeof v === 'string' && /^[=+\-@]/.test(v) && this.formatos.get(clave) !== '@') this.formulas.add(clave);
            this.filas[fila - 1 + i] ??= [];
            this.filas[fila - 1 + i]![columna - 1 + j] = v;
          }),
        );
        return rango;
      },
    };
    return rango;
  }
}

export interface Reloj {
  ahora: number;
  avanzar(ms: number): void;
}

export interface Opciones {
  padron?: string[][];
  ahora?: number;
  sinPestana?: NombreHoja;
  /** Códigos con una fila en `Autorizaciones` con la versión de la app. Por defecto ninguno, como un código nuevo. */
  autorizados?: string[];
  /** Claves de CacheService para las que `put` lanza, como si el valor no cupiera. */
  putFalla?: (clave: string) => boolean;
}

export interface Salida {
  contenido: string;
  mime: string;
}

type Ctx = Record<string, unknown>;

/** Carga el script en un contexto nuevo y le pone los dobles. */
export function crearEntorno(op: Opciones = {}) {
  const reloj: Reloj = {
    ahora: op.ahora ?? Date.parse('2026-10-14T10:00:00.000Z'),
    avanzar(ms) {
      this.ahora += ms;
    },
  };
  const candado: Candado = { esperas: [], liberaciones: 0, obtener: true, tomado: false, escriturasSinCandado: 0 };
  const hojas: Record<NombreHoja, HojaDoble> = {
    Respuestas: new HojaDoble(CABECERAS.Respuestas, candado),
    Autorizaciones: new HojaDoble(CABECERAS.Autorizaciones, candado),
    Padrón: new HojaDoble(CABECERAS.Padrón, candado),
  };
  hojas.Padrón.filas.push(...(op.padron ?? PADRON_PRUEBA).map((f) => [...f]));
  hojas.Autorizaciones.filas.push(...(op.autorizados ?? []).map((c) => [c, '2026-10-14T09:00:00.000Z', VERSION_AUTORIZACION, 'no']));

  let flushes = 0;
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (n: string) => (n === op.sinPestana ? null : (Object.entries(hojas).find(([k]) => k === n)?.[1] ?? null)),
    }),
    flush: () => {
      flushes++;
    },
  };

  const almacen = new Map<string, { valor: string; vence: number }>();
  /** Segundos de vida de cada `put`, para comprobar que el contador no queda guardado de más. */
  const vidas: number[] = [];
  /** Cada `put` que llegó a guardar, con su clave y su vida en segundos. */
  const puts: { clave: string; segundos: number }[] = [];
  const CacheService = {
    getScriptCache: () => ({
      get(clave: string): string | null {
        const x = almacen.get(clave);
        return x && x.vence > reloj.ahora ? x.valor : null;
      },
      put(clave: string, valor: string, segundos = 600) {
        if (typeof valor !== 'string') throw new Error('CacheService solo guarda texto');
        if (op.putFalla?.(clave)) throw new Error('falla simulada de la caché');
        vidas.push(segundos);
        puts.push({ clave, segundos });
        almacen.set(clave, { valor, vence: reloj.ahora + segundos * 1000 });
      },
    }),
  };

  const tryLock = (ms: number) => {
    candado.esperas.push(ms);
    if (!candado.obtener) return false;
    candado.tomado = true;
    return true;
  };
  const LockService = {
    getScriptLock: () => ({
      tryLock,
      waitLock(ms: number) {
        if (!tryLock(ms)) throw new Error('Tiempo de espera agotado');
      },
      releaseLock() {
        candado.liberaciones++;
        candado.tomado = false;
      },
    }),
  };

  const salidas: Salida[] = [];
  const ContentService = {
    MimeType: { JSON: MIME_JSON },
    createTextOutput(texto: string) {
      const salida: Salida = { contenido: texto, mime: '' };
      salidas.push(salida);
      const objeto = {
        setMimeType(m: string) {
          salida.mime = m;
          return objeto;
        },
        getContent: () => texto,
        getMimeType: () => salida.mime,
      };
      return objeto;
    },
  };

  const ctx = vm.createContext({ SpreadsheetApp, CacheService, LockService, ContentService }) as Ctx;
  vm.runInContext(readFileSync(RUTA_SCRIPT, 'utf8'), ctx);
  // La hora del script sale solo de Date.now(): esta es la costura del reloj.
  (vm.runInContext('Date', ctx) as { now: () => number }).now = () => reloj.ahora;

  const doGet = vm.runInContext('doGet', ctx) as (e: unknown) => { getContent(): string };
  const doPost = vm.runInContext('doPost', ctx) as (e: unknown) => { getContent(): string };

  return {
    hojas,
    reloj,
    candado,
    salidas,
    vidas,
    puts,
    flushes: () => flushes,
    /** Deja un valor en la caché como si otra ejecución del script lo hubiera guardado. */
    sembrarCache(clave: string, valor: string, segundos = 600) {
      almacen.set(clave, { valor, vence: reloj.ahora + segundos * 1000 });
    },
    /** POST `{accion:'leer', r}`: la forma de la app. */
    postLeer(codigo: unknown): Record<string, unknown> {
      const cuerpo = JSON.stringify({ accion: 'leer', r: codigo });
      const length = Buffer.byteLength(cuerpo, 'utf8');
      return JSON.parse(doPost({ postData: { contents: cuerpo, type: 'text/plain', length }, parameter: {} }).getContent()) as Record<string, unknown>;
    },
    post(cuerpo: string): Record<string, unknown> {
      const length = Buffer.byteLength(cuerpo, 'utf8');
      return JSON.parse(doPost({ postData: { contents: cuerpo, type: 'text/plain', length }, parameter: {} }).getContent()) as Record<string, unknown>;
    },
    /** POST sin cuerpo (`e.postData` ausente), como llega una petición vacía. */
    postSinCuerpo(): Record<string, unknown> {
      return JSON.parse(doPost({ parameter: {} }).getContent()) as Record<string, unknown>;
    },
    get(parametros: Record<string, string>): Record<string, unknown> {
      return JSON.parse(doGet({ parameter: parametros }).getContent()) as Record<string, unknown>;
    },
    /** Una función de nivel superior del script. */
    fn<T extends (...args: never[]) => unknown>(nombre: string): T {
      return vm.runInContext(nombre, ctx) as T;
    },
    /** Filas escritas en una pestaña, sin la cabecera. */
    escritas: (n: NombreHoja) => hojas[n].filas.slice(1),
  };
}

export type Entorno = ReturnType<typeof crearEntorno>;

/** Filas totales (con cabecera) de las tres pestañas, para comprobar que nada se escribió. */
export const conteoFilas = (env: Entorno) => ({
  Respuestas: env.hojas.Respuestas.filas.length,
  Autorizaciones: env.hojas.Autorizaciones.filas.length,
  Padrón: env.hojas.Padrón.filas.length,
});

// ---------------------------------------------------------------------------------------------
// Tablas de casos compartidas por el script y la app. Las de respuestas y fechas se copian de
// tests/revisiones.test.ts y tests/revision.test.ts, que no se tocan.
// ---------------------------------------------------------------------------------------------

const base = { idioma: 'es' as const, version: '0.1.0', fecha: '2026-10-11T10:00:00.000Z' };
const buena = { ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto' };
const hostiles = ['[x](https://e.example)', '<a href="https://e.example">x</a>', '#123', 'owner/repo#123', 'a b'];

/** [nombre, respuesta, ¿vale?]: se pasan a `respuestaValida` del script y de la app. */
export const casosRespuesta: [string, unknown, boolean][] = [
  ...(
    [
      ['veredicto fuera del conjunto', { ...buena, veredicto: 'aprobado' }],
      ['veredicto ausente', { ...buena, veredicto: undefined }],
      ['idioma distinto de es y en', { ...buena, idioma: 'fr' }],
      ['idioma que no es texto', { ...buena, idioma: 5 }],
      ['campo que no es texto', { ...buena, campo: 7 }],
      ['campo ausente', { ...buena, campo: undefined }],
      ['propuesta que no es texto', { ...buena, propuesta: { a: 1 } }],
      ['comentario que no es texto', { ...buena, comentario: ['x'] }],
      ['version que no es texto', { ...buena, version: 1 }],
      ['malla que no es texto', { ...buena, malla: 3 }],
      ['ramo que no es texto', { ...buena, ramo: null }],
      ['posicion que no es un arreglo', { ...buena, posicion: '1,2,3' }],
      ['posicion con dos números', { ...buena, posicion: [1, 2] }],
      ['posicion con cuatro números', { ...buena, posicion: [1, 2, 3, 4] }],
      ['posicion con un texto', { ...buena, posicion: [1, '2', 3] }],
      ['posicion con un valor no finito', { ...buena, posicion: [1, 2, null] }],
      ['posicion con infinito', { ...buena, posicion: [1, Infinity, 3] }],
      ['respuesta que no es un objeto', null],
      ['respuesta que es un texto', 'hola'],
      ['respuesta que es un arreglo', [buena]],
      ['estructura con forma de ruta', { ...buena, estructura: '../../x' }],
      ['estructura que no es texto', { ...buena, estructura: 5 }],
      ['estructura ausente', { ...buena, estructura: undefined }],
      ...hostiles.map((h): [string, unknown] => [`campo ${h}`, { ...buena, campo: h }]),
      ...hostiles.map((h): [string, unknown] => [`version ${h}`, { ...buena, version: h }]),
      ['campo trazo con comilla invertida', { ...buena, campo: 'trazo:a`b' }],
      ['campo trazo con barra vertical', { ...buena, campo: 'trazo:a|b' }],
      ['campo trazo con ángulos', { ...buena, campo: 'trazo:<img>' }],
      ['campo trazo con salto de línea', { ...buena, campo: 'trazo:a\nb' }],
      ['campo trazo vacío', { ...buena, campo: 'trazo:' }],
      ['campo trazo con 121 caracteres tras el prefijo', { ...buena, campo: `trazo:${'a'.repeat(121)}` }],
      ['campo en mayúsculas', { ...buena, campo: 'Nombre' }],
      ['campo con índice sin número', { ...buena, campo: 'fuente.x' }],
      ['version incompleta', { ...buena, version: '0.1' }],
      ['version con sufijo', { ...buena, version: '0.1.0-x' }],
      ['propuesta de 4001 caracteres', { ...buena, propuesta: 'a'.repeat(4001) }],
      ['comentario de 4001 caracteres', { ...buena, comentario: 'a'.repeat(4001) }],
      ['malla de 201 caracteres', { ...buena, malla: 'a'.repeat(201) }],
      ['ramo de 201 caracteres', { ...buena, ramo: 'a'.repeat(201) }],
    ] as [string, unknown][]
  ).map(([n, r]): [string, unknown, boolean] => [n, r, false]),
  ...(
    [
      ['idioma ausente', { ...buena, idioma: undefined }],
      ['idioma en', { ...buena, idioma: 'en' }],
      ['posición de tres números finitos con todos los textos', { ...buena, campo: 'posicion', posicion: [0, -1.5, 2], propuesta: 'x', comentario: 'y', malla: 'm', ramo: 'r' }],
      ...['nombre', 'latin', 'pieza', 'ubicacion', 'que_es', 'para_que_sirve', 'relaciones', 'relevancia.0', 'fuente.12', 'posicion', 'trazo:Vagus_nerve.R (rama) 01'].map((campo): [string, unknown] => [`campo ${campo}`, { ...buena, campo }]),
      ['version sin-ficha', { ...buena, version: 'sin-ficha' }],
      ['textos justo en el tope', { ...buena, propuesta: 'a'.repeat(4000), comentario: 'b'.repeat(4000), malla: 'c'.repeat(200), ramo: 'd'.repeat(200), campo: `trazo:${'e'.repeat(120)}` }],
    ] as [string, unknown][]
  ).map(([n, r]): [string, unknown, boolean] => [n, r, true]),
];

/** [nombre, valor, ¿vale?]: se pasan a `fechaValida` del script y de la app. */
export const casosFecha: [string, unknown, boolean][] = [
  ['una fecha ISO', '2026-10-14T10:00:00.000Z', true],
  ['una cadena parseable de 40 caracteres', `2026-10-10T10:00:00.${'0'.repeat(19)}Z`, true],
  ['una cadena parseable de 41 caracteres', `2026-10-10T10:00:00.${'0'.repeat(20)}Z`, false],
  ['un número', 1760000000000, false],
  ['null', null, false],
  ['undefined', undefined, false],
  ['un objeto', { a: 1 }, false],
  ['un texto vacío', '', false],
  ['un texto ilegible', 'ayer', false],
  ['fecha con espacio', '2026-10-14 10:00', true],
  ['fecha en inglés', 'Oct 14 2026', true],
];

const bueno = { c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0' };
const v2 = (e: unknown, r: unknown = CODIGO_ACTIVO) => ({ v: 2, r, e });
const f40 = `2026-10-10T10:00:00.${'0'.repeat(19)}Z`;

/** Una respuesta larga pasada a la forma corta de la carga `v:2`. */
function aCorta(r: Record<string, unknown>): Record<string, unknown> {
  const corta: Record<string, unknown> = {};
  for (const [largo, clave] of Object.entries(CLAVES_V2)) if (r[largo] !== undefined) corta[clave] = r[largo];
  return corta;
}

/**
 * [nombre, texto de la carga, ¿vale?]: cada texto va como `carga` de `guardar` al script y como celda D
 * a `leerEnvios` de la app. El código por defecto es `CODIGO_ACTIVO`.
 */
export const casosCarga: [string, string, boolean][] = [
  ...(
    [
      ['e es un arreglo', v2([bueno])],
      ['e es un arreglo de arreglos', v2([[bueno]])],
      ['e está vacío', v2({})],
      ['e es un texto', v2('hippocampus')],
      ['e ausente', { v: 2, r: CODIGO_ACTIVO }],
      ['clave con forma de ruta', v2({ '../../../AGENTS': [bueno] })],
      ['clave con mayúsculas', v2({ Hippocampus: [bueno] })],
      ['una clave buena y otra de ruta', v2({ hippocampus: [bueno], '../x': [bueno] })],
      ['valor que no es arreglo', v2({ hippocampus: bueno })],
      ['arreglo vacío', v2({ hippocampus: [] })],
      ['elemento null', v2({ hippocampus: [bueno, null] })],
      ['elemento que es un texto', v2({ hippocampus: ['hola'] })],
      ['elemento que es un arreglo', v2({ hippocampus: [[bueno]] })],
      ['veredicto fuera del conjunto', v2({ hippocampus: [{ ...bueno, d: 'aprobado' }] })],
      ['campo con almohadilla', v2({ hippocampus: [{ ...bueno, c: '#123' }] })],
      ['versión que no es semántica', v2({ hippocampus: [{ ...bueno, s: '0.1' }] })],
      ['versión ausente', v2({ hippocampus: [{ c: 'a', d: 'correcto' }] })],
      ['propuesta de 4001 caracteres', v2({ hippocampus: [{ ...bueno, p: 'x'.repeat(4001) }] })],
      ['comentario de 4001 caracteres', v2({ hippocampus: [{ ...bueno, k: 'x'.repeat(4001) }] })],
      ['posición con dos números', v2({ hippocampus: [{ ...bueno, x: [1, 2] }] })],
      ['idioma fr', v2({ hippocampus: [{ ...bueno, i: 'fr' }] })],
      ['malla que no es texto', v2({ hippocampus: [{ ...bueno, m: 3 }] })],
      ['ramo de 201 caracteres', v2({ hippocampus: [{ ...bueno, a: 'x'.repeat(201) }] })],
      ['f de 41 caracteres', v2({ hippocampus: [{ ...bueno, f: `2026-10-10T10:00:00.${'0'.repeat(20)}Z` }] })],
      ['f que no es texto', v2({ hippocampus: [{ ...bueno, f: 1760000000000 }] })],
      ['f no parseable', v2({ hippocampus: [{ ...bueno, f: 'ayer' }] })],
      ['f vacía', v2({ hippocampus: [{ ...bueno, f: '' }] })],
      ['una respuesta mala entre buenas', v2({ hippocampus: [bueno, { ...bueno, c: 'otro' }], 'm-periaqueductal-grey': [{ ...bueno, d: 'x' }] })],
      ['revisor ausente', { v: 2, e: { hippocampus: [bueno] } }],
      ['revisor con punto', v2({ hippocampus: [bueno] }, 'ANA.PEREZ')],
      ['revisor que no es texto', v2({ hippocampus: [bueno] }, 7)],
      ['revisor vacío', v2({ hippocampus: [bueno] }, '')],
      ['revisor de 41 caracteres', v2({ hippocampus: [bueno] }, 'x'.repeat(41))],
      ['v igual a 3 con forma v:2', { ...v2({ hippocampus: [bueno] }), v: 3 }],
      ['v igual a 1 con forma v:2', { ...v2({ hippocampus: [bueno] }), v: 1 }],
      ['v texto "2"', { ...v2({ hippocampus: [bueno] }), v: '2' }],
      ['v ausente', { r: CODIGO_ACTIVO, e: { hippocampus: [bueno] } }],
    ] as [string, object][]
  ).map(([n, c]): [string, string, boolean] => [n, JSON.stringify(c), false]),
  [
    'posición con un número que JSON lee como infinito (1e999)',
    JSON.stringify(v2({ hippocampus: [{ ...bueno, c: 'posicion', x: [0, 0, 0] }] })).replace('[0,0,0]', '[0,1e999,0]'),
    false,
  ],
  ['una clave __proto__ en e (JSON crudo)', `{"v":2,"r":"${CODIGO_ACTIVO}","e":{"__proto__":[{"c":"a","d":"correcto","s":"0.1.0"}]}}`, false],
  ['el JSON de la carga está roto', `{"v":2,"r":"${CODIGO_ACTIVO}","e":{"hippocampus":[`, false],
  // Las que valen.
  ...(
    [
      ['una respuesta mínima', v2({ hippocampus: [bueno] })],
      ['dos estructuras', v2({ hippocampus: [bueno], 'm-periaqueductal-grey': [{ ...bueno, s: 'sin-ficha' }] })],
      ['una f de 40 caracteres', v2({ hippocampus: [{ ...bueno, f: f40 }] })],
      ['una f ISO y una respuesta sin f', v2({ hippocampus: [{ ...bueno, f: '2026-10-14T10:00:00.000Z' }, { ...bueno, c: 'que_es' }] })],
      ['un código con guion inicial', v2({ hippocampus: [bueno] }, CODIGO_GUION)],
      ['un id con guion inicial', v2({ '-x': [bueno] })],
      ['un id llamado constructor', v2({ constructor: [bueno] })],
    ] as [string, object][]
  ).map(([n, c]): [string, string, boolean] => [n, JSON.stringify(c), true]),
  [
    'cargaRevisionV2 con todos los campos',
    cargaRevisionV2(CODIGO_ACTIVO, [
      { estructura: 'hippocampus', campo: 'relaciones', veredicto: 'corregir', propuesta: 'p', comentario: 'k', version: '0.1.0', fecha: '2026-10-14T08:00:00.000Z' },
      { estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [1, 2.5, -3], malla: 'Vagus_nerve.R', ramo: 'no_se', version: 'sin-ficha', fecha: '2026-10-14T08:01:00.000Z' },
      { estructura: 'm-periaqueductal-grey', campo: 'trazo:Vagus_nerve.R (rama) 01', idioma: 'en', veredicto: 'no_es_mi_area', version: 'sin-ficha', fecha: '2026-10-14T08:02:00.000Z' },
    ]),
    true,
  ],
  // Cada respuesta aceptada de `casosRespuesta`, como carga `v:2` de una sola respuesta.
  ...casosRespuesta
    .filter(([, , vale]) => vale)
    .map(([n, r]): [string, string, boolean] => {
      const { estructura, ...resto } = r as Respuesta;
      return [`carga con ${n}`, JSON.stringify(v2({ [estructura]: [aCorta({ ...resto, fecha: undefined })] })), true];
    }),
  // Cada respuesta rechazada de `casosRespuesta` (con objeto y estructura válidos), como carga `v:2`.
  ...casosRespuesta
    .filter(([, r, vale]) => !vale && typeof r === 'object' && r !== null && !Array.isArray(r) && (r as Record<string, unknown>)['estructura'] === 'hippocampus')
    .map(([n, r]): [string, string, boolean] => {
      const { estructura, ...resto } = r as Respuesta;
      return [`carga con ${n}`, JSON.stringify(v2({ [estructura]: [aCorta({ ...resto, fecha: undefined })] })), false];
    }),
];
