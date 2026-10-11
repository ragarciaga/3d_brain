// Verificación de la invariante de posición: compara la caja envolvente de cada malla del GLB
// (coordenadas de mundo glTF, Y arriba) con la medida en Blender (Z arriba) en pipeline/cajas.json.

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
