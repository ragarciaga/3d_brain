// Analítica sin cookies (docs/adr/0015-analitica-sin-cookies.md): el beacon de Cloudflare Web Analytics solo
// entra al HTML del build de producción; el servidor de desarrollo (y con él los e2e) no lo inyecta.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
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

interface Entorno {
  /** Valor de `atlas:revisor` en localStorage; `'lanza'` hace que el acceso al almacén lance. */
  local?: string | 'lanza';
  session?: string | 'lanza';
  referrer?: string;
}

/** Corre el cargador contra `location`, `document` y `window` falsos y devuelve los `<script>` que habría agregado al head. */
function ejecutar(codigo: string, pathname: string, search: string, entorno: Entorno = {}): Creado[] {
  const agregados: Creado[] = [];
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
  return agregados;
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

  describe('navegador que es o fue modo revisión (el código no sale hacia Cloudflare)', () => {
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

    it('con un referrer que trae ?r= no carga el beacon (pestaña nueva desde la URL de revisión)', () => {
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
