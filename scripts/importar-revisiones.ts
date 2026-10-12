// Uso: node scripts/importar-revisiones.ts respuestas.csv [padrón]
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación:
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
// El padrón (código -> alias) es privado: por defecto pipeline/revisores.local.json, ignorado por
// git. Los envíos con un código fuera del padrón se descartan y los issues solo muestran el alias.
// La lógica vive en scripts/lib/revisiones.ts (importar); aquí solo se lee y se escribe.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorDePadron, importar, type Padron } from './lib/revisiones.ts';

const archivo = process.argv[2];
const rutaPadron = process.argv[3] ?? join('pipeline', 'revisores.local.json');
if (!archivo) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv [pipeline/revisores.local.json]');
  process.exit(2);
}
if (!existsSync(rutaPadron)) {
  console.error(`No está el padrón de revisores en ${rutaPadron}. Créalo con: node scripts/crear-revisores.ts 10`);
  process.exit(2);
}
const padron: unknown = JSON.parse(readFileSync(rutaPadron, 'utf8'));
const error = errorDePadron(padron);
if (error) {
  console.error(`Padrón inválido (${rutaPadron}): ${error}`);
  process.exit(2);
}
const datos = JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { ficha: { version: string } | null }>;
};
const { archivos, validos, invalidas, desconocidos } = importar(readFileSync(archivo, 'utf8'), datos.estructuras, padron as Padron);

const salida = join('pipeline', 'salida', 'revisiones');
mkdirSync(salida, { recursive: true });
for (const [nombre, contenido] of archivos) writeFileSync(join(salida, nombre), contenido);
console.log(
  `${validos} envíos válidos, ${invalidas} filas descartadas, ${desconocidos} con código fuera del padrón. Resumen: ${join(salida, 'resumen.md')}`,
);
