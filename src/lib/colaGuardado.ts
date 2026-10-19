// Cola del guardado automático del modo revisión (F24, spec 03): lógica pura y probada sin red. No usa
// `fetch`, ni `Date.now()`, ni temporizadores: el reloj entra como `ahora` y la espera sale como
// número, para que quien la conecte (el panel de revisión, `src/components/PanelRevision.tsx`) decida cuándo reintentar.
import { fusionarRespuestas } from './respaldo';
import { cuerpoGuardar } from './canal';
import type { TipoErrorCanal } from './canal';
import { claveRespuesta, desdeClave, pendientesDeEnvio } from './revision';
import type { Respuesta, Retiro } from './revision';

/** Lo que viaja al canal: una respuesta o, con un script que lo entiende, el retiro de una marca (#217). */
export type Envio = Respuesta | Retiro;

/** Tope (ms) de R3.1 entre el último gesto del docente y el envío al canal. El panel no la usa directo: espera `ESPERA_ENVIO_MS`. Distinta de `ESPERA_GUARDADO_MS` (la de IndexedDB). */
export const ESPERA_CANAL_MS = 3000;
/**
 * Margen (ms) que el panel descuenta de `ESPERA_CANAL_MS`: cubre los 500 ms de la espera del texto en la ficha
 * (`ESPERA_GUARDADO_MS`, antes de que la tecla llegue al store) más el retraso de los temporizadores.
 */
export const MARGEN_ENVIO_MS = 600;
/** Espera real (ms) del panel desde el cambio en el store; con el margen, el envío sale a más tardar a los 3 s del último gesto (R3.1). */
export const ESPERA_ENVIO_MS = ESPERA_CANAL_MS - MARGEN_ENVIO_MS;
/** Primera espera de reintento (ms); se duplica con cada fallo seguido. */
export const ESPERA_INICIAL_MS = 2000;
/** Tope de la espera de reintento (5 min). */
export const ESPERA_MAXIMA_MS = 300_000;
/** Espera tras `demasiadas_peticiones`. */
export const ESPERA_DEMASIADAS_MS = 60_000;
/** Tiempo sin confirmación, con pendientes, desde el cual se ofrece el respaldo (10 min). */
export const AVISO_RESPALDO_MS = 600_000;
/** Respuestas por envío. */
export const MAX_LOTE_RESPUESTAS = 50;
/** Bytes UTF-8 del cuerpo POST por envío. */
export const MAX_LOTE_BYTES = 60 * 1024;

/** Espera (ms) antes del reintento tras `intentos` fallos seguidos: 2000, 4000, 8000... con tope de 300000. Nunca da NaN ni Infinity. */
export function siguienteEspera(intentos: number): number {
  const n = Number.isFinite(intentos) ? Math.max(1, Math.floor(intentos)) : 1;
  return Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** (n - 1));
}

/** Clave con la que el canal confirma una respuesta: `estructura|campo|idioma|fecha`. */
export const claveConfirmacion = (r: Envio) => `${claveRespuesta(r)}|${r.fecha}`;

/** Respuestas completas cuya fecha aún no está confirmada. */
export function pendientes(respuestas: Respuesta[], confirmadas: Record<string, string>): Respuesta[] {
  return pendientesDeEnvio(respuestas, confirmadas);
}

/**
 * Retiros por mandar (#217): uno por cada clave de `retiradas` cuya fecha el canal aún no confirmó. Las claves que no
 * se pueden leer (`desdeClave` lanza) se saltan: nunca viajan.
 */
export function retirosPendientes(retiradas: Record<string, string>, confirmadas: Record<string, string>): Retiro[] {
  const retiros: Retiro[] = [];
  for (const [clave, fecha] of Object.entries(retiradas)) {
    if (Object.hasOwn(confirmadas, clave) && confirmadas[clave] === fecha) continue;
    try {
      retiros.push({ ...desdeClave(clave), veredicto: '', fecha });
    } catch {
      continue;
    }
  }
  return retiros;
}

/**
 * Pendientes que se pueden mandar: sin las que el canal rechazó solas con esa misma fecha. Esas siguen
 * pendientes (no se confirmaron) pero no se reintentan hasta que se editen (fecha nueva). `retiros` son los
 * retiros pendientes (`retirosPendientes`) y pasan por el mismo filtro; el que llama los pasa solo si el script
 * declaró `canal >= VERSION_CANAL`, y salen después de las respuestas.
 */
export function porEnviar(
  respuestas: Respuesta[],
  confirmadas: Record<string, string>,
  rechazadas: Record<string, string>,
  retiros: Retiro[] = [],
): Envio[] {
  const lista: Envio[] = [...pendientes(respuestas, confirmadas), ...retiros];
  return lista.filter((r) => !(Object.hasOwn(rechazadas, claveRespuesta(r)) && rechazadas[claveRespuesta(r)] === r.fecha));
}

/**
 * Parte las respuestas, en el orden de entrada, en lotes de a lo sumo `tope` respuestas y
 * `MAX_LOTE_BYTES` bytes UTF-8 de cuerpo POST. Una respuesta que sola pasa el tope de bytes sale en su
 * propio lote (el canal dirá `demasiado_grande`). Sin respuestas da [].
 */
export function armarLotes<T extends Envio>(codigo: string, respuestas: T[], tope: number = MAX_LOTE_RESPUESTAS): T[][] {
  const maximo = Math.max(1, Math.floor(tope));
  const codificador = new TextEncoder();
  const lotes: T[][] = [];
  let actual: T[] = [];
  for (const r of respuestas) {
    const cabe = actual.length < maximo && codificador.encode(cuerpoGuardar(codigo, [...actual, r])).length <= MAX_LOTE_BYTES;
    if (actual.length === 0 || cabe) {
      actual.push(r);
      continue;
    }
    lotes.push(actual);
    actual = [r];
  }
  if (actual.length) lotes.push(actual);
  return lotes;
}

/** Copia de `confirmadas` con las respuestas del lote cuya `claveConfirmacion` (con su fecha) está en `recibidas`. No muta la entrada. */
export function confirmarRecibidas(
  confirmadas: Record<string, string>,
  lote: Envio[],
  recibidas: Set<string>,
): Record<string, string> {
  const nuevas = { ...confirmadas };
  for (const r of lote) if (recibidas.has(claveConfirmacion(r))) nuevas[claveRespuesta(r)] = r.fecha;
  return nuevas;
}

/** Estado serializable de la cola. */
export interface EstadoCola {
  /** `claveRespuesta` a la fecha confirmada por el canal. */
  confirmadas: Record<string, string>;
  /** `claveRespuesta` a la fecha que el canal rechazó estando sola en el lote: no se reintenta hasta que se edite. */
  rechazadas: Record<string, string>;
  /** Fallos seguidos; sube el tiempo de espera. */
  fallos: number;
  /** Respuestas por lote; baja a la mitad tras `formato` o `demasiado_grande`. */
  tope: number;
  /** Inicio de la ventana sin confirmación (R7.1): la última confirmación, o el momento en que aparecieron pendientes. null si no hay ventana. */
  ultimaConfirmacion: number | null;
  /** El canal dijo `codigo_no_activo`: no se reintenta. */
  inactivo: boolean;
}

export function estadoInicial(confirmadas: Record<string, string> = {}): EstadoCola {
  return { confirmadas, rechazadas: {}, fallos: 0, tope: MAX_LOTE_RESPUESTAS, ultimaConfirmacion: null, inactivo: false };
}

export type ResultadoEnvio = { ok: true; recibidas: Set<string> } | { ok: false; error: TipoErrorCanal };

/**
 * Nuevo estado tras enviar `lote`, y los ms que se espera antes del siguiente envío (null: no hay
 * siguiente). Tras un fallo, la espera es `siguienteEspera` con el contador ya aumentado. No muta.
 */
export function trasEnvio(
  estado: EstadoCola,
  lote: Envio[],
  resultado: ResultadoEnvio,
  ahora: number,
): { estado: EstadoCola; espera: number | null } {
  const base: EstadoCola = { ...estado, confirmadas: { ...estado.confirmadas }, rechazadas: { ...estado.rechazadas } };
  if (resultado.ok) {
    const confirmadas = confirmarRecibidas(estado.confirmadas, lote, resultado.recibidas);
    const confirmoAlgo = lote.some((r) => resultado.recibidas.has(claveConfirmacion(r)));
    const todo = lote.every((r) => resultado.recibidas.has(claveConfirmacion(r)));
    if (todo) return { estado: { ...base, confirmadas, fallos: 0, ultimaConfirmacion: ahora }, espera: 0 };
    const fallos = estado.fallos + 1;
    return {
      estado: { ...base, confirmadas, fallos, ultimaConfirmacion: confirmoAlgo ? ahora : estado.ultimaConfirmacion },
      espera: siguienteEspera(fallos),
    };
  }
  switch (resultado.error) {
    case 'red':
    case 'interno': {
      const fallos = estado.fallos + 1;
      return { estado: { ...base, fallos }, espera: siguienteEspera(fallos) };
    }
    case 'demasiadas_peticiones':
      return { estado: base, espera: ESPERA_DEMASIADAS_MS };
    case 'formato':
    case 'demasiado_grande': {
      if (lote.length > 1) return { estado: { ...base, tope: Math.ceil(lote.length / 2) }, espera: 0 };
      const sola = lote[0];
      if (sola) base.rechazadas[claveRespuesta(sola)] = sola.fecha;
      return { estado: { ...base, tope: MAX_LOTE_RESPUESTAS }, espera: 0 };
    }
    case 'codigo_no_activo':
      return { estado: { ...base, inactivo: true }, espera: null };
    case 'sin_autorizacion':
      // El canal respondió, así que no es falta de red: no cuenta como fallo ni se reintenta. El panel deja la
      // autorización en null y la cola sigue sola cuando el docente vuelve a autorizar.
      return { estado: { ...base, fallos: 0 }, espera: null };
  }
}

/**
 * Abre o cierra la ventana de 10 min de R7.1: sin pendientes la deja en null; con pendientes y sin
 * ventana la abre en `ahora`; en otro caso no cambia nada. Devuelve el mismo estado si no hay cambio.
 */
export function marcarPendientes(estado: EstadoCola, hayPendientes: boolean, ahora: number): EstadoCola {
  if (!hayPendientes) return estado.ultimaConfirmacion === null ? estado : { ...estado, ultimaConfirmacion: null };
  return estado.ultimaConfirmacion === null ? { ...estado, ultimaConfirmacion: ahora } : estado;
}

/** Hay que ofrecer el respaldo: con pendientes y al menos 10 min sin confirmar desde que abrió la ventana. */
export function ofrecerRespaldo(ultimaConfirmacion: number | null, ahora: number, hayPendientes: boolean): boolean {
  return hayPendientes && ultimaConfirmacion !== null && ahora - ultimaConfirmacion >= AVISO_RESPALDO_MS;
}

/**
 * Une lo que trae el canal con lo local: por clave gana la fecha más reciente (con empate se queda la
 * local; un retiro más nuevo le gana al veredicto y un veredicto más nuevo le gana al retiro, #217). La versión del
 * canal queda confirmada solo si es la que quedó, también para los retiros. No muta la entrada.
 */
export function fusionarConCanal(
  locales: Record<string, Respuesta>,
  confirmadas: Record<string, string>,
  delCanal: Respuesta[],
  retiradas: Record<string, string> = {},
  retirosCanal: Retiro[] = [],
): { respuestas: Record<string, Respuesta>; retiradas: Record<string, string>; confirmadas: Record<string, string> } {
  const fusion = fusionarRespuestas(locales, delCanal, retiradas, retirosCanal);
  const nuevas = { ...confirmadas };
  for (const n of delCanal) {
    const k = claveRespuesta(n);
    if (fusion.respuestas[k]?.fecha === n.fecha) nuevas[k] = n.fecha;
  }
  for (const n of retirosCanal) {
    const k = claveRespuesta(n);
    if (Object.hasOwn(fusion.retiradas, k) && fusion.retiradas[k] === n.fecha) nuevas[k] = n.fecha;
  }
  return { respuestas: fusion.respuestas, retiradas: fusion.retiradas, confirmadas: nuevas };
}
