// Uso: node scripts/aplicar-marcadores.ts [--propuestas <ruta>] [--marcadores <ruta>] [--resumen <ruta>]
// Lleva las posiciones propuestas por pipeline/ubicar-marcadores.py (por defecto
// pipeline/salida/marcadores-propuestos.json) a src/data/marcadores.json y escribe el resumen antes y
// después en docs/research/marcadores/resumen-propuestas.md. Rutas relativas al directorio de trabajo.
// Solo cambian posicion, estado (a aproximada), fuente_ubicacion y ancla (si la propuesta la trae); un
// marcador validada no se toca. Todo se lee, valida y calcula antes de escribir: si algo falla no se escribe nada.
// La corrida sobre los datos reales es del PR de datos (spec 04, T4), que aprueba el editor.
// La lógica vive en scripts/lib/marcadores.ts; aquí solo se lee y se escribe.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Marcador } from '../src/data/tipos.ts';
import { aplicarPropuestas, argumentosAplicar, serializarMarcadores, validarPropuestas } from './lib/marcadores.ts';

const args = argumentosAplicar(process.argv.slice(2));
if (!args) {
  console.error('Uso: node scripts/aplicar-marcadores.ts [--propuestas <ruta>] [--marcadores <ruta>] [--resumen <ruta>]');
  process.exit(2);
}
const rutaPropuestas = resolve(args.propuestas);
const rutaMarcadores = resolve(args.marcadores);
const rutaResumen = resolve(args.resumen);
if (!existsSync(rutaPropuestas)) {
  console.error(`No está el archivo de propuestas en ${args.propuestas}. Genéralo con: python pipeline/ubicar-marcadores.py`);
  process.exit(2);
}

let resultado: ReturnType<typeof aplicarPropuestas>;
try {
  const propuestas: unknown = JSON.parse(readFileSync(rutaPropuestas, 'utf8'));
  const marcadores: unknown = JSON.parse(readFileSync(rutaMarcadores, 'utf8'));
  if (!Array.isArray(marcadores)) throw new Error(`${args.marcadores} no es una lista de marcadores`);
  resultado = aplicarPropuestas(marcadores as Marcador[], validarPropuestas(propuestas, marcadores as Marcador[]));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

writeFileSync(rutaMarcadores, serializarMarcadores(resultado.marcadores));
mkdirSync(dirname(rutaResumen), { recursive: true });
writeFileSync(rutaResumen, resultado.resumen);
const actualizados = (resultado.resumen.match(/^- Resultado: actualizado$/gm) ?? []).length;
console.log(`${actualizados} marcadores actualizados, ${resultado.marcadores.length - actualizados} sin cambios. Resumen: ${args.resumen}`);
