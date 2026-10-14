// Medición de carga en los equipos de referencia (issue 6). Funciones puras: reciben lo que el
// navegador reporta (Performance API) y devuelven un resumen y un informe en texto para copiar.
// El panel que las usa solo aparece con ?medir=1 en la dirección.

/** Marcas que pone la app (performance.mark) en los momentos clave de la carga. */
export const MARCA_INICIO_APP = 'atlas:inicio-app';
export const MARCA_MODELO_LISTO = 'atlas:modelo-listo';
export const MARCA_PRIMER_CUADRO = 'atlas:primer-cuadro';

/** Lo que interesa de cada recurso descargado (PerformanceResourceTiming). */
export interface Recurso {
  name: string;
  startTime: number;
  responseEnd: number;
  transferSize: number;
  decodedBodySize: number;
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
   * piezas y sus cajas.
   */
  procesamientoMs: number | null;
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
  return {
    codigoListoMs: redondo(codigoListo),
    codigoKB: kb(codigo.reduce((s, r) => s + (r.transferSize || r.decodedBodySize), 0)),
    modeloInicioMs: redondo(modelo?.startTime),
    modeloDescargaMs: modelo ? redondo(modelo.responseEnd - modelo.startTime) : null,
    modeloKB: kb(modelo ? modelo.transferSize || modelo.decodedBodySize : 0),
    modeloDesdeCache: !!modelo && modelo.transferSize === 0 && modelo.decodedBodySize > 0,
    modeloEsperaMs: modelo && codigoListo !== undefined ? redondo(Math.max(0, modelo.responseEnd - codigoListo)) : null,
    procesamientoMs:
      modelo && modeloListo !== undefined
        ? redondo(Math.max(0, modeloListo - Math.max(modelo.responseEnd, codigoListo ?? modelo.responseEnd)))
        : null,
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
    `Modelo listo: ${ms(r.modeloListoMs)} · Primer cuadro: ${ms(r.primerCuadroMs)}`,
    `Cuadros por segundo (10 s): ${f ? `promedio ${f.promedio}, mínimo ${f.minimo}` : 'midiendo'}`,
    `Lo más lento: ${c ? CUELLO[c] : 'sin dato'}`,
  ].join('\n');
}
