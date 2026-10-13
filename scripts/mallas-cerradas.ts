// Mide en el GLB qué mallas del encéfalo no tienen bordes abiertos (SPEC R3.2, ADR 0011) y escribe
// la lista que verifica check:modelo.
// Uso: node scripts/mallas-cerradas.ts [glb] [salida]
import { readFileSync, writeFileSync } from 'node:fs';
import type { Arbol } from '../src/data/tipos.ts';
import { io } from './lib/glb.ts';
import { mallasDelEncefalo, medirMalla, primitivasDelDocumento } from './lib/mallas.ts';

const glb = process.argv[2] ?? 'public/modelos/atlas.glb';
const salida = process.argv[3] ?? 'src/config/mallas-cerradas.json';

const arbol = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')) as Arbol;
const prims = primitivasDelDocumento(await (await io()).read(glb));
const nombres = mallasDelEncefalo(arbol);

const faltan = nombres.filter((n) => !(n in prims)).map((n) => `Falta en el GLB: ${n}`);
if (faltan.length) {
  console.error(faltan.slice(0, 50).join('\n'));
  console.error(`mallas-cerradas falló con ${faltan.length} error(es).`);
  process.exit(1);
}

const cerradas: string[] = [];
let trisCerrados = 0;
let trisAbiertos = 0;
for (const n of nombres) {
  const m = medirMalla(prims[n]!);
  if (m.cerrada) {
    cerradas.push(n);
    trisCerrados += m.triangulos;
  } else trisAbiertos += m.triangulos;
}
cerradas.sort();
writeFileSync(salida, JSON.stringify(cerradas, null, 2) + '\n');
console.log(
  `mallas-cerradas: ${cerradas.length} cerradas de ${nombres.length} mallas del encéfalo (${trisCerrados} triángulos cerrados, ${trisAbiertos} abiertos) -> ${salida}`,
);
