// Densidad de píxeles adaptativa (issue 84, medición #6). Lógica pura, sin React ni three: decide el tope
// de la densidad del lienzo a partir de los cuadros por segundo que mide MedidorCuadros (una muestra cada
// 0,5 s). En equipos lentos baja el tope un paso (2, 1,5, 1); en equipos holgados lo vuelve a subir, pocas
// veces, para no oscilar. El umbral final sale de la medición manual en el Tecno Spark 8C (#6).

/** Topes de densidad por nivel: el nivel 0 es el de hoy (`[1, 2]`). Nunca baja de 1. */
export const TOPES_DPR = [2, 1.5, 1] as const;
/** Por debajo de estos cuadros por segundo, la muestra cuenta como lenta. */
export const FPS_BAJO = 30;
/** Desde estos cuadros por segundo, la muestra cuenta como holgada. */
export const FPS_ALTO = 55;
/** Muestras lentas seguidas para bajar un paso (unos 3 s a 0,5 s por muestra). */
export const MUESTRAS_BAJAR = 6;
/** Muestras holgadas seguidas para subir un paso (unos 10 s). */
export const MUESTRAS_SUBIR = 20;
/** Subidas máximas por visita: después solo puede bajar. */
export const MAX_SUBIDAS = 2;
/** Rango que acepta `?dpr=<n>`. */
export const DPR_FIJO_MIN = 0.5;
export const DPR_FIJO_MAX = 3;

export interface EstadoDensidad {
  /** Índice en `TOPES_DPR`. */
  nivel: number;
  /** Muestras lentas seguidas. */
  bajas: number;
  /** Muestras holgadas seguidas. */
  altas: number;
  /** Veces que el tope ha subido en esta visita. */
  subidas: number;
}

export const DENSIDAD_INICIAL: EstadoDensidad = { nivel: 0, bajas: 0, altas: 0, subidas: 0 };

/**
 * Estado siguiente tras una muestra de cuadros por segundo. Pura: devuelve siempre un objeto nuevo.
 * `valida` es falso cuando la muestra no sirve (modelo sin cargar, pestaña oculta).
 */
export function siguienteDensidad(e: EstadoDensidad, fps: number, valida: boolean): EstadoDensidad {
  // Una lectura de 0 es finita y válida: MedidorCuadros redondea y un cuadro de más de 2 s da 0. Es el
  // equipo más lento, así que cuenta como lenta. Se reinicia con muestra no válida, NaN, Infinity o negativa.
  if (!valida || !Number.isFinite(fps) || fps < 0) return { ...e, bajas: 0, altas: 0 };
  if (fps < FPS_BAJO) {
    const bajas = e.bajas + 1;
    if (bajas < MUESTRAS_BAJAR) return { ...e, bajas, altas: 0 };
    return { ...e, bajas: 0, altas: 0, nivel: Math.min(e.nivel + 1, TOPES_DPR.length - 1) };
  }
  if (fps >= FPS_ALTO) {
    const altas = e.altas + 1;
    if (altas < MUESTRAS_SUBIR) return { ...e, bajas: 0, altas };
    if (e.nivel > 0 && e.subidas < MAX_SUBIDAS) return { nivel: e.nivel - 1, bajas: 0, altas: 0, subidas: e.subidas + 1 };
    return { ...e, bajas: 0, altas: 0 };
  }
  return { ...e, bajas: 0, altas: 0 };
}

/** Tope de densidad del nivel. */
export function topeDpr(e: EstadoDensidad): number {
  return TOPES_DPR[e.nivel] ?? TOPES_DPR[TOPES_DPR.length - 1] ?? 1;
}

/** Densidad fija pedida con `?dpr=<n>`; null si falta o no sirve (queda el ajuste automático). */
export function leerDprFijo(search: string): number | null {
  const valor = new URLSearchParams(search).get('dpr');
  if (valor === null || valor.trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= DPR_FIJO_MIN && n <= DPR_FIJO_MAX ? n : null;
}

/**
 * Densidad que aplica R3F al lienzo: misma fórmula que `calculateDpr` de @react-three/fiber 9.8.1
 * (events-*.esm.js). Con tupla, la de la pantalla acotada al rango; con número, ese número.
 */
export function dprEfectivo(dpr: number | [number, number], pantalla: number | undefined): number {
  return Array.isArray(dpr) ? Math.min(Math.max(dpr[0], pantalla ?? 2), dpr[1]) : dpr;
}
