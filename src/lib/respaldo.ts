// Fusión de respuestas del modo revisión (F24, spec 03). Une las locales con las que trae el canal al abrir, por fecha
// más reciente (R4.2), y dice qué piezas propuestas siguen valiendo.
import { claveRespuesta, type Respuesta } from './revision';

/** Milisegundos de una fecha; una que no se puede leer vale -Infinity, así cualquier fecha válida la reemplaza. */
const tiempo = (fecha: string) => {
  const t = Date.parse(fecha);
  return Number.isFinite(t) ? t : -Infinity;
};

/** Une las respuestas que trae el canal al abrir (`importarRespuestas` en el store; `fusionarConCanal` para `confirmadas`) con las actuales: por clave gana la `fecha` estrictamente más nueva. No muta. */
export function fusionarRespuestas(
  actuales: Record<string, Respuesta>,
  nuevas: Respuesta[],
): { respuestas: Record<string, Respuesta>; agregadas: number; actualizadas: number; sinCambio: number } {
  const respuestas = { ...actuales };
  let agregadas = 0;
  let actualizadas = 0;
  let sinCambio = 0;
  for (const n of nuevas) {
    const k = claveRespuesta(n);
    const existente = respuestas[k];
    if (existente === undefined) {
      respuestas[k] = n;
      agregadas++;
    } else if (tiempo(n.fecha) > tiempo(existente.fecha)) {
      respuestas[k] = n;
      actualizadas++;
    } else sinCambio++;
  }
  return { respuestas, agregadas, actualizadas, sinCambio };
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
