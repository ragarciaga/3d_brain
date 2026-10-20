// Route entry files for GitHub Pages (#265): the pure route functions, the real structure data and a
// real run of scripts/postbuild.ts in a temp directory.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { archivosDeRuta, escribirEntradas, rutasPublicas } from '../scripts/lib/entradas';
import estructurasJson from '../src/data/estructuras.json';

const raiz = resolve('.');
const estructuras = estructurasJson.estructuras as unknown as Record<string, { slug: { es: string; en: string } }>;
const una = { hipocampo: { slug: { es: 'hipocampo', en: 'hippocampus' } } };
const HTML = '<!doctype html><title>prueba</title><script type="module" src="/assets/index-x.js"></script>\n';

const carpetas: string[] = [];
const carpetaTemporal = () => {
  const c = mkdtempSync(join(tmpdir(), 'atlas-entradas-'));
  carpetas.push(c);
  return c;
};
afterEach(() => {
  while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
});

/** Every `.html` file under `dir`, as paths relative to it with `/` separators. */
function archivosHtml(dir: string, prefijo = ''): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) salida.push(...archivosHtml(join(dir, e.name), `${prefijo}${e.name}/`));
    else if (e.name.endsWith('.html')) salida.push(`${prefijo}${e.name}`);
  }
  return salida;
}

describe('rutasPublicas', () => {
  it('one structure gives the 10 sorted routes: two languages, three pages and the structure', () => {
    expect(rutasPublicas(una)).toEqual([
      '/en',
      '/en/hippocampus',
      '/en/licencia',
      '/en/privacy',
      '/en/revision',
      '/es',
      '/es/hipocampo',
      '/es/licencia',
      '/es/privacidad',
      '/es/revision',
    ]);
  });

  it('no structures give only the 8 language and page routes', () => {
    expect(rutasPublicas({})).toHaveLength(8);
  });

  it('a third structure that repeats an es slug writes that route once', () => {
    const rutas = rutasPublicas({
      ...una,
      amigdala: { slug: { es: 'amigdala', en: 'amygdala' } },
      otra: { slug: { es: 'hipocampo', en: 'other' } },
    });
    expect(rutas.filter((r) => r === '/es/hipocampo')).toHaveLength(1);
    expect(rutas).toContain('/en/other');
    // 8 language and page routes, es hipocampo and amigdala, en hippocampus, amygdala and other.
    expect(rutas).toHaveLength(13);
  });

  it('privacy uses its own slug per language', () => {
    const rutas = rutasPublicas({});
    expect(rutas).toContain('/en/privacy');
    expect(rutas).toContain('/es/privacidad');
    expect(rutas).not.toContain('/en/privacidad');
    expect(rutas).not.toContain('/es/privacy');
  });

  it('with the real data every slug of both languages is a route and nothing collapses', () => {
    const rutas = rutasPublicas(estructuras);
    expect(rutas).toHaveLength(2 * Object.keys(estructuras).length + 8);
    for (const e of Object.values(estructuras)) {
      expect(rutas, e.slug.es).toContain(`/es/${e.slug.es}`);
      expect(rutas, e.slug.en).toContain(`/en/${e.slug.en}`);
    }
    for (const r of ['/es/hipocampo', '/en/hippocampus', '/en/licencia', '/es/revision']) expect(rutas).toContain(r);
  });
});

describe('archivosDeRuta', () => {
  it('a language root gets both es.html and es/index.html', () => {
    expect(archivosDeRuta('/es')).toEqual(['es.html', 'es/index.html']);
    expect(archivosDeRuta('/en')).toEqual(['en.html', 'en/index.html']);
  });

  it('a structure route is a flat file, never a directory index (D2)', () => {
    expect(archivosDeRuta('/es/hipocampo')).toEqual(['es/hipocampo.html']);
    expect(archivosDeRuta('/en/hippocampus')).toEqual(['en/hippocampus.html']);
  });

  it.each(['/es/ínsula', '/es/a/b', '/es/..', '/fr/x', '/es/A', '/es/', '', 'es', '/', '/es/a b'])('throws on %j', (ruta) => {
    expect(() => archivosDeRuta(ruta)).toThrow(/Invalid route/);
  });
});

describe('escribirEntradas', () => {
  it('writes nested files with the same bytes as the source HTML and returns their count', () => {
    const dist = carpetaTemporal();
    const total = escribirEntradas(dist, HTML, ['/es', '/es/hipocampo']);
    expect(total).toBe(3);
    for (const f of ['es.html', 'es/index.html', 'es/hipocampo.html']) expect(readFileSync(join(dist, f), 'utf8'), f).toBe(HTML);
  });

  it('throws instead of overwriting an existing file with different content', () => {
    const dist = carpetaTemporal();
    writeFileSync(join(dist, 'es.html'), 'otro contenido');
    expect(() => escribirEntradas(dist, HTML, ['/es'])).toThrow(/different content/);
    expect(readFileSync(join(dist, 'es.html'), 'utf8')).toBe('otro contenido');
  });

  it('a second identical run succeeds', () => {
    const dist = carpetaTemporal();
    escribirEntradas(dist, HTML, ['/es', '/en/hippocampus']);
    expect(escribirEntradas(dist, HTML, ['/es', '/en/hippocampus'])).toBe(3);
  });

  it('a bad slug fails the run with a message naming the route', () => {
    expect(() => escribirEntradas(carpetaTemporal(), HTML, ['/es/Mala'])).toThrow(/\/es\/Mala/);
  });
});

describe('scripts/postbuild.ts on a fake dist', () => {
  it('writes 404.html and one identical copy per public route, with no directory index for structures', () => {
    const carpeta = carpetaTemporal();
    mkdirSync(join(carpeta, 'dist'));
    writeFileSync(join(carpeta, 'dist', 'index.html'), HTML);
    const r = spawnSync(process.execPath, [join(raiz, 'scripts/postbuild.ts')], { cwd: carpeta, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    const n = Object.keys(estructuras).length;
    expect(r.stdout).toContain(`${2 * n + 10} route entry files`);
    const dist = join(carpeta, 'dist');
    for (const f of [
      '404.html',
      'es.html',
      'es/index.html',
      'en.html',
      'en/index.html',
      'es/hipocampo.html',
      'en/hippocampus.html',
      'es/licencia.html',
      'en/licencia.html',
      'es/privacidad.html',
      'en/privacy.html',
      'es/revision.html',
      'en/revision.html',
    ]) {
      expect(readFileSync(join(dist, f), 'utf8'), f).toBe(HTML);
    }
    expect(existsSync(join(dist, 'es', 'hipocampo', 'index.html'))).toBe(false);
    expect(existsSync(join(dist, 'es', 'hipocampo'))).toBe(false);
    // 2N structure files, 8 language and page routes, 2 language index.html, plus index.html and 404.html.
    expect(archivosHtml(dist)).toHaveLength(2 * n + 12);
  });

  it('a structure slug that is not a safe file name fails the write (D4)', () => {
    // The script reads the real data, so the guard is exercised through the exported functions.
    expect(() => escribirEntradas(carpetaTemporal(), HTML, rutasPublicas({ x: { slug: { es: 'Mal', en: 'bad' } } }))).toThrow(/Invalid route "\/es\/Mal"/);
  });
});
