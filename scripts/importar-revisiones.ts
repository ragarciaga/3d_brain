// Uso: node scripts/importar-revisiones.ts respuestas.csv
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación:
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
// La lógica vive en scripts/lib/revisiones.ts (importar); aquí solo se lee y se escribe.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importar } from './lib/revisiones.ts';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv');
  process.exit(2);
}
const datos = JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { ficha: { version: string } | null }>;
};
const { archivos, validos, invalidas } = importar(readFileSync(archivo, 'utf8'), datos.estructuras);

const salida = join('pipeline', 'salida', 'revisiones');
mkdirSync(salida, { recursive: true });
for (const [nombre, contenido] of archivos) writeFileSync(join(salida, nombre), contenido);
console.log(`${validos} envíos válidos, ${invalidas} filas descartadas. Resumen: ${join(salida, 'resumen.md')}`);
