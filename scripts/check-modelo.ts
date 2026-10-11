// Verifica public/modelos/atlas.glb contra pipeline/cajas.json: piezas completas, ninguna corrida
// más de 0,1 mm y peso dentro del presupuesto (AGENTS.md, SPEC sección 9).
// Uso: node scripts/check-modelo.ts [glb] [cajas.json]
import { readFileSync, statSync } from 'node:fs';
import { cajasDelDocumento, io } from './lib/glb.ts';
import { compararCajas, type Caja } from './lib/modelo.ts';

const PRESUPUESTO_MB = 15;
const glb = process.argv[2] ?? 'public/modelos/atlas.glb';
const rutaCajas = process.argv[3] ?? 'pipeline/cajas.json';

const esperadas = (JSON.parse(readFileSync(rutaCajas, 'utf8')) as { cajas: Record<string, Caja> }).cajas;
const doc = await (await io()).read(glb);
const { errores, piezas } = compararCajas(esperadas, cajasDelDocumento(doc));
const mb = statSync(glb).size / 1024 / 1024;
if (mb > PRESUPUESTO_MB) errores.push(`${glb} pesa ${mb.toFixed(2)} MB (presupuesto ${PRESUPUESTO_MB} MB)`);

if (errores.length) {
  console.error(errores.slice(0, 50).join('\n'));
  console.error(`check:modelo falló con ${errores.length} error(es).`);
  process.exit(1);
}
console.log(`check:modelo OK: ${piezas} mallas en su posición, ${mb.toFixed(2)} MB.`);
