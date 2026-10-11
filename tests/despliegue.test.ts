// Despliegue y descargas verificadas (issue 13): el flujo de GitHub Pages, la regla de .gitignore del
// entorno del pipeline y la verificación SHA-256 de pipeline/descargar.py se prueban aquí.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const lineas = (ruta: string) => readFileSync(ruta, 'utf8').split(/\r?\n/);

/** Líneas del bloque que cuelga de `lineas[inicio]` (más sangradas que ella); ignora las vacías. */
function bloque(todas: string[], inicio: number): string[] {
  const sangria = (s: string) => s.length - s.trimStart().length;
  const base = sangria(todas[inicio]!);
  const res: string[] = [];
  for (let i = inicio + 1; i < todas.length; i++) {
    const l = todas[i]!;
    if (l.trim() === '') continue;
    if (sangria(l) <= base) break;
    res.push(l);
  }
  return res;
}

/** Permisos `clave: valor` de un bloque `permissions:` (solo sus hijos directos). */
function permisos(todas: string[], inicio: number): string[] {
  return bloque(todas, inicio)
    .filter((l) => !l.trim().startsWith('#'))
    .map((l) => l.trim());
}

describe('flujo de GitHub Pages (.github/workflows/pages.yml)', () => {
  const todas = lineas('.github/workflows/pages.yml');
  const indice = (patron: RegExp, desde = 0) => todas.findIndex((l, i) => i >= desde && patron.test(l));

  const iJobs = indice(/^jobs:\s*$/);
  const iDeploy = indice(/^ {2}deploy:\s*$/, iJobs);
  const iBuild = indice(/^ {2}build:\s*$/, iJobs);
  const deploy = bloque(todas, iDeploy);

  it('el permiso global es solo contents: read', () => {
    const iPermisos = indice(/^permissions:\s*$/);
    expect(iPermisos).toBeGreaterThan(-1);
    expect(iPermisos).toBeLessThan(iJobs);
    expect(permisos(todas, iPermisos)).toEqual(['contents: read']);
  });

  it('pages: write e id-token: write solo aparecen en los permisos del job deploy', () => {
    const escritura = todas
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /^\s*(pages|id-token):\s*write\b/.test(l))
      .map(({ l }) => l.trim());
    expect(escritura.sort()).toEqual(['id-token: write', 'pages: write']);
    // Y las dos líneas están dentro del bloque de permisos del job deploy, no en build ni arriba.
    const iPermDeploy = deploy.findIndex((l) => /^ {4}permissions:\s*$/.test(l));
    expect(iPermDeploy).toBeGreaterThan(-1);
    const propios = permisos(deploy, iPermDeploy);
    expect(propios.sort()).toEqual(['id-token: write', 'pages: write']);
    const build = bloque(todas, iBuild);
    expect(build.some((l) => /\b(pages|id-token)\s*:/.test(l))).toBe(false);
  });

  it('cada paso uses: está fijado por SHA de 40 hex y es el versionado aprobado', () => {
    const fijadas = {
      'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1',
      'actions/setup-node': '949feb2413d6458794dcd2491c4babbbce0c15c1',
      'actions/configure-pages': '45bfe0192ca1faeb007ade9deae92b16b8254a0d',
      'actions/upload-pages-artifact': 'fc324d3547104276b827a68afc52ff2a11cc49c9',
      'actions/deploy-pages': '368f82528645a54fb793d4d04e342629a3f51346',
    };
    const usos = todas.filter((l) => /^\s*(-\s+)?uses:/.test(l));
    expect(usos.length).toBe(Object.keys(fijadas).length);
    const obtenidas: Record<string, string> = {};
    for (const l of usos) {
      const m = /uses:\s*([\w./-]+)@(\S+)/.exec(l);
      expect(m, l).not.toBeNull();
      expect(m![2], l).toMatch(/^[0-9a-f]{40}$/);
      obtenidas[m![1]!] = m![2]!;
    }
    expect(obtenidas).toEqual(fijadas);
  });

  it('configure-pages corre en el job deploy, donde están los permisos que necesita', () => {
    expect(deploy.some((l) => l.includes('actions/configure-pages@'))).toBe(true);
    expect(bloque(todas, iBuild).some((l) => l.includes('actions/configure-pages@'))).toBe(false);
  });
});

describe('.gitignore', () => {
  it('ignora el entorno virtual del pipeline', () => {
    expect(lineas('.gitignore').map((l) => l.trim())).toContain('.venv-pipeline/');
  });
});

describe('pipeline/descargar.py: verificar (SHA-256)', () => {
  const carpetas: string[] = [];
  afterEach(() => {
    while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
  });

  const contenido = 'contenido de prueba\n';
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');

  function correrVerificar(ruta: string, esperado: string) {
    // Mismo sys.path que usa descargar.py al importar comun.py; no hace falta bpy ni Blender.
    const guion = [
      'import sys',
      `sys.path.insert(0, ${JSON.stringify(resolve('pipeline'))})`,
      'from descargar import verificar',
      'verificar(sys.argv[1], sys.argv[2])',
    ].join('\n');
    const r = spawnSync('python3', ['-I', '-B', '-c', guion, ruta, esperado], { encoding: 'utf8' });
    if (r.error) {
      throw new Error(`No se pudo ejecutar python3 (${r.error.message}). Esta prueba necesita Python 3 en el PATH.`);
    }
    return r;
  }

  function archivoTemporal() {
    const carpeta = mkdtempSync(join(tmpdir(), 'atlas-verificar-'));
    carpetas.push(carpeta);
    const ruta = join(carpeta, 'descarga.bin');
    writeFileSync(ruta, contenido);
    return ruta;
  }

  it('con la suma correcta no borra el archivo y termina bien', () => {
    const ruta = archivoTemporal();
    const r = correrVerificar(ruta, sha(contenido));
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(existsSync(ruta)).toBe(true);
  });

  it('con una suma que no coincide borra el archivo y se detiene con error', () => {
    const ruta = archivoTemporal();
    const r = correrVerificar(ruta, sha('otro contenido'));
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('no coincide');
    expect(r.stderr).toContain('descarga.bin');
    expect(existsSync(ruta)).toBe(false);
  });
});
