// Verifica public/modelos/atlas.glb contra pipeline/cajas.json: piezas completas, ninguna corrida
// más de 0,1 mm y peso dentro del presupuesto (AGENTS.md, SPEC sección 9). También verifica que
// src/config/mallas-cerradas.json coincida con las mallas del encéfalo sin bordes abiertos medidas
// en el GLB (SPEC R3.2, ADR 0011).
// Uso: node scripts/check-modelo.ts [glb] [cajas.json] [mallas-cerradas.json]
import { readFileSync, statSync } from 'node:fs';
import type { Arbol } from '../src/data/tipos.ts';
import { cajasDelDocumento, io } from './lib/glb.ts';
import { compararMallasCerradas, mallasDelEncefalo, medirMalla, primitivasDelDocumento, type MedidaMalla } from './lib/mallas.ts';
import { compararCajas, type Caja } from './lib/modelo.ts';

const PRESUPUESTO_MB = 15;
const glb = process.argv[2] ?? 'public/modelos/atlas.glb';
const rutaCajas = process.argv[3] ?? 'pipeline/cajas.json';
const rutaCerradas = process.argv[4] ?? 'src/config/mallas-cerradas.json';

const esperadas = (JSON.parse(readFileSync(rutaCajas, 'utf8')) as { cajas: Record<string, Caja> }).cajas;
const doc = await (await io()).read(glb);
const { errores, piezas } = compararCajas(esperadas, cajasDelDocumento(doc));

const lista = JSON.parse(readFileSync(rutaCerradas, 'utf8')) as string[];
const arbol = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')) as Arbol;
const prims = primitivasDelDocumento(doc);
const medidas: Record<string, MedidaMalla> = {};
for (const nombre of mallasDelEncefalo(arbol)) if (nombre in prims) medidas[nombre] = medirMalla(prims[nombre]!);
errores.push(...compararMallasCerradas(lista, medidas, Object.keys(prims)));

const mb = statSync(glb).size / 1024 / 1024;
if (mb > PRESUPUESTO_MB) errores.push(`${glb} pesa ${mb.toFixed(2)} MB (presupuesto ${PRESUPUESTO_MB} MB)`);

if (errores.length) {
  console.error(errores.slice(0, 50).join('\n'));
  console.error(`check:modelo falló con ${errores.length} error(es).`);
  process.exit(1);
}
console.log(`check:modelo OK: ${piezas} mallas en su posición, ${lista.length} mallas cerradas según la lista, ${mb.toFixed(2)} MB.`);
