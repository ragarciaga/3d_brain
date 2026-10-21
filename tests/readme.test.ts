// README.md, README.es.md y CONTRIBUTING.md son la puerta de entrada pública (issue 258): enlaces vivos, anclas
// que saltan, nada de URL del canal de revisión ni nombres de proveedores de IA, y los dos README en espejo.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = resolve('.');
const ARCHIVOS = ['README.md', 'README.es.md', 'CONTRIBUTING.md'];
const LECTORES = ['README.md', 'README.es.md'];
const leer = (f: string) => readFileSync(join(raiz, f), 'utf8');
/** Sin bloques de código: lo que hay dentro no son enlaces. */
const sinCodigo = (f: string) => leer(f).replace(/^```[\s\S]*?^```/gm, '');

function destinos(f: string): string[] {
  const t = sinCodigo(f);
  const md = [...t.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1] ?? '');
  const html = [...t.matchAll(/\b(?:src|href|srcset)="([^"\s]+)"/g)].map((m) => m[1] ?? '');
  return [...md, ...html];
}
const relativos = (f: string) => destinos(f).filter((d) => !/^(https?:|mailto:)/.test(d));

/** Slug de GitHub: minúsculas, sin lo que no sea letra, número, espacio, `-` o `_`, y espacios a `-`. */
const slug = (h: string) => h.replace(/`/g, '').toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/ /g, '-');
const anclas = (f: string) => [...sinCodigo(f).matchAll(/^#{1,6} +(.+?) *$/gm)].map((m) => slug(m[1] ?? ''));
const encabezados2 = (f: string) => [...sinCodigo(f).matchAll(/^## +(.+?) *$/gm)].map((m) => m[1] ?? '');
const emoji = (s: string) => s.match(/\p{Extended_Pictographic}/gu) ?? [];
const imagenes = (f: string) => [...new Set(destinos(f).filter((d) => d.startsWith('docs/img/')))].sort();

describe('guion largo y voseo (D1)', () => {
  it.each(ARCHIVOS)('%s no tiene el guion largo', (f) => {
    expect(leer(f)).not.toContain(String.fromCharCode(0x2014));
  });
  it('README.es.md no tiene voseo', () => {
    expect(leer('README.es.md')).not.toMatch(/\bvos\b|\bsos\b|podés|tenés|querés|escribís|escribí(?![a-záéíóúñ])|mirá|fijate|hacé|revisá/i);
  });
});

describe('nada que no deba ser público (D2)', () => {
  const prohibidos: [string, RegExp][] = [
    ['URL del canal', /\/exec|script\.google|\/macros\//],
    ['código de revisor en la URL', /[?&]r=/],
    ['padrón de revisores', /revisores\.local|crear-revisores/],
    ['proveedor de IA', /\b(Claude|Anthropic|OpenAI|ChatGPT|Copilot|Cursor|Codex|Gemini)\b/],
  ];
  const casos = ARCHIVOS.flatMap((f) => prohibidos.map(([n, r]) => [f, n, r] as const));
  it.each(casos)('%s sin %s', (f, _n, r) => {
    expect(leer(f)).not.toMatch(r);
  });
});

describe('enlaces relativos y anclas (D3)', () => {
  it.each([['README.md', 15], ['README.es.md', 15], ['CONTRIBUTING.md', 3]] as const)('%s tiene al menos %i enlaces relativos', (f, min) => {
    expect(relativos(f).length).toBeGreaterThanOrEqual(min);
  });

  it.each(ARCHIVOS)('%s: cada enlace relativo existe y cada ancla coincide con un encabezado', (f) => {
    const rotos: string[] = [];
    for (const d of relativos(f)) {
      const [ruta = '', ancla] = d.split('#');
      if (ruta.startsWith('/')) {
        rotos.push(`${d} (ruta absoluta)`);
        continue;
      }
      const destino = ruta === '' ? f : join(dirname(f), decodeURIComponent(ruta));
      if (!existsSync(join(raiz, destino))) {
        rotos.push(`${d} (no existe)`);
        continue;
      }
      if (ancla && !(destino.endsWith('.md') && anclas(destino).includes(decodeURIComponent(ancla)))) rotos.push(`${d} (ancla sin encabezado)`);
    }
    expect(rotos).toEqual([]);
  });
});

describe('enlaces cruzados (D4)', () => {
  it('cada README enlaza al otro', () => {
    expect(destinos('README.md')).toContain('README.es.md');
    expect(destinos('README.es.md')).toContain('README.md');
  });
  it('CONTRIBUTING.md enlaza la sección de aportes en español', () => {
    expect(destinos('CONTRIBUTING.md')).toContain('README.es.md#-cómo-aportar');
  });
});

describe('capturas (D5)', () => {
  it.each([['README.md', 'en'], ['README.es.md', 'es']] as const)('%s muestra de 3 a 4 capturas de docs/img/%s, de 400 KB o menos', (f, idioma) => {
    const lista = imagenes(f);
    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista.length).toBeLessThanOrEqual(4);
    for (const i of lista) {
      expect(i.startsWith(`docs/img/${idioma}/`)).toBe(true);
      expect(statSync(join(raiz, i)).size).toBeLessThanOrEqual(409600);
    }
  });
  it('los dos idiomas usan los mismos nombres de archivo', () => {
    const nombres = (f: string) => imagenes(f).map((i) => i.split('/').pop());
    expect(nombres('README.es.md')).toEqual(nombres('README.md'));
  });
});

describe('espejo de secciones (D6, D7)', () => {
  it('los dos README tienen la misma secuencia de emoji en los encabezados ##, sin U+FE0F', () => {
    const [en, es] = LECTORES.map((f) => encabezados2(f));
    expect(en?.length).toBeGreaterThanOrEqual(10);
    expect(emoji((es ?? []).join('\n'))).toEqual(emoji((en ?? []).join('\n')));
    expect([...(en ?? []), ...(es ?? [])].join('')).not.toContain('\uFE0F');
  });

  const comunes = ['Rafael Andrés García', 'Lorena Gómez', 'https://www.linkedin.com/in/ragarciaga/', 'https://www.linkedin.com/in/loregomeza/', 'https://maysasp.com', 'info@maysasp.com', 'https://github.com/ragarciaga/rockbuilt', 'https://brain.maysasp.com/'];
  const roles: Record<string, string[]> = { 'README.md': ['AI Consultant', 'Psychologist in training'], 'README.es.md': ['Consultor IA', 'Psicóloga en formación'] };
  const casos = LECTORES.flatMap((f) => [...comunes, ...(roles[f] ?? []), f === 'README.md' ? 'Educational use. Not a clinical or diagnostic tool.' : 'Uso educativo. No es una herramienta clínica ni de diagnóstico.'].map((l) => [f, l] as const));
  it.each(casos)('%s contiene %s', (f, literal) => {
    expect(leer(f)).toContain(literal);
  });

  it.each(LECTORES)('%s lists Rafael first, then Lorena, under the authors heading', (f) => {
    const t = sinCodigo(f);
    const encabezado = t.search(/^## 👤 (Authors|Autores) *$/m);
    const rafael = t.indexOf('Rafael Andrés García', encabezado);
    const lorena = t.indexOf('Lorena Gómez', encabezado);
    expect(encabezado).toBeGreaterThan(-1);
    expect(rafael).toBeGreaterThan(encabezado);
    expect(lorena).toBeGreaterThan(rafael);
  });
});
