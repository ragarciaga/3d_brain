// Uso: node scripts/importar-revisiones.ts respuestas.csv
// Lee el CSV exportado de la hoja del formulario (F24) y escribe un resumen por estructura en
// pipeline/salida/revisiones/ (carpeta ignorada por git). Cada resumen sirve de cuerpo para un
// issue: node tools/rockbuilt/rb.mjs gh issue-create --title "Revisión: <id>" --body-file <archivo> --label rb:needs-human
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerEnvios, parsearCsv, resumenMarkdown, type Envio } from './lib/revisiones.ts';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/importar-revisiones.ts respuestas.csv');
  process.exit(2);
}
const datos = JSON.parse(readFileSync('src/data/estructuras.json', 'utf8')) as {
  estructuras: Record<string, { ficha: { version: string } | null }>;
};
const { envios, invalidas } = leerEnvios(parsearCsv(readFileSync(archivo, 'utf8')));
const porEstructura = new Map<string, Envio[]>();
for (const e of envios) porEstructura.set(e.estructura, [...(porEstructura.get(e.estructura) ?? []), e]);

const salida = join('pipeline', 'salida', 'revisiones');
mkdirSync(salida, { recursive: true });
for (const [id, lista] of porEstructura) {
  const version = datos.estructuras[id]?.ficha?.version ?? 'sin-ficha';
  const ruta = join(salida, `${id}.md`);
  writeFileSync(ruta, resumenMarkdown(id, lista, version));
  console.log(`${ruta}: ${lista.reduce((n, e) => n + e.respuestas.length, 0)} respuestas`);
}
console.log(`${envios.length} envíos leídos, ${invalidas} filas sin revisión válida.`);
