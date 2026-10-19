// Fusión de respuestas del modo revisión (F24, spec 03). Une las locales con las que trae el canal al abrir, por fecha
// más reciente (R4.2), y dice qué piezas propuestas siguen valiendo.
import { claveRespuesta, type Respuesta, type Retiro } from './revision';

/** Milisegundos de una fecha; una que no se puede leer vale -Infinity, así cualquier fecha válida la reemplaza. */
const tiempo = (fecha: string) => {
  const t = Date.parse(fecha);
  return Number.isFinite(t) ? t : -Infinity;
};

/**
 * Une las respuestas y los retiros que trae el canal al abrir (`importarRespuestas` en el store; `fusionarConCanal`
 * para `confirmadas`) con lo actual. `retiradas` es clave a fecha del retiro local (#217). Por clave gana la `fecha`
 * estrictamente más nueva, y una clave nunca queda en `respuestas` y en `retiradas` a la vez:
 * - Un veredicto del canal con un retiro local de fecha mayor o igual no vuelve (`sinCambio`); uno más nuevo entra y
 *   borra el retiro.
 * - Un retiro del canal más nuevo que el veredicto local lo borra (`actualizadas`); uno más viejo o igual no lo toca.
 * - El retiro que queda es el de fecha mayor.
 * No muta.
 */
export function fusionarRespuestas(
  actuales: Record<string, Respuesta>,
  nuevas: Respuesta[],
  retiradasActuales: Record<string, string> = {},
  retirosNuevos: Retiro[] = [],
): {
  respuestas: Record<string, Respuesta>;
  retiradas: Record<string, string>;
  agregadas: number;
  actualizadas: number;
  sinCambio: number;
} {
  const respuestas = { ...actuales };
  const retiradas = { ...retiradasActuales };
  let agregadas = 0;
  let actualizadas = 0;
  let sinCambio = 0;
  for (const retiro of retirosNuevos) {
    const k = claveRespuesta(retiro);
    const existente = Object.hasOwn(respuestas, k) ? respuestas[k] : undefined;
    if (existente !== undefined) {
      if (tiempo(retiro.fecha) <= tiempo(existente.fecha)) continue;
      delete respuestas[k];
      actualizadas++;
    }
    if (!Object.hasOwn(retiradas, k) || tiempo(retiro.fecha) > tiempo(retiradas[k]!)) retiradas[k] = retiro.fecha;
  }
  for (const n of nuevas) {
    const k = claveRespuesta(n);
    if (Object.hasOwn(retiradas, k)) {
      if (tiempo(n.fecha) <= tiempo(retiradas[k]!)) {
        sinCambio++;
        continue;
      }
      delete retiradas[k];
    }
    const existente = Object.hasOwn(respuestas, k) ? respuestas[k] : undefined;
    if (existente === undefined) {
      respuestas[k] = n;
      agregadas++;
    } else if (tiempo(n.fecha) > tiempo(existente.fecha)) {
      respuestas[k] = n;
      actualizadas++;
    } else sinCambio++;
  }
  return { respuestas, retiradas, agregadas, actualizadas, sinCambio };
}

/** Piezas propuestas que siguen valiendo: las de los marcadores cuya respuesta `posicion` no cambió al importar. */
export function piezasQueSiguen(
  piezas: Record<string, string>,
  antes: Record<string, Respuesta>,
  despues: Record<string, Respuesta>,
): Record<string, string> {
  const siguen: Record<string, string> = {};
  for (const [e, pieza] of Object.entries(piezas)) {
    const k = claveRespuesta({ estructura: e, campo: 'posicion' });
    if (despues[k] !== undefined && despues[k] === antes[k]) siguen[e] = pieza;
  }
  return siguen;
}
