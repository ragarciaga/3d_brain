import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estructuras } from '../src/data/atlas';
import { esPrivacidad, rutaPrivacidad, SLUG_LICENCIA, SLUG_PRIVACIDAD, SLUG_REVISION } from '../src/lib/paginas';

const leer = (ruta: string) => readFileSync(ruta, 'utf8');
/** Trozo de `texto` entre dos marcas; falla si alguna no existe, para que un corte vacío no deje pasar los expect. */
const entre = (texto: string, desde: string, hasta: string) => {
  const i = texto.indexOf(desde);
  expect(i, desde).toBeGreaterThan(-1);
  const f = texto.indexOf(hasta, i);
  expect(f, hasta).toBeGreaterThan(i);
  return texto.slice(i, f);
};

describe('rutas de las páginas de texto (#168)', () => {
  it('rutaPrivacidad da /es/privacidad y /en/privacy', () => {
    expect(rutaPrivacidad('es')).toBe('/es/privacidad');
    expect(rutaPrivacidad('en')).toBe('/en/privacy');
  });

  it('esPrivacidad acepta los dos slugs y nada más', () => {
    expect(esPrivacidad('privacidad')).toBe(true);
    expect(esPrivacidad('privacy')).toBe(true);
    for (const otro of ['licencia', 'revision', '', 'privacidad/x', 'Privacidad']) expect(esPrivacidad(otro), otro).toBe(false);
  });

  it('ninguna estructura usa un slug de privacidad', () => {
    const slugs = new Set(Object.values(SLUG_PRIVACIDAD));
    expect(slugs.size).toBe(2);
    const todas = Object.values(estructuras);
    expect(todas.length).toBeGreaterThan(0);
    for (const e of todas) {
      expect(slugs.has(e.slug.es), e.slug.es).toBe(false);
      expect(slugs.has(e.slug.en), e.slug.en).toBe(false);
    }
  });
});

describe('licencia and revision slugs (#265)', () => {
  it('have the values the router and the build entry files rely on', () => {
    expect(SLUG_LICENCIA).toBe('licencia');
    expect(SLUG_REVISION).toBe('revision');
  });

  it('no structure uses the licencia or revision slug in either language', () => {
    const reservados = new Set([SLUG_LICENCIA, SLUG_REVISION]);
    const todas = Object.values(estructuras);
    expect(todas.length).toBeGreaterThan(0);
    for (const e of todas) {
      expect(reservados.has(e.slug.es), e.slug.es).toBe(false);
      expect(reservados.has(e.slug.en), e.slug.en).toBe(false);
    }
  });

  it('main.tsx compares against the constants, not literals', () => {
    const main = leer('src/main.tsx');
    expect(main).toContain('resto === SLUG_LICENCIA');
    expect(main).toContain('resto === SLUG_REVISION');
  });
});

describe('cableado de la página Privacidad (#168)', () => {
  it('main.tsx la sirve cuando esPrivacidad(resto)', () => {
    const main = leer('src/main.tsx');
    expect(main).toContain('esPrivacidad(resto)');
    expect(main).toContain('<Privacidad />');
  });

  it('el pie de Pagina la enlaza después de Fuentes y licencia', () => {
    const pie = entre(leer('src/components/Pagina.tsx'), '<footer className="pie">', '</footer>');
    expect(pie).toContain('rutaPrivacidad(idioma)');
    expect(pie).toContain("t('privacidad.enlace')");
    expect(pie.indexOf("t('privacidad.enlace')")).toBeGreaterThan(pie.indexOf("t('licencia.enlace')"));
  });

  it('la línea de analítica de Fuentes y licencia enlaza a la página (P4)', () => {
    const linea = entre(leer('src/components/Licencia.tsx'), "t('licencia.analitica')", '</p>');
    expect(linea).toContain('rutaPrivacidad(');
    expect(linea).toContain("t('privacidad.leer')");
  });

  it('el diálogo de autorización la enlaza en otra pestaña, sin referrer (P3)', () => {
    const enlace = entre(leer('src/components/DialogoAutorizacion.tsx'), 'id="autorizacion-texto"', 'type="checkbox"');
    expect(enlace).toContain('rutaPrivacidad(');
    expect(enlace).toContain('target="_blank"');
    expect(enlace).toContain('noopener');
    expect(enlace).toContain('noreferrer');
    expect(enlace).toContain("t('privacidad.leer')");
  });
});
