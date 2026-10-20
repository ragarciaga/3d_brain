// Route entry files for GitHub Pages (#265). Pages has no rewrites, so every public route needs a real
// file in dist/ or it answers 404 (even though 404.html still loads the app). The pure functions here
// decide which routes exist and which files they map to; `escribirEntradas` writes the copies.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Bilingue, Idioma } from '../../src/data/tipos.ts';
import { SLUG_LICENCIA, SLUG_PRIVACIDAD, SLUG_REVISION } from '../../src/lib/paginas.ts';

const IDIOMAS: Idioma[] = ['es', 'en'];
const SLUG_VALIDO = /^[a-z0-9-]+$/;

/**
 * Every public route the router resolves: the two language roots, the three text pages and one route
 * per structure and language. Deduplicated and sorted.
 */
export function rutasPublicas(estructuras: Record<string, { slug: Bilingue }>): string[] {
  const rutas = new Set<string>();
  for (const idioma of IDIOMAS) {
    rutas.add(`/${idioma}`);
    rutas.add(`/${idioma}/${SLUG_LICENCIA}`);
    rutas.add(`/${idioma}/${SLUG_PRIVACIDAD[idioma]}`);
    rutas.add(`/${idioma}/${SLUG_REVISION}`);
    for (const e of Object.values(estructuras)) rutas.add(`/${idioma}/${e.slug[idioma]}`);
  }
  return [...rutas].sort();
}

/**
 * Files (relative to dist, `/` separators) that serve a route. A language root gets both `es.html` and
 * `es/index.html`. Every other route gets a flat `<lang>/<slug>.html` and never a directory index:
 * Pages answers a directory index with a 301 to the trailing-slash URL, and the router would then read
 * the slug as `hipocampo/` and show "not found".
 * Throws on a language other than es/en, a slug outside `[a-z0-9-]+` or more than two segments.
 */
export function archivosDeRuta(ruta: string): string[] {
  const partes = ruta.split('/');
  if (partes[0] !== '' || partes.length < 2 || partes.length > 3) throw new Error(`Invalid route "${ruta}": expected /<lang> or /<lang>/<slug>`);
  const idioma = partes[1]!;
  if (!(IDIOMAS as string[]).includes(idioma)) throw new Error(`Invalid route "${ruta}": language must be es or en`);
  if (partes.length === 2) return [`${idioma}.html`, `${idioma}/index.html`];
  const slug = partes[2]!;
  if (!SLUG_VALIDO.test(slug)) throw new Error(`Invalid route "${ruta}": slug must match ${SLUG_VALIDO}`);
  return [`${idioma}/${slug}.html`];
}

/**
 * Writes `html` once per file of each route under `dist`. Returns the number of files in the route
 * list. An existing file with different content (a collision with public/) throws; one with the same
 * content is left alone, so a rerun is safe.
 */
export function escribirEntradas(dist: string, html: string, rutas: string[]): number {
  let total = 0;
  for (const ruta of rutas) {
    for (const relativo of archivosDeRuta(ruta)) {
      const destino = join(dist, ...relativo.split('/'));
      mkdirSync(dirname(destino), { recursive: true });
      if (existsSync(destino)) {
        if (readFileSync(destino, 'utf8') !== html) throw new Error(`Refusing to overwrite ${destino}: it exists with different content`);
      } else {
        writeFileSync(destino, html);
      }
      total++;
    }
  }
  return total;
}
