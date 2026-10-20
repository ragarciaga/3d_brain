// GitHub Pages has no rewrites, so the build writes the files it would otherwise lack
// (docs/adr/0005-hosting-github-pages.md):
//  - dist/404.html, a copy of index.html, so unknown paths, synonym aliases, other languages' slugs and
//    uppercase variants still load the app (Pages answers them with status 404).
//  - One byte-identical copy of index.html per public route (scripts/lib/entradas.ts), so /es, /en and
//    every structure URL answer 200. Structure URLs are flat files (es/hipocampo.html), not directory
//    indexes: a directory index makes Pages redirect to /es/hipocampo/ and the router would read the
//    slug as "hipocampo/".
// The structure list is read relative to this script, not to the working directory.
import { copyFileSync, readFileSync } from 'node:fs';
import { escribirEntradas, rutasPublicas } from './lib/entradas.ts';

const { estructuras } = JSON.parse(readFileSync(new URL('../src/data/estructuras.json', import.meta.url), 'utf8'));

copyFileSync('dist/index.html', 'dist/404.html');
const html = readFileSync('dist/index.html', 'utf8');
const archivos = escribirEntradas('dist', html, rutasPublicas(estructuras));
console.log(`dist/404.html and ${archivos} route entry files written`);
