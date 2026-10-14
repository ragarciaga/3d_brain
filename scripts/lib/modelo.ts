// Verificación de la invariante de posición: compara la caja envolvente de cada malla del GLB
// (coordenadas de mundo glTF, Y arriba) con la medida en Blender (Z arriba) en pipeline/cajas.json.
// También vigila que el tronco escaneado del vago no vuelva al GLB dentro de la banda que reemplazan
// las rutas torácicas (ADR 0010, `comprobarBandas`).
import { puntosEnBanda, TOLERANCIA_BANDA } from './asimetrias.ts';
import type { Banda, Lado, P } from './asimetrias.ts';

export type Caja = [number, number, number, number, number, number]; // min x,y,z, max x,y,z

/** Blender (x, y, z) a glTF (x, z, -y): el giro global del exportador con +Y arriba. */
export function cajaBlenderAGltf(c: Caja): Caja {
  const [minx, miny, minz, maxx, maxy, maxz] = c;
  return [minx, minz, -maxy, maxx, maxz, -miny];
}

export interface ResultadoModelo {
  errores: string[];
  piezas: number;
}

export function compararCajas(
  esperadas: Record<string, Caja>,
  medidas: Record<string, Caja>,
  toleranciaM = 0.0001,
): ResultadoModelo {
  const errores: string[] = [];
  for (const nombre of Object.keys(esperadas)) {
    const m = medidas[nombre];
    if (!m) {
      errores.push(`Falta en el GLB: ${nombre}`);
      continue;
    }
    const e = cajaBlenderAGltf(esperadas[nombre]!);
    const desvio = Math.max(...e.map((v, i) => Math.abs(v - m[i]!)));
    if (desvio > toleranciaM) {
      errores.push(`${nombre} se corrió ${(desvio * 1000).toFixed(3)} mm (máximo ${toleranciaM * 1000} mm)`);
    }
  }
  for (const nombre of Object.keys(medidas)) {
    if (!(nombre in esperadas)) errores.push(`Sobra en el GLB (no está en cajas.json): ${nombre}`);
  }
  return { errores, piezas: Object.keys(medidas).length };
}

/** Caja de un conjunto de posiciones ya transformadas a mundo. */
export function cajaDePuntos(puntos: Iterable<[number, number, number]>): Caja {
  const c: Caja = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const [x, y, z] of puntos) {
    c[0] = Math.min(c[0], x);
    c[1] = Math.min(c[1], y);
    c[2] = Math.min(c[2], z);
    c[3] = Math.max(c[3], x);
    c[4] = Math.max(c[4], y);
    c[5] = Math.max(c[5], z);
  }
  return c;
}

/**
 * El tronco escaneado de cada lado: el trazo más largo (docs/research/vago/auditoria-vago.md). Es el
 * mismo nombre que `TRONCO` en pipeline/extraer.py, que lo corta. Si divergen, `comprobarBandas`
 * falla con "Falta en el GLB" o `extraer.py` se niega a exportar.
 */
export const TRONCO_VAGO: Record<Lado, string> = {
  izquierdo: 'Vagus nerve (X).l#t02',
  derecho: 'Vagus nerve (X).r#t02',
};

/** La malla visible del tronco y su malla de toque. */
export function mallasDelTronco(lado: Lado): string[] {
  return [TRONCO_VAGO[lado], `${TRONCO_VAGO[lado]}#toque`];
}

/**
 * ADR 0010: ningún vértice del tronco (ni de su `#toque`) cae dentro de la banda de su lado, con
 * `tolerancia` en el borde. `vertices` son posiciones de mundo glTF por nombre de malla.
 */
export function comprobarBandas(bandas: Banda[], vertices: Record<string, P[]>, tolerancia = TOLERANCIA_BANDA): string[] {
  const errores: string[] = [];
  for (const banda of bandas) {
    const { lado, y_max, y_min } = banda;
    const bien = (lado === 'izquierdo' || lado === 'derecho') && Number.isFinite(y_max) && (y_min === null || (Number.isFinite(y_min) && y_min < y_max));
    if (!bien) {
      errores.push(`Banda mal formada del vago ${String(lado)}: y_max = ${String(y_max)}, y_min = ${String(y_min)}`);
      continue;
    }
    for (const malla of mallasDelTronco(lado)) {
      const pts = vertices[malla];
      if (!pts) {
        errores.push(`Falta en el GLB ${malla}: sin ella no se puede vigilar la banda del vago ${lado}`);
        continue;
      }
      const dentro = puntosEnBanda(pts, banda, tolerancia);
      if (!dentro.length) continue;
      const hasta = y_min === null ? 'abajo' : `${y_min.toFixed(4)} m`;
      errores.push(
        `${malla}: ${dentro.length} vértice(s) dentro del tramo reemplazado del vago ${lado}, el primero a la altura y = ${dentro[0]![1].toFixed(4)} m (banda de ${y_max.toFixed(4)} m a ${hasta})`,
      );
    }
  }
  return errores;
}
