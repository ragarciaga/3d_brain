// Uso: node scripts/importar-revisiones.ts respuestas.csv [padrón] [--autorizaciones autorizaciones.csv]
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación. Antes de escribir (y solo si todo lo anterior salió bien) borra los .md de
// primer nivel que hayan quedado de una corrida anterior, sin seguir enlaces ni tocar nada más (ver
// scripts/lib/salida.ts):
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
// El padrón (código -> alias) es privado: por defecto pipeline/revisores.local.json, ignorado por
// git. Los envíos con un código fuera del padrón se descartan y los issues solo muestran el alias.
// --autorizaciones: CSV de la pestaña Autorizaciones. Las respuestas de trazos y rutas del vago de un
// revisor sin la casilla del vago no entran al resumen normal: salen en la sección "Descartadas: sin la
// casilla del vago". Las de un revisor sin ninguna fila en Autorizaciones (también las del vago) salen
// solo en "Descartadas: sin autorización", con alias, campo, idioma y estructura, y la consola dice cuántas
// son y de qué alias. Sin esa bandera el script corre, avisa y descarta todas las respuestas del vago; las
// demás respuestas entran a las tablas sin saber quién autorizó.
// Nunca imprime un código.
// La lógica vive en scripts/lib/revisiones.ts (importar); aquí solo se lee y se escribe.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { argumentosImportar, errorDePadron, importar, type Padron } from './lib/revisiones.ts';
import { vaciarSalida } from './lib/salida.ts';

const args = argumentosImportar(process.argv.slice(2));
if (!args) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv [pipeline/revisores.local.json] [--autorizaciones autorizaciones.csv]');
  process.exit(2);
}

/**
 * Lee un archivo de entrada o sale con 2 y un mensaje corto con el rol y la ruta. Nunca muestra el
 * contenido ni el mensaje del sistema (el de un JSON roto trae el trozo del texto, con códigos).
 */
function leer(ruta: string, falta: string): string {
  if (!existsSync(ruta)) {
    console.error(falta);
    process.exit(2);
  }
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    console.error(`No se pudo leer ${ruta}: revisa que sea un archivo y que tengas permiso para abrirlo.`);
    process.exit(2);
  }
}

const rutaPadron = args.padron ?? join('pipeline', 'revisores.local.json');
const textoAutorizaciones = args.autorizaciones
  ? leer(args.autorizaciones, `No está el CSV de Autorizaciones en ${args.autorizaciones}. Descárgalo de la pestaña Autorizaciones de la hoja del canal.`)
  : null;
const textoPadron = leer(rutaPadron, `No está el padrón de revisores en ${rutaPadron}. Créalo con: node scripts/crear-revisores.ts 10`);
const textoRespuestas = leer(args.csv, `No está el CSV de respuestas en ${args.csv}. Descárgalo de la pestaña Respuestas de la hoja del canal.`);
let padron: unknown;
try {
  padron = JSON.parse(textoPadron);
} catch {
  console.error(`Padrón inválido (${rutaPadron}): no es un JSON válido. Debe ser un objeto {"CODIGO": "D01", ...}.`);
  process.exit(2);
}
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
const { archivos, validos, invalidas, desconocidos, sinVago, autorizaciones, sinAutorizacion, aliasSinAutorizacion } = importar(
  textoRespuestas,
  datos.estructuras,
  padron as Padron,
  textoAutorizaciones,
);
if (autorizaciones === 0) {
  console.error('El CSV de Autorizaciones no tiene ninguna fila con un código válido: revisa que sea el de la pestaña Autorizaciones.');
}

// Todas las validaciones ya pasaron: desde aquí se borra y se escribe.
let salida: string;
try {
  salida = vaciarSalida('.', ['pipeline', 'salida', 'revisiones']).carpeta;
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
}
for (const [nombre, contenido] of archivos) writeFileSync(join(salida, nombre), contenido);
const sinAut = sinAutorizacion === null ? '' : `, ${sinAutorizacion} respuestas de revisores sin ninguna autorización`;
console.log(
  `${validos} envíos válidos, ${invalidas} filas descartadas, ${desconocidos} con código fuera del padrón, ${sinVago} respuestas del vago sin la casilla${sinAut}. Resumen: ${join(salida, 'resumen.md')}`,
);
if (aliasSinAutorizacion.length) {
  console.log(`Alias con respuestas sin ninguna autorización (van solo a "Descartadas: sin autorización"): ${aliasSinAutorizacion.join(', ')}`);
}
