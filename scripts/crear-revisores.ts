// Uso: node scripts/crear-revisores.ts 10 [base del sitio]
// Agrega revisores al padrón privado pipeline/revisores.local.json (ignorado por git; nunca lo
// subas: el repositorio es público) y escribe pipeline/salida/enlaces-docentes.md con el alias, el
// código y el enlace personal de revisión de cada uno, para repartirlos uno por uno.
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agregarRevisores, errorDePadron, type Padron } from './lib/revisiones.ts';

const n = Number(process.argv[2]);
const base = process.argv[3] ?? 'https://ragarciaga.github.io/3d_brain';
if (!Number.isInteger(n) || n < 1 || n > 100) {
  console.error('Uso: node scripts/crear-revisores.ts <cuántos, de 1 a 100> [base del sitio]');
  process.exit(2);
}
const ruta = join('pipeline', 'revisores.local.json');
const actual: unknown = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
const error = errorDePadron(actual);
if (error) {
  console.error(`Padrón inválido (${ruta}): ${error}`);
  process.exit(2);
}
const { padron, nuevos } = agregarRevisores(actual as Padron, n, randomInt);
writeFileSync(ruta, JSON.stringify(padron, null, 2) + '\n');

const filas = Object.entries(padron)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([codigo, alias]) => `| ${alias} | ${codigo} | ${base}/es/revision?r=${codigo} |  |`);
const md = [
  '# Enlaces de revisión por docente (privado, no subir)',
  '',
  'Escribe el nombre de cada docente en la última columna cuando le mandes su enlace. Su código',
  'también va en el formulario de registro. En los issues públicos solo aparece el alias.',
  '',
  '| Alias | Código | Enlace personal | Docente |',
  '|---|---|---|---|',
  ...filas,
  '',
].join('\n');
mkdirSync(join('pipeline', 'salida'), { recursive: true });
writeFileSync(join('pipeline', 'salida', 'enlaces-docentes.md'), md);
console.log(`${nuevos.length} revisores nuevos (${nuevos.map((x) => x[1]).join(', ')}). Padrón: ${ruta}. Enlaces: pipeline/salida/enlaces-docentes.md`);
