// Uso: node scripts/importar-revisiones.ts respuestas.csv
// Lee el CSV exportado de la hoja del formulario (F24) y escribe en pipeline/salida/revisiones/
// (carpeta ignorada por git) un resumen por estructura y un resumen.md con todo, que es el cuerpo
// del issue de la importación:
//   node tools/rockbuilt/rb.mjs gh issue-create --title "Revisiones docentes" --body-file pipeline/salida/revisiones/resumen.md --label rb:needs-human
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerEnvios, parsearCsv, resumenConsolidado, resumenMarkdown, type Envio } from './lib/revisiones.ts';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv');
  process.exit(2);
}
const datos = JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { ficha: { version: string } | null }>;
};
const ids = new Set(Object.keys(datos.estructuras));
const versionDe = (id: string) => datos.estructuras[id]?.ficha?.version ?? 'sin-ficha';
const { envios, invalidas } = leerEnvios(parsearCsv(readFileSync(archivo, 'utf8')), ids);
const porEstructura = new Map<string, Envio[]>();
for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);

const salida = join('pipeline', 'salida', 'revisiones');
mkdirSync(salida, { recursive: true });
for (const [id, lista] of porEstructura) {
  writeFileSync(join(salida, `${id}.md`), resumenMarkdown(id, lista, versionDe(id)));
}
writeFileSync(join(salida, 'resumen.md'), resumenConsolidado(envios, versionDe));
console.log(`${envios.length} envíos válidos, ${invalidas} filas descartadas. Resumen: ${join(salida, 'resumen.md')}`);
