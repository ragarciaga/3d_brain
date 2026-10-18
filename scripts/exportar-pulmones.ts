// Exporta las secciones horizontales de los cinco lóbulos pulmonares de public/modelos/atlas.glb a
// pipeline/salida/pulmones-vago.json (en .gitignore). Es la entrada de pipeline/generar-ramas-vago.py: los
// pulmones son un obstáculo de las rutas del vago (SPEC F25) y no están en pipeline/anclajes-vago.json.
// Una sección cada 1 mm de altura; solo los segmentos con algún extremo a |x| <= 7 cm, que es donde pasan las rutas.
// No modifica el GLB. Si falta un lóbulo, se detiene.
// Uso: node scripts/exportar-pulmones.ts [glb] [salida.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { io, triangulosDelDocumento } from './lib/glb.ts';
import { LOBULOS, seccionar, type PulmonesExportados } from './lib/pulmones.ts';

const PASO = 0.001;
const X_MAXIMO = 0.07;
const glb = process.argv[2] ?? 'public/modelos/atlas.glb';
const destino = process.argv[3] ?? 'pipeline/salida/pulmones-vago.json';

const doc = await (await io()).read(glb);
const mallas = triangulosDelDocumento(doc, new Set(LOBULOS));
const faltan = LOBULOS.filter((n) => !mallas[n] || mallas[n].length === 0);
if (faltan.length) {
  console.error(`Faltan lóbulos pulmonares en ${glb}: ${faltan.join(', ')}`);
  process.exit(1);
}

const redondear = (v: number) => Math.round(v * 1e6) / 1e6; // micras
const salida: PulmonesExportados = { fuente: glb, paso: PASO, lobulos: {} };
for (const nombre of LOBULOS) {
  const tris = mallas[nombre]!;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 1; i < tris.length; i += 3) {
    y0 = Math.min(y0, tris[i]!);
    y1 = Math.max(y1, tris[i]!);
  }
  const secciones: PulmonesExportados['lobulos'][string] = [];
  for (let k = Math.ceil(y0 / PASO); k * PASO <= y1; k++) {
    const y = redondear(k * PASO);
    const segmentos = seccionar(tris, y)
      .filter((s) => Math.abs(s[0]) <= X_MAXIMO || Math.abs(s[2]) <= X_MAXIMO)
      .map((s) => s.map(redondear) as [number, number, number, number]);
    secciones.push({ y, segmentos });
  }
  salida.lobulos[nombre] = secciones;
  console.log(`${nombre}: ${tris.length / 9} triángulos, ${secciones.length} secciones de y = ${(y0 * 1000).toFixed(1)} a ${(y1 * 1000).toFixed(1)} mm`);
}
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(salida) + '\n');
console.log(`Pulmones exportados a ${destino}`);
