// Uso: node scripts/importar-revisiones.ts respuestas.csv [padrón] [--autorizaciones autorizaciones.csv]
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación:
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
// El padrón (código -> alias) es privado: por defecto pipeline/revisores.local.json, ignorado por
// git. Los envíos con un código fuera del padrón se descartan y los issues solo muestran el alias.
// --autorizaciones: CSV de la pestaña Autorizaciones. Las respuestas de trazos y rutas del vago de un
// revisor sin la casilla del vago (o sin autorización) no entran al resumen normal: salen en la sección
// "Descartadas: sin la casilla del vago". Sin esa bandera el script corre, avisa y descarta todas las
// respuestas del vago. Nunca imprime un código.
// La lógica vive en scripts/lib/revisiones.ts (importar); aquí solo se lee y se escribe.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { argumentosImportar, errorDePadron, importar, type Padron } from './lib/revisiones.ts';

const args = argumentosImportar(process.argv.slice(2));
if (!args) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv [pipeline/revisores.local.json] [--autorizaciones autorizaciones.csv]');
  process.exit(2);
}
if (args.autorizaciones && !existsSync(args.autorizaciones)) {
  console.error(`No está el CSV de Autorizaciones en ${args.autorizaciones}. Descárgalo de la pestaña Autorizaciones de la hoja del canal.`);
  process.exit(2);
}
const rutaPadron = args.padron ?? join('pipeline', 'revisores.local.json');
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
if (!args.autorizaciones) {
  console.error('Sin --autorizaciones: todas las respuestas de trazos y rutas del vago van a "Descartadas: sin la casilla del vago".');
}
const textoAutorizaciones = args.autorizaciones ? readFileSync(args.autorizaciones, 'utf8') : null;
const { archivos, validos, invalidas, desconocidos, sinVago, autorizaciones } = importar(
  readFileSync(args.csv, 'utf8'),
  datos.estructuras,
  padron as Padron,
  textoAutorizaciones,
);
if (autorizaciones === 0) {
  console.error('El CSV de Autorizaciones no tiene ninguna fila con un código válido: revisa que sea el de la pestaña Autorizaciones.');
}

const salida = join('pipeline', 'salida', 'revisiones');
mkdirSync(salida, { recursive: true });
for (const [nombre, contenido] of archivos) writeFileSync(join(salida, nombre), contenido);
console.log(
  `${validos} envíos válidos, ${invalidas} filas descartadas, ${desconocidos} con código fuera del padrón, ${sinVago} respuestas del vago sin la casilla. Resumen: ${join(salida, 'resumen.md')}`,
);
