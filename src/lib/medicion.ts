// Medición de carga en los equipos de referencia (issue 6). Funciones puras: reciben lo que el
// navegador reporta (Performance API) y devuelven un resumen y un informe en texto para copiar.
// El panel que las usa solo aparece con ?medir=1 en la dirección.

/** Marcas que pone la app (performance.mark) en los momentos clave de la carga. */
export const MARCA_INICIO_APP = 'atlas:inicio-app';
export const MARCA_MODELO_LISTO = 'atlas:modelo-listo';
export const MARCA_PRIMER_CUADRO = 'atlas:primer-cuadro';
/** El visor recibió el modelo ya leído (parseado y decodificado). */
export const MARCA_MODELO_LEIDO = 'atlas:modelo-leido';
/** Empezó a armarse el índice de toque (árboles BVH): después del primer cuadro. */
export const MARCA_INDICE_INICIO = 'atlas:indice-inicio';
/** Terminó de armarse el índice de toque (árboles BVH) de las mallas, también después del primer cuadro. Se mide desde `MARCA_INDICE_INICIO`. */
export const MARCA_INDICE_TOQUE = 'atlas:indice-toque';

/** Lo que interesa de cada recurso descargado (PerformanceResourceTiming). */
export interface Recurso {
  name: string;
  startTime: number;
  responseEnd: number;
  transferSize: number;
  decodedBodySize: number;
  /** Cuerpo comprimido: vale lo mismo en frío y desde la memoria del navegador. */
  encodedBodySize: number;
}

export interface DatosCarga {
  recursos: Recurso[];
  marcas: Partial<Record<string, number>>;
}

export interface ResumenCarga {
  /** Código descargado y corriendo: la app arrancó (ms desde que se pidió la página). */
  codigoListoMs: number | null;
  codigoKB: number;
  modeloInicioMs: number | null;
  /** Solo la descarga del modelo, desde que se pidió hasta que llegó el último byte. */
  modeloDescargaMs: number | null;
  modeloKB: number;
  /** El modelo vino de la memoria del navegador (no se descargó de nuevo). */
  modeloDesdeCache: boolean;
  /** Cuánto se esperó el modelo después de que el código estuvo listo (0 si llegó antes). */
  modeloEsperaMs: number | null;
  /**
   * Preparar el modelo desde que estaban listos el modelo y el código: descomprimir, armar las
   * piezas y sus cajas. Es la suma de `leerModeloMs` y `armarPiezasMs`; el índice de toque ya no entra.
   */
  procesamientoMs: number | null;
  /** Parseo y decodificación, hasta que el visor recibe el modelo leído. */
  leerModeloMs: number | null;
  /** Cuánto tardó armar los árboles BVH del toque, desde que empezó hasta que quedó listo (ocurre después del primer cuadro). */
  indiceToqueMs: number | null;
  /** A qué hora empezó el índice de toque (ms desde que se pidió la página). */
  indiceInicioMs: number | null;
  /** A qué hora quedó listo el índice de toque (ms desde que se pidió la página). */
  indiceListoMs: number | null;
  /** Desde el modelo leído hasta que el modelo está listo: piezas, cajas y centros. */
  armarPiezasMs: number | null;
  modeloListoMs: number | null;
  primerCuadroMs: number | null;
}

/** Scripts de la app: empaquetados en /assets/*.js al publicar, o módulos sueltos en desarrollo. */
const esCodigo = (r: Recurso) => /\.(m?js|tsx?)(\?|$)/.test(r.name);
const esModelo = (r: Recurso) => /atlas\.glb(\?|$)/.test(r.name);
const kb = (bytes: number) => Math.round(bytes / 1024);
const redondo = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n));

export function resumirCarga(d: DatosCarga): ResumenCarga {
  const codigo = d.recursos.filter(esCodigo);
  // Con la precarga del HTML puede haber más de una entrada: cuenta la primera con cuerpo (la
  // descarga real, no una petición fallida) y, si ninguna lo tiene, la última.
  const entradasModelo = d.recursos.filter(esModelo);
  const modelo = entradasModelo.find((r) => r.decodedBodySize > 0) ?? entradasModelo.at(-1);
  const modeloListo = d.marcas[MARCA_MODELO_LISTO];
  const codigoListo = d.marcas[MARCA_INICIO_APP] ?? (codigo.length ? Math.max(...codigo.map((r) => r.responseEnd)) : undefined);
  const leido = d.marcas[MARCA_MODELO_LEIDO];
  const indiceInicio = d.marcas[MARCA_INDICE_INICIO];
  const indice = d.marcas[MARCA_INDICE_TOQUE];
  const inicioPreparacion = modelo ? Math.max(modelo.responseEnd, codigoListo ?? modelo.responseEnd) : undefined;
  return {
    codigoListoMs: redondo(codigoListo),
    // Cuerpo comprimido: igual en frío y desde la memoria del navegador (decodedBodySize inflaría la cifra).
    codigoKB: kb(codigo.reduce((s, r) => s + (r.encodedBodySize || r.transferSize), 0)),
    modeloInicioMs: redondo(modelo?.startTime),
    modeloDescargaMs: modelo ? redondo(modelo.responseEnd - modelo.startTime) : null,
    modeloKB: kb(modelo ? modelo.transferSize || modelo.decodedBodySize : 0),
    modeloDesdeCache: !!modelo && modelo.transferSize === 0 && modelo.decodedBodySize > 0,
    modeloEsperaMs: modelo && codigoListo !== undefined ? redondo(Math.max(0, modelo.responseEnd - codigoListo)) : null,
    procesamientoMs:
      inicioPreparacion !== undefined && modeloListo !== undefined
        ? redondo(Math.max(0, modeloListo - inicioPreparacion))
        : null,
    leerModeloMs:
      inicioPreparacion !== undefined && leido !== undefined ? redondo(Math.max(0, leido - inicioPreparacion)) : null,
    indiceToqueMs:
      indiceInicio !== undefined && indice !== undefined ? redondo(Math.max(0, indice - indiceInicio)) : null,
    indiceInicioMs: redondo(indiceInicio),
    indiceListoMs: redondo(indice),
    armarPiezasMs: leido !== undefined && modeloListo !== undefined ? redondo(Math.max(0, modeloListo - leido)) : null,
    modeloListoMs: redondo(modeloListo),
    primerCuadroMs: redondo(d.marcas[MARCA_PRIMER_CUADRO]),
  };
}

export type Cuello = 'codigo' | 'modelo' | 'procesamiento';

/**
 * Qué parte pesó más en la espera hasta ver el cerebro: la descarga del código, la espera por el
 * modelo después del código o preparar el modelo. Null mientras falten datos.
 */
export function cuelloDeBotella(r: ResumenCarga): Cuello | null {
  if (r.codigoListoMs === null || r.modeloEsperaMs === null || r.procesamientoMs === null) return null;
  const partes: [Cuello, number][] = [
    ['codigo', r.codigoListoMs],
    ['modelo', r.modeloEsperaMs],
    ['procesamiento', r.procesamientoMs],
  ];
  return partes.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export interface Equipo {
  navegador: string;
  pantalla: string;
  nucleos: number | null;
  memoriaGB: number | null;
  gpu: string;
  /** Densidad de píxeles del visor (issue 84); null mientras no hay dato. */
  densidad: { valor: number; fija: boolean } | null;
}

export interface Fluidez {
  promedio: number;
  minimo: number;
  muestras: number;
}

/** Promedio y mínimo de cuadros por segundo de una serie de muestras (null si no hay ninguna). */
export function resumirFluidez(muestras: number[]): Fluidez | null {
  const validas = muestras.filter((n) => Number.isFinite(n) && n > 0);
  if (!validas.length) return null;
  return {
    promedio: Math.round(validas.reduce((s, n) => s + n, 0) / validas.length),
    minimo: Math.min(...validas),
    muestras: validas.length,
  };
}

/**
 * Ventana de la fluidez, en ms después del primer cuadro. El primer segundo es arranque y compilación
 * de sombreadores: no habla de qué tan fluido va el visor.
 */
export const FLUIDEZ_DESDE_MS = 1_000;
export const FLUIDEZ_HASTA_MS = 10_000;

/**
 * Si el panel sigue leyendo las marcas: hasta que pase la ventana de fluidez Y el índice de toque esté listo (el índice
 * llega después del primer cuadro y en un equipo lento puede pasar de los 10 s).
 */
export function seguirLeyendo(ahora: number, primerCuadro: number | null, indiceListo: number | null): boolean {
  return !(primerCuadro !== null && ahora - primerCuadro > FLUIDEZ_HASTA_MS && indiceListo !== null);
}

/** Una muestra cuenta si su intervalo [desde, hasta] cae entero dentro de la ventana de fluidez. */
export function muestraEnVentana(desde: number, hasta: number, primerCuadro: number): boolean {
  return desde >= primerCuadro + FLUIDEZ_DESDE_MS && hasta <= primerCuadro + FLUIDEZ_HASTA_MS;
}

/** Lo que lleva la fluidez entre lecturas: cuándo fue la lectura anterior y las muestras que cuentan. */
export interface EstadoFluidez {
  anterior: number;
  muestras: number[];
}

/**
 * Decide qué hace una lectura de cuadros por segundo con la fluidez. Cada lectura nueva (cambia
 * `muestras`, aunque el valor de `fps` se repita) es una muestra que cubre el intervalo desde la
 * lectura anterior hasta `ahora`; cuenta solo si ese intervalo cae entero en la ventana.
 */
export function acumularFluidez(
  estado: EstadoFluidez,
  s: { fps: number; muestras: number },
  antes: { fps: number; muestras: number },
  ahora: number,
  primerCuadro: number | undefined,
): void {
  if (s.muestras === antes.muestras) return;
  if (primerCuadro !== undefined && muestraEnVentana(estado.anterior, ahora, primerCuadro)) estado.muestras.push(s.fps);
  estado.anterior = ahora;
}

/** "Lo más lento" solo se dice si el cerebro tardó más de esto en verse (primer cuadro). */
export const UMBRAL_LENTO_MS = 3_000;

export function cargaLenta(r: ResumenCarga): boolean {
  return r.primerCuadroMs !== null && r.primerCuadroMs > UMBRAL_LENTO_MS;
}

const ms = (n: number | null) => (n === null ? 'sin dato' : `${n} ms`);
const CUELLO: Record<Cuello, string> = {
  codigo: 'la descarga del código',
  modelo: 'la descarga del modelo 3D',
  procesamiento: 'preparar el modelo en el equipo',
};

/** Informe en texto plano, igual en todos los equipos, para copiar y comparar. */
export function informe(r: ResumenCarga, e: Equipo, f: Fluidez | null, fecha: string): string {
  const c = cuelloDeBotella(r);
  return [
    `Maysa Brain, medición de carga (${fecha})`,
    `Navegador: ${e.navegador}`,
    `Pantalla: ${e.pantalla}`,
    `Densidad de píxeles del visor: ${e.densidad ? `${String(e.densidad.valor).replace('.', ',')} ${e.densidad.fija ? '(fija con ?dpr)' : '(automática)'}` : 'sin dato'}`,
    `Núcleos: ${e.nucleos ?? 'sin dato'} · Memoria: ${e.memoriaGB === null ? 'sin dato' : `${e.memoriaGB} GB`}`,
    `GPU: ${e.gpu || 'sin dato'}`,
    `Código listo: ${ms(r.codigoListoMs)} (${r.codigoKB} KB)`,
    `Modelo 3D: empezó a los ${ms(r.modeloInicioMs)}, descarga ${ms(r.modeloDescargaMs)} (${r.modeloDesdeCache ? 'desde la memoria del navegador' : `${r.modeloKB} KB`}), espera después del código ${ms(r.modeloEsperaMs)}`,
    `Preparar el modelo: ${ms(r.procesamientoMs)}`,
    `  Leer el modelo (parseo y decodificación): ${ms(r.leerModeloMs)}`,
    `  Armar las piezas y sus cajas: ${ms(r.armarPiezasMs)}`,
    `Modelo listo: ${ms(r.modeloListoMs)} · Primer cuadro: ${ms(r.primerCuadroMs)}`,
    `Índice de toque (árboles BVH): ${ms(r.indiceToqueMs)} (empezó a los ${ms(r.indiceInicioMs)}, listo a los ${ms(r.indiceListoMs)})`,
    `Cuadros por segundo (de 1 a 10 s tras el primer cuadro): ${f ? `promedio ${f.promedio}, mínimo ${f.minimo}` : 'midiendo'}`,
    ...(cargaLenta(r) ? [`Lo más lento: ${c ? CUELLO[c] : 'sin dato'}`] : []),
  ].join('\n');
}
