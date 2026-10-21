// Credits on the license page (issue #270): config literals, the i18n keys that render them and the wiring in
// Licencia.tsx. `t(a.rol)` is a dynamic key, so check:i18n cannot see it; this test resolves the role keys itself.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTORES, URL_CONTRIBUIR, URL_REPO } from '../src/config/creditos';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';

const idiomas = { es, en } as const;

function buscar(arbol: unknown, clave: string): unknown {
  let nodo = arbol;
  for (const parte of clave.split('.')) nodo = (nodo as Record<string, unknown> | undefined)?.[parte];
  return nodo;
}

const NUEVAS = ['autoresTitulo', 'autoresIntro', 'roles.rafael', 'roles.lorena', 'aportaTitulo', 'aporta', 'repositorio', 'guiaAportes', 'aportaErrores'];
// Same patterns the public-view checks use (e2e/verificar-canal.spec.ts, tests/readme.test.ts).
const ALIAS = /\bD\d{2}\b/;
const REVISOR_CON_NOMBRE = /\b(?:[Rr]evisor(?:a|es)?|[Rr]eviewers?)\s*:?\s+\p{Lu}\p{Ll}+/u;
const VOSEO = /\bvos\b|\bsos\b|podés|tenés|querés|escribís|escribí(?![a-záéíóúñ])|mirá|fijate|hacé|revisá/i;

describe('src/config/creditos.ts', () => {
  it('lists Rafael first and Lorena second, with role keys and LinkedIn URLs', () => {
    expect(AUTORES).toEqual([
      { nombre: 'Rafael Andrés García', rol: 'licencia.roles.rafael', linkedin: 'https://www.linkedin.com/in/ragarciaga/' },
      { nombre: 'Lorena Gómez', rol: 'licencia.roles.lorena', linkedin: 'https://www.linkedin.com/in/loregomeza/' },
    ]);
  });

  it('points to the repository and its contribution guide', () => {
    expect(URL_REPO).toBe('https://github.com/ragarciaga/3d_brain');
    expect(URL_CONTRIBUIR).toBe('https://github.com/ragarciaga/3d_brain/blob/main/CONTRIBUTING.md');
  });
});

describe.each(['es', 'en'] as const)('licencia.* texts (%s)', (idioma) => {
  const arbol = idiomas[idioma];

  it('resolves each author role key to the exact role in the page language', () => {
    const esperado = idioma === 'es' ? ['Consultor IA', 'Psicóloga en formación'] : ['AI Consultant', 'Psychologist in training'];
    expect(AUTORES.map((a) => buscar(arbol, a.rol))).toEqual(esperado);
  });

  it('renames the footer link and keeps the page title', () => {
    expect(buscar(arbol, 'licencia.enlace')).toBe(idioma === 'es' ? 'Créditos y licencia' : 'Credits and license');
    expect(buscar(arbol, 'licencia.titulo')).toBe(idioma === 'es' ? 'Fuentes y licencia' : 'Sources and license');
  });

  it.each(NUEVAS)('has a non-empty licencia.%s', (clave) => {
    const valor = buscar(arbol, `licencia.${clave}`);
    expect(typeof valor).toBe('string');
    expect((valor as string).trim().length).toBeGreaterThan(0);
  });

  it('has no em dash, voseo, reviewer alias or "reviewer + Name" in the new texts', () => {
    for (const clave of NUEVAS) {
      const texto = buscar(arbol, `licencia.${clave}`) as string;
      expect(texto, clave).not.toContain(String.fromCharCode(0x2014));
      expect(texto, clave).not.toMatch(ALIAS);
      expect(texto, clave).not.toMatch(REVISOR_CON_NOMBRE);
      if (idioma === 'es') expect(texto, clave).not.toMatch(VOSEO);
    }
  });

  it('names the card button in the error reminder', () => {
    expect(buscar(arbol, 'licencia.aportaErrores')).toContain('{{boton}}');
    expect(typeof buscar(arbol, 'reporte.boton')).toBe('string');
  });
});

describe('Licencia.tsx wiring', () => {
  const fuente = readFileSync(resolve('src/components/Licencia.tsx'), 'utf8');

  it('renders the authors and the Contribute links from the config', () => {
    for (const nombre of ['AUTORES', 'URL_REPO', 'URL_CONTRIBUIR']) expect(fuente, nombre).toContain(nombre);
    expect(fuente).toContain('t(a.rol)');
  });

  it.each(NUEVAS.filter((c) => !c.startsWith('roles.')))('uses t(licencia.%s)', (clave) => {
    expect(fuente).toContain(`t('licencia.${clave}'`);
  });

  it('fills the card button name and opens external links safely', () => {
    expect(fuente).toContain("t('reporte.boton')");
    expect(fuente).toContain('rel="noopener noreferrer"');
    expect(fuente).toContain('target="_blank"');
  });
});
