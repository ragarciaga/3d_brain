// Uso: node scripts/importar-revisiones.ts respuestas.csv --padron padron.csv [--autorizaciones autorizaciones.csv]
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación. Antes de escribir (y solo si todo lo anterior salió bien) borra los .md de
// primer nivel que hayan quedado de una corrida anterior, sin seguir enlaces ni tocar nada más (ver
// scripts/lib/salida.ts):
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
// --padron: CSV de la pestaña Padrón de la hoja del canal (obligatorio, #257): es la única fuente del padrón
// (código -> alias). Debe tener la cabecera Código,Alias,Activo. Una fila con código o alias inválido se
// descarta con un aviso por su posición (nunca por su código); un alias repetido, un código con dos alias, una
// cabecera mala o ningún código válido salen con 2. Los envíos con un código fuera del padrón se descartan y los
// issues solo muestran el alias.
// Activo: las filas de la pestaña Respuestas de un código que no está en `sí` se importan igual; las del formulario
// de respaldo de ese código se descartan. La consola y resumen.md dicen, por alias, cuántas filas aportó cada uno.
// --autorizaciones: CSV de la pestaña Autorizaciones. Las respuestas de trazos y rutas del vago de un
// revisor sin la casilla del vago no entran al resumen normal: salen en la sección "Descartadas: sin la
// casilla del vago". Las de un revisor sin ninguna fila en Autorizaciones (también las del vago) salen
// solo en "Descartadas: sin autorización", con alias, campo, idioma y estructura, y la consola dice cuántas
// son y de qué alias. Sin esa bandera el script corre, avisa y descarta todas las respuestas del vago; las
// demás respuestas entran a las tablas sin saber quién autorizó.
// Un retiro (#217, solo en las filas de la pestaña Respuestas) quita las respuestas anteriores de esa clave del mismo
// revisor que llegaron en filas de esa pestaña (v:2); nunca las del formulario ni las v:1. "Marcas retiradas" de
// resumen.md y el conteo de la consola cuentan solo las claves que quedan sin ninguna respuesta (pueden ser 0).
// Nunca imprime un código.
// La lógica vive en scripts/lib/revisiones.ts (importar); aquí solo se lee y se escribe.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { argumentosImportar, importar, padronDeCsv, parsearCsvConVacias } from './lib/revisiones.ts';
import { vaciarSalida } from './lib/salida.ts';

const args = argumentosImportar(process.argv.slice(2));
if (!args) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv --padron padron.csv [--autorizaciones autorizaciones.csv]');
  process.exit(2);
}

/**
 * Lee un archivo de entrada o sale con 2 y un mensaje corto con el rol y la ruta. Nunca muestra el
 * contenido ni el mensaje del sistema.
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

const textoAutorizaciones = args.autorizaciones
  ? leer(args.autorizaciones, `No está el CSV de Autorizaciones en ${args.autorizaciones}. Descárgalo de la pestaña Autorizaciones de la hoja del canal.`)
  : null;
const textoPadron = leer(args.padron, `No está el CSV del Padrón en ${args.padron}. Descárgalo de la pestaña Padrón de la hoja del canal.`);
const textoRespuestas = leer(args.csv, `No está el CSV de respuestas en ${args.csv}. Descárgalo de la pestaña Respuestas de la hoja del canal.`);
const leido = padronDeCsv(parsearCsvConVacias(textoPadron));
if (leido.error) {
  console.error(`Padrón inválido (${args.padron}): ${leido.error}`);
  process.exit(2);
}
// Las filas descartadas se avisan por su posición y su alias, nunca por su código.
for (const aviso of leido.avisos) console.error(`Padrón (${args.padron}): ${aviso}`);
const datos = JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { ficha: { version: string } | null }>;
};
if (!args.autorizaciones) {
  console.error('Sin --autorizaciones: todas las respuestas de trazos y rutas del vago van a "Descartadas: sin la casilla del vago".');
}
const { archivos, validos, invalidas, desconocidos, sinVago, autorizaciones, sinAutorizacion, aliasSinAutorizacion, retiradas, inactivos } = importar(
  textoRespuestas,
  datos.estructuras,
  leido.padron,
  textoAutorizaciones,
  leido.inactivos,
);
for (const f of inactivos) {
  console.error(
    `Código inactivo (Activo distinto de sí) del alias ${f.alias}: filas de Respuestas importadas: ${f.aceptadas}; filas del formulario descartadas: ${f.descartadasFormulario}.`,
  );
}
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
  `${validos} envíos válidos, ${invalidas} filas descartadas, ${desconocidos} con código fuera del padrón, ${sinVago} respuestas del vago sin la casilla${sinAut}, ${retiradas} marcas retiradas. Resumen: ${join(salida, 'resumen.md')}`,
);
if (aliasSinAutorizacion.length) {
  console.log(`Alias con respuestas sin ninguna autorización (van solo a "Descartadas: sin autorización"): ${aliasSinAutorizacion.join(', ')}`);
}
