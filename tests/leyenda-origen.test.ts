// Issue 261: la leyenda de origen (F25) es plegable. En celular arranca plegada como un botón pequeño; con huecos
// el botón plegado dice "Hueco en el tórax". Se prueba la vista pura (sin store ni matchMedia): en el render de
// servidor zustand usa el estado inicial y useMovil devuelve false.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { plegadaEfectiva, VistaLeyenda } from '../src/components/LeyendaOrigen';
import en from '../src/i18n/en.json';
import es from '../src/i18n/es.json';
import i18n from '../src/i18n';
import { useAtlas } from '../src/store/useAtlas';

const base = { plegada: false, hayTrazado: false, hayHuecos: false, solo: false, alAlternar() {}, alFiltrar() {} };
const render = (p: Partial<typeof base>) => renderToStaticMarkup(createElement(VistaLeyenda, { ...base, ...p }));

/** Etiqueta de apertura del elemento con ese id (para mirar sus atributos). */
function aperturaDe(html: string, id: string): string {
  const m = html.match(new RegExp(`<[a-z]+ [^>]*id="${id}"[^>]*>`));
  if (!m) throw new Error(`no hay elemento con id ${id}`);
  return m[0];
}

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

afterEach(async () => {
  useAtlas.setState({ leyendaPlegada: null });
  await i18n.changeLanguage('es');
});

describe('plegadaEfectiva', () => {
  it('sin elección sigue al celular; con elección la respeta', () => {
    expect(plegadaEfectiva(null, true)).toBe(true);
    expect(plegadaEfectiva(null, false)).toBe(false);
    expect(plegadaEfectiva(false, true)).toBe(false);
    expect(plegadaEfectiva(true, false)).toBe(true);
  });
});

describe('VistaLeyenda: aria y contenido (D5)', () => {
  it('desplegada: aria-expanded true y el contenido que controla el botón no está oculto', () => {
    const html = render({ plegada: false, hayHuecos: true });
    expect(html).toContain('aria-expanded="true"');
    const controla = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controla).toBe('leyenda-origen-contenido');
    expect(aperturaDe(html, controla!)).not.toContain('hidden');
  });

  it('plegada: aria-expanded false y el contenido controlado lleva hidden', () => {
    const html = render({ plegada: true, hayHuecos: true });
    expect(html).toContain('aria-expanded="false"');
    const controla = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(aperturaDe(html, controla!)).toContain('hidden');
  });
});

describe('VistaLeyenda: texto corto del hueco (D7)', () => {
  it('plegada con huecos lo muestra', () => {
    const html = render({ plegada: true, hayHuecos: true });
    expect(html).toContain('data-testid="leyenda-hueco-breve"');
    expect(html).toContain('Hueco en el tórax');
    expect(html).toContain('Leyenda');
  });

  it('plegada sin huecos no lo muestra', () => {
    const html = render({ plegada: true, hayHuecos: false, hayTrazado: true });
    expect(html).not.toContain('leyenda-hueco-breve');
    expect(html).not.toContain('Hueco en el tórax');
  });

  it('desplegada con huecos no lo muestra', () => {
    const html = render({ plegada: false, hayHuecos: true });
    expect(html).not.toContain('leyenda-hueco-breve');
  });

  it('en inglés, plegada con huecos: Legend y Thoracic gap', async () => {
    await i18n.changeLanguage('en');
    const html = render({ plegada: true, hayHuecos: true });
    expect(html).toContain('Legend');
    expect(html).toContain('Thoracic gap');
  });
});

describe('store (D7)', () => {
  it('leyendaPlegada empieza en null y setLeyendaPlegada lo cambia', () => {
    // El estado inicial de fábrica: el `afterEach` ya lo devolvió a null en el estado vivo, y eso no prueba nada.
    expect(useAtlas.getInitialState().leyendaPlegada).toBeNull();
    useAtlas.getState().setLeyendaPlegada(true);
    expect(useAtlas.getState().leyendaPlegada).toBe(true);
    useAtlas.getState().setLeyendaPlegada(false);
    expect(useAtlas.getState().leyendaPlegada).toBe(false);
  });
});

describe('claves de i18n (D6)', () => {
  for (const [idioma, textos] of [['es', es], ['en', en]] as const) {
    for (const clave of ['boton', 'huecoBreve'] as const) {
      it(`origen.${clave} en ${idioma} existe, no está vacío y no usa guion largo`, () => {
        const v = textos.origen[clave];
        expect(typeof v).toBe('string');
        expect(v.trim().length).toBeGreaterThan(0);
        expect(v).not.toContain(String.fromCharCode(0x2014));
        // Español de Bogotá: tú, nunca vos.
        expect(v).not.toMatch(/\b(vos|tenés|podés|querés)\b/i);
      });
    }
  }
});
