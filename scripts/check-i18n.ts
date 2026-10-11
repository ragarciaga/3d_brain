// Falla si una clave existe en un idioma y no en el otro, si hay textos vacíos o si el código usa
// una clave que no existe (AGENTS.md: cero textos en duro, F10).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clavesFaltantes, diferencias } from './lib/i18n.ts';

const es = JSON.parse(readFileSync('src/i18n/es.json', 'utf8'));
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const r = join(dir, f);
    return statSync(r).isDirectory() ? archivos(r) : /\.(tsx?|jsx?)$/.test(f) ? [r] : [];
  });
}
const codigo = archivos('src').map((f) => readFileSync(f, 'utf8')).join('\n');

const d = diferencias(es, en);
const faltan = clavesFaltantes(codigo, es);
const errores = [
  ...d.soloA.map((k) => `Solo en es.json: ${k}`),
  ...d.soloB.map((k) => `Solo en en.json: ${k}`),
  ...d.vacias.map((k) => `Texto vacío: ${k}`),
  ...faltan.map((k) => `El código usa una clave que no existe: ${k}`),
];
if (errores.length) {
  console.error(errores.join('\n'));
  process.exit(1);
}
console.log('check:i18n OK: es y en tienen las mismas claves y todas las usadas existen.');
