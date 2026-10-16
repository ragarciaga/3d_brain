// Verifica public/modelos/atlas.glb contra pipeline/cajas.json: piezas completas, ninguna corrida
// más de 0,1 mm y peso dentro del presupuesto (AGENTS.md, SPEC sección 9). También verifica que
// src/config/mallas-cerradas.json coincida con las mallas del encéfalo sin bordes abiertos medidas
// en el GLB (SPEC R3.2, ADR 0011). Y vigila las bandas del vago: ningún vértice del tronco escaneado
// (`Vagus nerve (X).l/.r#t02` y su `#toque`) dentro del tramo que reemplaza cada ruta torácica de
// public/modelos/rutas-vago.json (ADR 0010).
// Uso: node scripts/check-modelo.ts [glb] [cajas.json] [mallas-cerradas.json] [rutas-vago.json]
import { readFileSync, statSync } from 'node:fs';
import type { Arbol } from '../src/data/tipos.ts';
import { bandas, type Rutas } from './lib/asimetrias.ts';
import { cajasDelDocumento, io, verticesDelDocumento } from './lib/glb.ts';
import { compararMallasCerradas, mallasDelEncefalo, medirMalla, primitivasDelDocumento, type MedidaMalla } from './lib/mallas.ts';
import { comprobarBandas, compararCajas, mallasDelTronco, type Caja } from './lib/modelo.ts';

const PRESUPUESTO_MB = 15;
const glb = process.argv[2] ?? 'public/modelos/atlas.glb';
const rutaCajas = process.argv[3] ?? 'pipeline/cajas.json';
const rutaCerradas = process.argv[4] ?? 'src/config/mallas-cerradas.json';
const rutaRutas = process.argv[5] ?? 'public/modelos/rutas-vago.json';

const esperadas = (JSON.parse(readFileSync(rutaCajas, 'utf8')) as { cajas: Record<string, Caja> }).cajas;
const doc = await (await io()).read(glb);
const { errores, piezas } = compararCajas(esperadas, cajasDelDocumento(doc));

const lista = JSON.parse(readFileSync(rutaCerradas, 'utf8')) as string[];
const arbol = JSON.parse(readFileSync('src/data/arbol.json', 'utf8')) as Arbol;
const prims = primitivasDelDocumento(doc);
const medidas: Record<string, MedidaMalla> = {};
for (const nombre of mallasDelEncefalo(arbol)) if (nombre in prims) medidas[nombre] = medirMalla(prims[nombre]!);
errores.push(...compararMallasCerradas(lista, medidas, Object.keys(prims)));

const rutas = JSON.parse(readFileSync(rutaRutas, 'utf8')) as Partial<Rutas>;
let vigiladas = 0;
if (typeof rutas.rutas !== 'object' || rutas.rutas === null) {
  errores.push(`${rutaRutas} no trae el objeto "rutas": sin él no se pueden vigilar las bandas del vago`);
} else {
  const bs = bandas(rutas as Rutas);
  vigiladas = bs.length;
  const nombres = new Set(bs.filter((b) => b.lado === 'izquierdo' || b.lado === 'derecho').flatMap((b) => mallasDelTronco(b.lado)));
  errores.push(...comprobarBandas(bs, verticesDelDocumento(doc, nombres)));
}

const mb = statSync(glb).size / 1024 / 1024;
if (mb > PRESUPUESTO_MB) errores.push(`${glb} pesa ${mb.toFixed(2)} MB (presupuesto ${PRESUPUESTO_MB} MB)`);

if (errores.length) {
  console.error(errores.slice(0, 50).join('\n'));
  console.error(`check:modelo falló con ${errores.length} error(es).`);
  process.exit(1);
}
console.log(`check:modelo OK: ${piezas} mallas en su posición, ${lista.length} mallas cerradas según la lista, ${vigiladas} banda(s) del vago vigiladas, ${mb.toFixed(2)} MB.`);
