// Dominio propio (docs/adr/0014-dominio-propio.md): el sitio vive en la raíz de brain.maysasp.com, así que
// el build no puede llevar la base /3d_brain/ y ningún archivo vivo debe presentar el dominio viejo como URL del sitio.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const raiz = resolve('.');

describe('base del build (D1)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([['true'], ['false'], [undefined]])('con GITHUB_PAGES=%s la base es la raíz', async (valor) => {
    vi.resetModules();
    if (valor === undefined) vi.stubEnv('GITHUB_PAGES', '');
    else vi.stubEnv('GITHUB_PAGES', valor);
    const config = (await import('../vite.config.ts')).default;
    expect(config.base).toBe('/');
  });

  it('index.html no fija rutas bajo /3d_brain/', () => {
    expect(readFileSync(join(raiz, 'index.html'), 'utf8')).not.toContain('/3d_brain/');
  });
});

/** Carpetas que no se revisan: dependencias, salidas, historia (specs y ADR) y archivos de la herramienta. */
const OMITIR = new Set(['node_modules', 'dist', '.git', '.rockbuilt', '.claude', '.cursor', '.codex', '.agents', 'test-results', 'playwright-report', '.venv-pipeline']);
const OMITIR_RUTAS = ['docs/specs', 'docs/adr', 'tools/rockbuilt'];
const EXTENSIONES = new Set(['.md', '.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.yml', '.yaml', '.py', '.csv', '.txt', '.svg']);

function archivos(carpeta: string, salida: string[] = []): string[] {
  for (const nombre of readdirSync(carpeta)) {
    if (OMITIR.has(nombre)) continue;
    const ruta = join(carpeta, nombre);
    const rel = relative(raiz, ruta).split(sep).join('/');
    if (OMITIR_RUTAS.includes(rel)) continue;
    if (statSync(ruta).isDirectory()) archivos(ruta, salida);
    else if (EXTENSIONES.has(extname(nombre))) salida.push(ruta);
  }
  return salida;
}

describe('enlaces del sitio (D2, D3)', () => {
  // Partido para que este archivo no se encuentre a sí mismo.
  const viejo = ['ragarciaga.github.io', '3d_brain'].join('/');

  it('ningún archivo vivo usa el dominio viejo como URL del sitio', () => {
    const lista = archivos(raiz);
    expect(lista.length).toBeGreaterThan(50);
    const con = lista.filter((f) => readFileSync(f, 'utf8').includes(viejo)).map((f) => relative(raiz, f));
    expect(con).toEqual([]);
  });

  it('docs/enlaces.md conserva exactamente los 9 enlaces a github.com del repositorio', () => {
    const repo = 'https://github.com/ragarciaga/3d_brain';
    const texto = readFileSync(join(raiz, 'docs/enlaces.md'), 'utf8');
    const halladas = [...texto.matchAll(/https:\/\/github\.com\/ragarciaga\/3d_brain[^\s|`)]*/g)].map((m) => m[0]);
    expect(halladas).toEqual([
      repo,
      `${repo}/pulls`,
      `${repo}/issues`,
      `${repo}/issues?q=is%3Aopen+label%3Arb%3Aneeds-human`,
      `${repo}/issues/1`,
      `${repo}/issues/6`,
      `${repo}/actions/workflows/pages.yml`,
      `${repo}/actions`,
      `${repo}/settings/pages`,
    ]);
  });

  it('docs/enlaces.md y el README apuntan a https://brain.maysasp.com', () => {
    expect(readFileSync(join(raiz, 'docs/enlaces.md'), 'utf8')).toContain('https://brain.maysasp.com/es');
    expect(readFileSync(join(raiz, 'README.md'), 'utf8')).toContain('https://brain.maysasp.com/');
  });

  it('crear-revisores.ts usa https://brain.maysasp.com como base por defecto', () => {
    const fuente = readFileSync(join(raiz, 'scripts/crear-revisores.ts'), 'utf8');
    expect(fuente).toMatch(/process\.argv\[3\] \?\? 'https:\/\/brain\.maysasp\.com'/);
  });

  it('existe el ADR 0014 aceptado', () => {
    const ruta = join(raiz, 'docs/adr/0014-dominio-propio.md');
    expect(existsSync(ruta)).toBe(true);
    const adr = readFileSync(ruta, 'utf8');
    expect(adr).toContain('Status: accepted');
    // Contenido de la decisión: dominio, DNS en Cloudflare sin proxy, hosting en Pages y base en la raíz.
    for (const clave of ['https://brain.maysasp.com', 'Cloudflare', '"DNS only"', 'GitHub Pages', 'base de Vite pasa a `/`']) {
      expect(adr).toContain(clave);
    }
  });
});

describe('404.html para las rutas profundas (ADR 0005, ADR 0014)', () => {
  const carpetas: string[] = [];
  afterEach(() => {
    while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
  });

  it('npm run build corre vite build y luego scripts/postbuild.ts', () => {
    const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(paquete.scripts.build).toBe('vite build && node scripts/postbuild.ts');
  });

  it('postbuild.ts deja dist/404.html idéntico a dist/index.html', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'atlas-postbuild-'));
    carpetas.push(carpeta);
    mkdirSync(join(carpeta, 'dist'));
    const html = '<!doctype html><title>prueba</title><script src="/assets/x.js"></script>\n';
    writeFileSync(join(carpeta, 'dist', 'index.html'), html);
    const r = spawnSync(process.execPath, [join(raiz, 'scripts/postbuild.ts')], { cwd: carpeta, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(join(carpeta, 'dist', '404.html'), 'utf8')).toBe(html);
  });
});
