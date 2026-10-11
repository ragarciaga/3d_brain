// Armar pieza por pieza, modo reto (F7): cuándo una pieza arrastrada "encaja".
//
// En el plano de la pantalla no se controla la profundidad, así que se mide en pantalla lo que la persona
// ve, no en metros del modelo. La tolerancia es proporcional al radio con que se ve la pieza proyectada:
// una pieza grande perdona más píxeles que una pequeña. El mínimo de 24 px es medio dedo, para que una
// pieza diminuta se pueda encajar con un toque impreciso. El máximo de 80 px evita que un nervio largo
// (radio proyectado enorme) encaje desde lejos.

export const TOLERANCIA_MIN_PX = 24;
export const TOLERANCIA_MAX_PX = 80;
export const FRACCION_RADIO = 0.5;

export interface Punto2 {
  x: number;
  y: number;
}

/** Tolerancia de encaje (px) para una pieza cuyo radio proyectado es `radioPx`. Una entrada no finita da el mínimo. */
export function toleranciaPx(radioPx: number): number {
  if (!Number.isFinite(radioPx)) return TOLERANCIA_MIN_PX;
  return Math.min(TOLERANCIA_MAX_PX, Math.max(TOLERANCIA_MIN_PX, FRACCION_RADIO * radioPx));
}

/** Si la posición actual (px) está dentro de la tolerancia de su sitio. Coordenadas no finitas nunca encajan. */
export function encaja(actual: Punto2, casa: Punto2, radioPx: number): boolean {
  const d = Math.hypot(actual.x - casa.x, actual.y - casa.y);
  if (!Number.isFinite(d)) return false;
  return d <= toleranciaPx(radioPx);
}

/** Radio (px) con que se ve una esfera de `radio` metros a `distancia` de una cámara con ese campo de visión vertical. */
export function radioEnPantalla(radio: number, distancia: number, fovGrados: number, altoPx: number): number {
  if (!(distancia > 0)) return 0;
  const alto = distancia * Math.tan((fovGrados * Math.PI) / 360);
  return (radio / alto) * (altoPx / 2);
}
