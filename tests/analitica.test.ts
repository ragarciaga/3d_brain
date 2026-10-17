// Analítica sin cookies (docs/adr/0015-analitica-sin-cookies.md): el beacon de Cloudflare Web Analytics solo
// entra al HTML del build de producción; el servidor de desarrollo (y con él los e2e) no lo inyecta.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { ATRIBUTO_BEACON, ATRIBUTO_DOCUMENTO, beaconCargado, decidirAdopcion, MARCA_RECARGA, SELECTOR_BEACON } from '../src/lib/analitica';
import config from '../vite.config.ts';

const raiz = resolve('.');
const TOKEN = '393b091d66f04f2fbcaac4aaddd18567'; // gitleaks:allow
const SCRIPT = 'https://static.cloudflareinsights.com/beacon.min.js';
const HTML_FALSO = '<!doctype html>\n<html>\n  <head>\n    <title>prueba</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n';

function plugin(): Plugin {
  const lista = (config.plugins ?? []).flat(8) as unknown as Plugin[];
  const p = lista.find((x) => x && x.name === 'analitica-cloudflare');
  if (!p) throw new Error('falta el plugin analitica-cloudflare en vite.config.ts');
  return p;
}

function transformar(html: string): string {
  const hook = plugin().transformIndexHtml;
  const handler = typeof hook === 'function' ? hook : hook && 'handler' in hook ? hook.handler : undefined;
  if (!handler) throw new Error('el plugin no define transformIndexHtml');
  // El hook solo usa el HTML; el contexto no importa.
  return (handler as unknown as (h: string, ctx: unknown) => string).call({}, html, {});
}


/** Cuerpo del único `<script>` inline del HTML transformado que menciona el beacon. */
function cargadorInline(html: string): string {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).filter((c) => c.includes('cloudflareinsights'));
  expect(inline).toHaveLength(1);
  return inline[0]!;
}

interface Creado {
  type?: string;
  src?: string;
  attrs: Record<string, string>;
  setAttribute(nombre: string, valor: string): void;
}

interface Ejecucion {
  scripts: Creado[];
  /** Atributos que el cargador puso en `<html>`. */
  html: Record<string, string>;
}

interface Entorno {
  /** Valor de `atlas:revisor` en localStorage; `'lanza'` hace que el acceso al almacén lance. */
  local?: string | 'lanza';
  session?: string | 'lanza';
  referrer?: string;
}

/** Corre el cargador contra `location`, `document` y `window` falsos y devuelve los `<script>` que habría agregado al head. */
function ejecutarCompleto(codigo: string, pathname: string, search: string, entorno: Entorno = {}): Ejecucion {
  const agregados: Creado[] = [];
  const html: Record<string, string> = {};
  const documento = {
    referrer: entorno.referrer ?? '',
    createElement: () => {
      const el: Creado = {
        attrs: {},
        setAttribute(nombre, valor) {
          el.attrs[nombre] = valor;
        },
      };
      return el;
    },
    head: { appendChild: (el: Creado) => agregados.push(el) },
    documentElement: {
      setAttribute: (nombre: string, valor: string) => {
        html[nombre] = valor;
      },
    },
  };
  const almacen = (valor: string | undefined) => {
    if (valor === 'lanza') throw new Error('almacenamiento bloqueado');
    return { getItem: (llave: string) => (llave === 'atlas:revisor' ? (valor ?? null) : null) };
  };
  const ventana = {
    get localStorage() {
      return almacen(entorno.local);
    },
    get sessionStorage() {
      return almacen(entorno.session);
    },
  };
  new Function('location', 'document', 'window', codigo)({ pathname, search }, documento, ventana);
  return { scripts: agregados, html };
}

function ejecutar(codigo: string, pathname: string, search: string, entorno: Entorno = {}): Creado[] {
  return ejecutarCompleto(codigo, pathname, search, entorno).scripts;
}

describe('beacon de Cloudflare Web Analytics (D1)', () => {
  it('el head lleva un cargador inline y ninguna etiqueta estática del beacon', () => {
    const salida = transformar(HTML_FALSO);
    expect(salida.match(/<script[^>]*src=[^>]*cloudflareinsights/g)).toBeNull();
    expect(salida.indexOf(SCRIPT)).toBeLessThan(salida.indexOf('</head>'));
    expect(salida.indexOf(SCRIPT)).toBeGreaterThan(salida.indexOf('<head>'));
  });

  it('en una ruta normal crea un solo script del beacon con el token exacto y spa desactivado', () => {
    const agregados = ejecutar(cargadorInline(transformar(HTML_FALSO)), '/es', '');
    expect(agregados).toHaveLength(1);
    const script = agregados[0]!;
    expect(script.src).toBe(SCRIPT);
    expect(script.type).toBe('module');
    expect(JSON.parse(script.attrs['data-cf-beacon']!)).toEqual({ token: TOKEN, spa: false });
  });

  it.each([
    ['/es', ''],
    ['/en', ''],
    ['/en/hipocampo', ''],
    ['/es/licencia', '?otro=1'],
  ])('carga el beacon en %s%s', (pathname, search) => {
    expect(ejecutar(cargadorInline(transformar(HTML_FALSO)), pathname, search)).toHaveLength(1);
  });

  it.each([
    ['/es/revision', '?r=X'],
    ['/en/revision', ''],
    ['/es', '?r=X'],
    ['/en/hipocampo', '?a=1&r=X'],
  ])('no carga el beacon en %s%s (el código del docente no sale hacia Cloudflare)', (pathname, search) => {
    expect(ejecutar(cargadorInline(transformar(HTML_FALSO)), pathname, search)).toHaveLength(0);
  });

  describe('navegador que recuerda un código de revisor (el código no sale hacia Cloudflare)', () => {
    const cargador = () => cargadorInline(transformar(HTML_FALSO));

    it('con un revisor recordado en localStorage no carga el beacon, ni en una ruta normal', () => {
      expect(ejecutar(cargador(), '/es', '', { local: 'ABC123' })).toHaveLength(0);
    });

    it('con un revisor solo en sessionStorage no carga el beacon', () => {
      expect(ejecutar(cargador(), '/es/hipocampo', '', { session: 'ABC123' })).toHaveLength(0);
    });

    it('un valor vacío en los almacenes no bloquea el beacon', () => {
      expect(ejecutar(cargador(), '/es', '', { local: '', session: '' })).toHaveLength(1);
    });

    it('si los almacenes lanzan, decide por la URL: ruta normal carga y ?r= no', () => {
      expect(ejecutar(cargador(), '/es', '', { local: 'lanza', session: 'lanza' })).toHaveLength(1);
      expect(ejecutar(cargador(), '/es', '?r=X', { local: 'lanza', session: 'lanza' })).toHaveLength(0);
    });

    it('si un almacén lanza pero el otro tiene el revisor, no carga', () => {
      expect(ejecutar(cargador(), '/es', '', { local: 'lanza', session: 'ABC123' })).toHaveLength(0);
    });

    it('con un referrer completo que trae ?r= no carga el beacon (defensa de reserva: strict-origin lo reduce al origen)', () => {
      expect(ejecutar(cargador(), '/es/licencia', '', { referrer: 'https://brain.maysasp.com/es/hipocampo?r=ABC123' })).toHaveLength(0);
    });

    it('con un referrer en /es/revision o /en/revision no carga el beacon', () => {
      expect(ejecutar(cargador(), '/es/licencia', '', { referrer: 'https://brain.maysasp.com/es/revision' })).toHaveLength(0);
      expect(ejecutar(cargador(), '/en', '', { referrer: 'https://brain.maysasp.com/en/revision' })).toHaveLength(0);
    });

    it('con un referrer normal, vacío o no válido sí carga el beacon', () => {
      expect(ejecutar(cargador(), '/es', '', { referrer: 'https://brain.maysasp.com/es/hipocampo' })).toHaveLength(1);
      expect(ejecutar(cargador(), '/es', '', { referrer: 'https://www.google.com/' })).toHaveLength(1);
      expect(ejecutar(cargador(), '/es', '', { referrer: '' })).toHaveLength(1);
      expect(ejecutar(cargador(), '/es', '', { referrer: 'no es una url' })).toHaveLength(1);
    });
  });

  describe('marca en <html> y vínculo con src/lib/analitica.ts (#149)', () => {
    const cargador = () => cargadorInline(transformar(HTML_FALSO));

    it('al crear el script marca <html> con data-beacon-cargado="1", con los nombres que lee la app', () => {
      const { scripts, html } = ejecutarCompleto(cargador(), '/es', '');
      expect(scripts).toHaveLength(1);
      expect(Object.keys(scripts[0]!.attrs)).toContain(ATRIBUTO_BEACON);
      expect(html[ATRIBUTO_DOCUMENTO]).toBe('1');
      expect(ATRIBUTO_BEACON).toBe('data-cf-beacon');
      expect(ATRIBUTO_DOCUMENTO).toBe('data-beacon-cargado');
      expect(SELECTOR_BEACON).toBe(`script[${ATRIBUTO_BEACON}]`);
    });

    it('si no crea el script (ruta de revisión, ?r= o código recordado), tampoco marca <html>', () => {
      expect(ejecutarCompleto(cargador(), '/es/revision', '').html).toEqual({});
      expect(ejecutarCompleto(cargador(), '/es', '?r=X').html).toEqual({});
      expect(ejecutarCompleto(cargador(), '/es', '', { local: 'ABC123' }).html).toEqual({});
    });
  });

  it('no toca el resto del HTML', () => {
    const salida = transformar(HTML_FALSO);
    expect(salida.replace(/ *<script>[\s\S]*?<\/script>\n/, '')).toBe(HTML_FALSO);
  });

  describe('404.html copia el cargador', () => {
    const carpetas: string[] = [];
    afterEach(() => {
      while (carpetas.length) rmSync(carpetas.pop()!, { recursive: true, force: true });
    });

    it('postbuild.ts copia a 404.html el index.html ya transformado, con el cargador', () => {
      const carpeta = mkdtempSync(join(tmpdir(), 'atlas-analitica-'));
      carpetas.push(carpeta);
      mkdirSync(join(carpeta, 'dist'));
      writeFileSync(join(carpeta, 'dist', 'index.html'), transformar(HTML_FALSO));
      const r = spawnSync(process.execPath, [join(raiz, 'scripts/postbuild.ts')], { cwd: carpeta, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      expect(existsSync(join(carpeta, 'dist', '404.html'))).toBe(true);
      const copia = readFileSync(join(carpeta, 'dist', '404.html'), 'utf8');
      expect(copia).toContain(SCRIPT);
      expect(copia).toContain(TOKEN);
      expect(ejecutar(cargadorInline(copia), '/es/revision', '?r=X')).toHaveLength(0);
    });
  });
});

describe('solo en producción (D2)', () => {
  it('el plugin aplica únicamente al build, no al servidor de desarrollo', () => {
    expect(plugin().apply).toBe('build');
  });

  it('index.html fuente no lleva el beacon (así el servidor de desarrollo no lo sirve)', () => {
    expect(readFileSync(join(raiz, 'index.html'), 'utf8')).not.toContain('cloudflareinsights');
  });

  it('index.html fuente pide strict-origin como referrer, para que el código de revisión no viaje en él', () => {
    const html = readFileSync(join(raiz, 'index.html'), 'utf8');
    expect(html).toMatch(/<meta name="referrer" content="strict-origin" \/>/);
  });
});

describe('beaconCargado (#149)', () => {
  const doc = (script: boolean, atributo: string | null) => ({
    querySelector: (sel: string) => (script && sel === SELECTOR_BEACON ? ({} as Element) : null),
    documentElement: { getAttribute: (n: string) => (n === ATRIBUTO_DOCUMENTO ? atributo : null) } as unknown as HTMLElement,
  });
  it('true con el script del beacon', () => {
    expect(beaconCargado(doc(true, null))).toBe(true);
  });
  it('true con solo la marca en <html>', () => {
    expect(beaconCargado(doc(false, '1'))).toBe(true);
  });
  it('false sin ninguna de las dos o con otro valor', () => {
    expect(beaconCargado(doc(false, null))).toBe(false);
    expect(beaconCargado(doc(false, '0'))).toBe(false);
  });
  it('false sin documento', () => {
    expect(beaconCargado(null)).toBe(false);
  });
});

describe('decidirAdopcion (#149)', () => {
  const sesion = (inicial: Record<string, string> = {}) => {
    const m = new Map(Object.entries(inicial));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  it('sin beacon adopta y borra la marca de recarga', () => {
    const s = sesion({ [MARCA_RECARGA]: '1' });
    expect(decidirAdopcion(false, s)).toBe('adoptar');
    expect(s.getItem(MARCA_RECARGA)).toBeNull();
  });
  it('sin beacon adopta aunque la sesión sea null o lance', () => {
    expect(decidirAdopcion(false, null)).toBe('adoptar');
    const peta = () => {
      throw new Error('bloqueado');
    };
    expect(decidirAdopcion(false, { getItem: peta, setItem: peta, removeItem: peta })).toBe('adoptar');
  });
  it('con beacon y sin marca recarga y deja la marca en 1', () => {
    const s = sesion();
    expect(decidirAdopcion(true, s)).toBe('recargar');
    expect(s.getItem(MARCA_RECARGA)).toBe('1');
  });
  it('con beacon y la marca ya puesta bloquea (una sola recarga)', () => {
    expect(decidirAdopcion(true, sesion({ [MARCA_RECARGA]: '1' }))).toBe('bloquear');
  });
  it('con beacon y setItem que lanza, o que no deja la marca, bloquea', () => {
    expect(
      decidirAdopcion(true, {
        getItem: () => null,
        setItem: () => {
          throw new Error('lleno');
        },
        removeItem: () => undefined,
      }),
    ).toBe('bloquear');
    expect(decidirAdopcion(true, { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })).toBe('bloquear');
  });
  it('con beacon y sin sessionStorage bloquea', () => {
    expect(decidirAdopcion(true, null)).toBe('bloquear');
  });
  it('un intento nuevo (tras adoptar sin beacon) vuelve a poder recargar una vez', () => {
    const s = sesion();
    expect(decidirAdopcion(true, s)).toBe('recargar');
    expect(decidirAdopcion(true, s)).toBe('bloquear');
    expect(decidirAdopcion(false, s)).toBe('adoptar');
    expect(decidirAdopcion(true, s)).toBe('recargar');
  });
});

describe('ADR 0015 dice lo que el código hace (#149)', () => {
  const adr = readFileSync(join(raiz, 'docs/adr/0015-analitica-sin-cookies.md'), 'utf8').replace(/\s+/g, ' ');
  const design = readFileSync(join(raiz, 'docs/specs/03-review-return-channel/design.md'), 'utf8');

  it('ya no promete que el beacon nunca se carga en el navegador de un revisor ni que no se mide nada', () => {
    expect(adr).not.toContain('nunca se carga en un navegador que está o estuvo en modo revisión');
    expect(adr).not.toContain('en las visitas de ese navegador mientras sea revisor no se mide nada');
    expect(adr).not.toContain('y el navegador de un revisor no lo carga');
    expect(adr).not.toContain('hasta que sale del modo revisión');
  });

  it('dice el alcance por página, la recarga con tope y la URL sin código', () => {
    expect(adr).toContain('Alcance por página');
    expect(adr).toContain('una página abierta antes conserva su beacon');
    expect(adr).toContain('puede enviar su conteo final al cerrarse o recargarse, también por la recarga');
    expect(adr).toContain('como mucho una recarga por intento de adopción');
    expect(adr).toContain('Atrás no vuelve a la URL con el código, pero el historial del navegador conserva la URL visitada');
    expect(adr).toContain('desde la siguiente carga de página el beacon vuelve a cargarse');
  });

  it('la confianza aceptada admite que un script viejo puede leer el código recordado', () => {
    expect(adr).toContain('puede leer el código recordado');
    expect(adr).toContain('cerrar las pestañas viejas');
  });

  it('el referrer es solo una defensa de reserva y Revisit when reconoce el GET de leer', () => {
    expect(adr).toContain('solo una defensa de reserva');
    expect(adr).toContain('`leer` iba por GET');
    expect(adr).toContain('desde #169 va por POST');
  });

  it('ni el ADR ni el diseño dicen que la huella sea irreversible o secreta', () => {
    expect(adr).not.toMatch(/irreversible|es secreta/i);
    const lineaHuella = design.split('\n').find((l) => l.includes('huella'))!;
    expect(lineaHuella).toContain('no es secreta');
    expect(lineaHuella).not.toMatch(/irreversible/i);
  });

  it('no usa el guion largo ni la frase retirada sobre la barra y el historial', () => {
    for (const texto of [adr, design]) {
      expect(texto).not.toContain('\u2014');
      expect(texto).not.toContain('el código no queda en la barra ni en el historial');
    }
  });
});
