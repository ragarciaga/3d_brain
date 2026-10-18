// Uso: node scripts/aplicar-trazos.ts [--medidos <ruta>] [--trazos <ruta>] [--marcadores <ruta>] [--resumen <ruta>] [--rutas <ruta>]
// Lleva las mediciones de pipeline/auditar-vago.py (por defecto pipeline/salida/trazos-medidos.json) a
// src/data/trazos-vago.json y escribe el resumen antes y después en docs/research/vago/resumen-trazos.md.
// Rutas relativas al directorio de trabajo. Solo cambian auditoria, propuesta, fuente, evidencia y confianza.
// Todo se lee, valida y calcula antes de escribir: si algo falla no se escribe nada. Nunca escribe marcadores.json:
// solo lo lee para saber qué ramos se pueden proponer. Lee public/modelos/rutas-vago.json (que escribe
// pipeline/generar-ramas-vago.py) para las bandas del tronco cortado (ADR 0010): la evidencia de esos trazos
// dice qué parte se publica.
// La corrida sobre los datos reales es del PR de datos (spec 04, T7), que aprueba el editor.
// La lógica vive en scripts/lib/trazos.ts; aquí solo se lee y se escribe.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Marcador, PropuestaTrazo } from '../src/data/tipos.ts';
import { bandas } from './lib/asimetrias.ts';
import type { Rutas } from './lib/asimetrias.ts';
import { aplicarMediciones, argumentosAplicarTrazos, ramosDeMarcadores, serializarTrazos } from './lib/trazos.ts';

const args = argumentosAplicarTrazos(process.argv.slice(2));
if (!args) {
  console.error('Uso: node scripts/aplicar-trazos.ts [--medidos <ruta>] [--trazos <ruta>] [--marcadores <ruta>] [--resumen <ruta>] [--rutas <ruta>]');
  process.exit(2);
}
const rutaMedidos = resolve(args.medidos);
const rutaTrazos = resolve(args.trazos);
const rutaMarcadores = resolve(args.marcadores);
const rutaResumen = resolve(args.resumen);
const rutaRutas = resolve(args.rutas);
if (!existsSync(rutaMedidos)) {
  console.error(`No está el archivo de mediciones en ${args.medidos}. Genéralo con: python pipeline/auditar-vago.py`);
  process.exit(2);
}
if (!existsSync(rutaRutas)) {
  console.error(`No está el archivo de rutas en ${args.rutas}. Genéralo con: python pipeline/generar-ramas-vago.py`);
  process.exit(2);
}

let resultado: ReturnType<typeof aplicarMediciones>;
try {
  const medidos: unknown = JSON.parse(readFileSync(rutaMedidos, 'utf8'));
  const trazos = JSON.parse(readFileSync(rutaTrazos, 'utf8')) as { trazos: PropuestaTrazo[] };
  const marcadores: unknown = JSON.parse(readFileSync(rutaMarcadores, 'utf8'));
  if (!Array.isArray(marcadores)) throw new Error(`${args.marcadores} no es una lista de marcadores`);
  const rutas: unknown = JSON.parse(readFileSync(rutaRutas, 'utf8'));
  if (typeof rutas !== 'object' || rutas === null || typeof (rutas as { rutas?: unknown }).rutas !== 'object') {
    throw new Error(`${args.rutas} no trae el objeto "rutas"`);
  }
  resultado = aplicarMediciones(trazos, medidos, ramosDeMarcadores(marcadores as Marcador[]), bandas(rutas as Rutas));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

writeFileSync(rutaTrazos, serializarTrazos(resultado.datos));
mkdirSync(dirname(rutaResumen), { recursive: true });
writeFileSync(rutaResumen, resultado.resumen);
const actualizados = (resultado.resumen.match(/^- Resultado: actualizado$/gm) ?? []).length;
console.log(`${actualizados} trazos actualizados, ${resultado.datos.trazos.length - actualizados} sin cambios. Resumen: ${args.resumen}`);
