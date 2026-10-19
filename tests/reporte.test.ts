// Reportar un error (F12): las partes que se pueden señalar salen de la ficha, la descripción se valida, el enlace
// a GitHub y el enlace de correo se arman solo con los datos del reporte y los textos del reporte existen en los
// dos idiomas.
import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import {
  CORREO_REPORTES,
  MAX_DESCRIPCION,
  MAX_URL,
  PLANTILLA,
  TIPOS,
  URL_ISSUES,
  type TipoReporte,
} from '../src/config/reporte';
import { estructuras } from '../src/data/atlas';
import { camposDeFicha } from '../src/lib/prioridad';
import {
  cabeEnGithub,
  descripcionValida,
  enlaceCorreo,
  enlaceGithub,
  partesDeFicha,
  type Reporte,
} from '../src/lib/reporte';

const COPIA = 'copia-de-prueba-reporte';
const conFicha = Object.keys(estructuras).filter((id) => estructuras[id]!.ficha);
// Campo de una clave de respuesta `${id}|${campo}|${idioma}`.
const campoDe = (id: string, clave: string) => clave.slice(id.length + 1, clave.lastIndexOf('|'));
const camposSinIdioma = (id: string, idioma: 'es' | 'en') =>
  new Set(camposDeFicha(id, idioma).map((clave) => campoDe(id, clave)));

describe('partesDeFicha', () => {
  it('gracile-lobule: general, los campos de la ficha sin idioma y sin dudas', () => {
    const f = estructuras['gracile-lobule']?.ficha;
    expect(f).toBeTruthy();
    const esperado = [
      'general',
      'nombre',
      'latin',
      'pieza',
      'que_es',
      'para_que_sirve',
      'ubicacion',
      'relaciones',
      ...f!.relevancia.map((_, i) => `relevancia.${i}`),
      ...f!.fuentes.map((_, i) => `fuente.${i}`),
      ...(f!.recursos.length > 0 ? ['recursos'] : []),
    ];
    const partes = partesDeFicha('gracile-lobule');
    expect(partes).toEqual(esperado);
    // Esta ficha tiene una duda abierta (duda.0) en la revisión, y no sale como parte.
    expect(camposDeFicha('gracile-lobule', 'es').some((k) => k.includes('|duda.0|'))).toBe(true);
    expect(partes.some((p) => p.startsWith('duda.'))).toBe(false);
  });

  it('recursos va al final solo si la ficha tiene recursos propios', () => {
    const con = conFicha.find((id) => estructuras[id]!.ficha!.recursos.length > 0);
    expect(con).toBeTruthy();
    expect(partesDeFicha(con!).at(-1)).toBe('recursos');
    // Hoy todas las fichas tienen recursos: la variante sin recursos es una copia en memoria, que se quita al terminar.
    const base = estructuras[con!]!;
    estructuras[COPIA] = { ...base, ficha: { ...base.ficha!, recursos: [] } };
    try {
      const partes = partesDeFicha(COPIA);
      expect(partes).not.toContain('recursos');
      expect(partes).toContain('que_es');
    } finally {
      delete estructuras[COPIA];
    }
  });

  it('sinonimos sale una sola vez aunque haya sinónimos en es y en, y nombre una sola vez', () => {
    const ambos = conFicha.find((id) => estructuras[id]!.sinonimos.es.length > 0 && estructuras[id]!.sinonimos.en.length > 0);
    expect(ambos).toBeTruthy();
    // La ficha de prueba produce las dos claves de sinónimos; las partes las juntan en una.
    expect(camposDeFicha(ambos!, 'es').filter((k) => k.includes('|sinonimos|'))).toHaveLength(2);
    expect(partesDeFicha(ambos!).filter((p) => p === 'sinonimos')).toHaveLength(1);
    for (const id of conFicha) expect(partesDeFicha(id).filter((p) => p === 'nombre')).toHaveLength(1);
  });

  it('sin ficha o con un id que no existe: general y nombre', () => {
    expect(partesDeFicha('no-existe')).toEqual(['general', 'nombre']);
    // Hoy todas las entradas tienen ficha: la entrada sin ficha es una copia en memoria, que se quita al terminar.
    estructuras[COPIA] = { ...estructuras[conFicha[0]!]!, ficha: null };
    try {
      expect(partesDeFicha(COPIA)).toEqual(['general', 'nombre']);
    } finally {
      delete estructuras[COPIA];
    }
  });

  it('en todas las fichas: general primero, sin repetidas, sin dudas ni posición ni trazos', () => {
    expect(conFicha.length).toBeGreaterThan(20);
    for (const id of conFicha) {
      const partes = partesDeFicha(id);
      expect(partes[0], id).toBe('general');
      expect(new Set(partes).size, id).toBe(partes.length);
      expect(partes.filter((p) => /^duda\.|^posicion$|^trazo:|^trazado_/.test(p)), id).toEqual([]);
    }
  });

  it('cada parte (salvo general y recursos) es un campo de camposDeFicha, en los dos idiomas (R7.1)', () => {
    for (const id of conFicha) {
      const es = camposSinIdioma(id, 'es');
      const en = camposSinIdioma(id, 'en');
      for (const p of partesDeFicha(id).filter((x) => x !== 'general' && x !== 'recursos')) {
        expect(es.has(p), `${id} ${p} es`).toBe(true);
        expect(en.has(p), `${id} ${p} en`).toBe(true);
      }
    }
  });
});

describe('descripcionValida', () => {
  it('rechaza lo vacío y lo que solo tiene espacios', () => {
    expect(descripcionValida('')).toBe(false);
    expect(descripcionValida(' ')).toBe(false);
    expect(descripcionValida(' \n\t ')).toBe(false);
  });

  it('acepta de 1 a 1500 caracteres y rechaza 1501', () => {
    expect(descripcionValida('a')).toBe(true);
    expect(descripcionValida('a'.repeat(1500))).toBe(true);
    expect(descripcionValida('a'.repeat(1501))).toBe(false);
  });

  it('mide el texto crudo, no el recortado', () => {
    expect(descripcionValida(' ' + 'a'.repeat(1500))).toBe(false);
  });
});

describe('constantes del reporte', () => {
  it('los límites son los del diseño', () => {
    expect(MAX_DESCRIPCION).toBe(1500);
    expect(MAX_URL).toBe(8000);
  });
});

const leerJson = (lng: 'es' | 'en') => JSON.parse(readFileSync(new URL(`../src/i18n/${lng}.json`, import.meta.url), 'utf8'));
const crearT = async (lng: 'es' | 'en') => {
  const i = i18next.createInstance();
  await i.init({ lng, resources: { [lng]: { translation: leerJson(lng) } }, interpolation: { escapeValue: false } });
  return i.getFixedT(lng);
};

const ID = 'gracile-lobule';
const base = (parcial: Partial<Reporte> = {}): Reporte => ({
  tipo: 'contenido',
  estructura: ID,
  nombre: 'Lóbulo grácil',
  idioma: 'es',
  version: estructuras[ID]!.ficha!.version,
  parte: 'que_es',
  descripcion: 'Falta una fuente.',
  ...parcial,
});
const PARAMS = ['template', 'title', 'estructura', 'idioma', 'version', 'parte', 'descripcion'];

describe('enlaceGithub (R3.1 a R3.3)', () => {
  it('empieza por la URL de issues nueva y trae la plantilla de cada tipo', async () => {
    const t = await crearT('es');
    for (const tipo of TIPOS) {
      const enlace = enlaceGithub(base({ tipo }), t);
      expect(enlace.startsWith('https://github.com/ragarciaga/3d_brain/issues/new?'), tipo).toBe(true);
      expect(enlace.startsWith(`${URL_ISSUES}?`), tipo).toBe(true);
      expect(new URL(enlace).searchParams.get('template'), tipo).toBe(PLANTILLA[tipo]);
    }
  });

  it('cada parámetro trae su valor exacto', async () => {
    const t = await crearT('es');
    const r = base({ parte: 'relevancia.1', descripcion: 'Dice otra cosa.' });
    const p = new URL(enlaceGithub(r, t)).searchParams;
    expect(p.get('estructura')).toBe(ID);
    expect(p.get('idioma')).toBe('es');
    expect(p.get('version')).toBe(estructuras[ID]!.ficha!.version);
    expect(p.get('version')).toBeTruthy();
    expect(p.get('parte')).toBe('relevancia.1');
    expect(p.get('descripcion')).toBe('Dice otra cosa.');
  });

  it('title es "[<tipo traducido>] <nombre> (<id>)" con el JSON del idioma, para los cuatro tipos', async () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = await crearT(idioma);
      const json = leerJson(idioma);
      for (const tipo of TIPOS) {
        const params = new URL(enlaceGithub(base({ tipo, idioma }), t)).searchParams;
        expect(params.get('idioma'), `${idioma} ${tipo}`).toBe(idioma);
        const title = params.get('title');
        expect(title, `${idioma} ${tipo}`).toBe(`[${json.reporte.tipo[tipo]}] Lóbulo grácil (${ID})`);
      }
    }
    const es = new URL(enlaceGithub(base(), await crearT('es'))).searchParams.get('title');
    const en = new URL(enlaceGithub(base({ idioma: 'en' }), await crearT('en'))).searchParams.get('title');
    expect(es).toBe('[Contenido] Lóbulo grácil (gracile-lobule)');
    expect(en).toBe('[Content] Lóbulo grácil (gracile-lobule)');
  });

  it('los parámetros son exactamente siete, en este orden', async () => {
    const t = await crearT('es');
    for (const tipo of TIPOS) {
      expect([...new URL(enlaceGithub(base({ tipo }), t)).searchParams.keys()], tipo).toEqual(PARAMS);
    }
  });

  it('no lee la ubicación de la página: ?r= y #r= no salen en el enlace (R3.2)', async () => {
    const t = await crearT('es');
    const location = { search: '?r=PRUEBA01', hash: '#r=PRUEBA01', href: 'https://x.test/?r=PRUEBA01#r=PRUEBA01' };
    vi.stubGlobal('location', location);
    vi.stubGlobal('window', { location });
    try {
      const enlace = enlaceGithub(base(), t);
      expect(enlace).not.toContain('PRUEBA01');
      expect(enlace).not.toContain('r=');
      const url = new URL(enlace);
      expect(url.searchParams.has('r')).toBe(false);
      expect([...url.searchParams.keys()]).toEqual(PARAMS);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('un texto con #, &, +, %20, salto de línea, comillas y tildes vuelve intacto y el enlace no tiene hash (R3.3)', async () => {
    const t = await crearT('es');
    const texto = 'Dice "núcleo" #3 & más + 50%20\nñ á ü \'ok\'';
    const enlace = enlaceGithub(base({ descripcion: texto, parte: 'a&b#c' }), t);
    const url = new URL(enlace);
    expect(url.searchParams.get('descripcion')).toBe(texto);
    expect(url.searchParams.get('parte')).toBe('a&b#c');
    expect(url.hash).toBe('');
    expect(enlace).not.toContain('#');
    expect([...url.searchParams.keys()]).toEqual(PARAMS);
  });

  it('1500 caracteres ASCII con espacios dan un enlace de 8000 o menos', async () => {
    const t = await crearT('es');
    const descripcion = 'palabra '.repeat(188).slice(0, 1500);
    expect(descripcion).toHaveLength(1500);
    expect(enlaceGithub(base({ descripcion }), t).length).toBeLessThanOrEqual(MAX_URL);
  });
});

describe('cabeEnGithub (R3.4)', () => {
  it('es verdadero en exactamente MAX_URL caracteres y falso en uno más', async () => {
    const t = await crearT('es');
    const l0 = enlaceGithub(base({ descripcion: '' }), t).length;
    const exacto = base({ descripcion: 'a'.repeat(MAX_URL - l0) });
    expect(enlaceGithub(exacto, t)).toHaveLength(MAX_URL);
    expect(cabeEnGithub(exacto, t)).toBe(true);
    const pasado = base({ descripcion: 'a'.repeat(MAX_URL - l0 + 1) });
    expect(enlaceGithub(pasado, t)).toHaveLength(MAX_URL + 1);
    expect(cabeEnGithub(pasado, t)).toBe(false);
  });

  it('es verdadero con 1500 caracteres ASCII con espacios', async () => {
    const t = await crearT('es');
    expect(cabeEnGithub(base({ descripcion: 'palabra '.repeat(188).slice(0, 1500) }), t)).toBe(true);
  });

  it('es falso con 1500 emojis y con 750 emojis (descripción válida)', async () => {
    const t = await crearT('es');
    const mil500 = '😀'.repeat(1500);
    const sete50 = '😀'.repeat(750);
    expect(sete50.length).toBe(1500);
    expect(descripcionValida(sete50)).toBe(true);
    expect(cabeEnGithub(base({ descripcion: mil500 }), t)).toBe(false);
    expect(cabeEnGithub(base({ descripcion: sete50 }), t)).toBe(false);
  });
});

// Una instancia con la interpolación por omisión de i18next (escapa HTML), como la tendría un llamador descuidado.
const crearTEscapado = async (lng: 'es' | 'en') => {
  const i = i18next.createInstance();
  await i.init({ lng, resources: { [lng]: { translation: leerJson(lng) } } });
  return i.getFixedT(lng);
};
const PREFIJO_CORREO = `mailto:${CORREO_REPORTES}?`;
// Asunto y cuerpo decodificados: exige exactamente dos pares, `subject` y `body`, en ese orden.
const partes = (enlace: string) => {
  expect(enlace.startsWith(PREFIJO_CORREO)).toBe(true);
  const pares = enlace.slice(PREFIJO_CORREO.length).split('&');
  expect(pares).toHaveLength(2);
  const [subject, body] = pares.map((p) => {
    const i = p.indexOf('=');
    return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))] as const;
  });
  expect(subject![0]).toBe('subject');
  expect(body![0]).toBe('body');
  return { asunto: subject![1], cuerpo: body![1] };
};

describe('enlaceCorreo (R4.1, R4.2)', () => {
  it('empieza por mailto:info@maysasp.com?', async () => {
    const t = await crearT('es');
    for (const tipo of TIPOS) {
      const enlace = enlaceCorreo(base({ tipo }), t);
      expect(enlace.startsWith('mailto:info@maysasp.com?'), tipo).toBe(true);
      expect(enlace.startsWith(`mailto:${CORREO_REPORTES}?`), tipo).toBe(true);
    }
  });

  it('asunto en es: "[Maysa Brain] <tipo>: <id> (es, versión <versión>)" para los cuatro tipos', async () => {
    const t = await crearT('es');
    const json = leerJson('es');
    const version = estructuras[ID]!.ficha!.version;
    expect(version).toBeTruthy();
    for (const tipo of TIPOS) {
      const { asunto } = partes(enlaceCorreo(base({ tipo }), t));
      expect(asunto, tipo).toBe(`[Maysa Brain] ${json.reporte.tipo[tipo]}: ${ID} (es, versión ${version})`);
    }
    expect(partes(enlaceCorreo(base(), t)).asunto).toBe(`[Maysa Brain] Contenido: ${ID} (es, versión ${version})`);
  });

  it('asunto en en: "[Maysa Brain] <tipo>: <id> (en, version <versión>)" para los cuatro tipos', async () => {
    const t = await crearT('en');
    const json = leerJson('en');
    const version = estructuras[ID]!.ficha!.version;
    for (const tipo of TIPOS) {
      const { asunto } = partes(enlaceCorreo(base({ tipo, idioma: 'en' }), t));
      expect(asunto, tipo).toBe(`[Maysa Brain] ${json.reporte.tipo[tipo]}: ${ID} (en, version ${version})`);
    }
    expect(partes(enlaceCorreo(base({ idioma: 'en' }), t)).asunto).toBe(
      `[Maysa Brain] Content: ${ID} (en, version ${version})`,
    );
  });

  it('el cuerpo es la plantilla del idioma con estructura, idioma, versión, parte y la descripción completa', async () => {
    const version = estructuras[ID]!.ficha!.version;
    for (const idioma of ['es', 'en'] as const) {
      const t = await crearT(idioma);
      const descripcion = 'Dice otra cosa en la segunda línea.';
      const { cuerpo } = partes(enlaceCorreo(base({ idioma, parte: 'relevancia.1', descripcion }), t));
      const valores: Record<string, string> = { estructura: ID, idioma, version, parte: 'relevancia.1', descripcion };
      const esperado = (leerJson(idioma).reporte.correo.cuerpo as string).replace(/\{\{(\w+)\}\}/g, (_, k) => valores[k]!);
      expect(cuerpo, idioma).toBe(esperado);
      expect(cuerpo, idioma).toContain(idioma === 'es' ? `Estructura: ${ID}` : `Structure: ${ID}`);
      expect(cuerpo, idioma).toContain(descripcion);
      expect(cuerpo, idioma).toContain('relevancia.1');
    }
  });

  it('los espacios van como %20 y nunca como +', async () => {
    const t = await crearT('es');
    const enlace = enlaceCorreo(base({ descripcion: 'a b + c' }), t);
    expect(enlace).toContain('%20');
    expect(enlace).not.toContain('+');
    expect(partes(enlace).cuerpo.endsWith('a b + c')).toBe(true);
  });

  it('un texto con #, &, +, %20, salto de línea, comillas, tildes y marcadores de i18next vuelve intacto (R4.2)', async () => {
    const t = await crearT('es');
    const texto = 'Dice "núcleo" #3 & más + 50%20\nñ á ü \'ok\' {{nombre}} $t(reporte.boton) $&';
    const enlace = enlaceCorreo(base({ descripcion: texto }), t);
    expect(partes(enlace).cuerpo.endsWith(`Descripción:\n${texto}`)).toBe(true);
    expect(enlace).not.toContain('#');
    expect(enlace.split('&')).toHaveLength(2);
  });

  it('un t que escapa HTML no cambia & ni " de la descripción (D2)', async () => {
    const t = await crearTEscapado('es');
    // Control: este t sí escapa lo que le llega sin la opción por llamada.
    expect(t('reporte.correo.cuerpo', { estructura: 'x', idioma: 'es', version: '1', parte: 'p', descripcion: 'a & "b"' })).toContain('&amp;');
    const descripcion = 'a & "b" <c>';
    const { cuerpo } = partes(enlaceCorreo(base({ descripcion }), t));
    expect(cuerpo.endsWith(`Descripción:\n${descripcion}`)).toBe(true);
    expect(cuerpo).not.toContain('&amp;');
    expect(cuerpo).not.toContain('&quot;');
    const { asunto } = partes(enlaceCorreo(base({ estructura: 'a&b' }), t));
    expect(asunto).toContain('a&b');
  });

  it('no lee la ubicación de la página: ?r= y #r= no salen en el enlace (R4.2)', async () => {
    const t = await crearT('es');
    const location = { search: '?r=PRUEBA01', hash: '#r=PRUEBA01', href: 'https://x.test/?r=PRUEBA01#r=PRUEBA01' };
    vi.stubGlobal('location', location);
    vi.stubGlobal('window', { location });
    try {
      const enlace = enlaceCorreo(base(), t);
      expect(enlace).not.toContain('PRUEBA01');
      expect(enlace).not.toContain('r=');
      expect(enlace.split('&')).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('no corta el cuerpo: 1500 caracteres con espacios y 750 emojis llegan completos', async () => {
    const t = await crearT('es');
    for (const descripcion of ['palabra '.repeat(188).slice(0, 1500), '😀'.repeat(750)]) {
      expect(descripcion).toHaveLength(1500);
      const { cuerpo } = partes(enlaceCorreo(base({ descripcion }), t));
      expect(cuerpo.endsWith(descripcion)).toBe(true);
      expect(cuerpo.length).toBeGreaterThan(descripcion.length);
    }
  });
});

describe('tipo fuera de TIPOS (D1)', () => {
  it("enlaceGithub, enlaceCorreo y cabeEnGithub lanzan con 'otro' y con 'constructor'", async () => {
    const t = await crearT('es');
    for (const tipo of ['otro', 'constructor', '__proto__', 'toString']) {
      const r = base({ tipo: tipo as TipoReporte });
      expect(() => enlaceGithub(r, t), tipo).toThrow();
      expect(() => enlaceCorreo(r, t), tipo).toThrow();
      expect(() => cabeEnGithub(r, t), tipo).toThrow();
    }
  });
});

describe('textos del reporte (D2)', () => {
  const CLAVES = [
    'boton', 'titulo', 'tipoLeyenda',
    'tipo.contenido', 'tipo.traduccion', 'tipo.enlace-roto', 'tipo.pieza',
    'tipoAyuda.contenido', 'tipoAyuda.traduccion', 'tipoAyuda.enlace-roto', 'tipoAyuda.pieza',
    'parte', 'parteGeneral', 'parteRecursos', 'parteNombre', 'parteSinonimos', 'partePieza', 'parteRelevancia', 'parteFuente',
    'descripcion', 'contador', 'aviso', 'abrirGithub', 'enviarCorreo', 'correoTexto',
    'falta.tipo', 'falta.descripcion', 'muyLargo', 'correo.asunto', 'correo.cuerpo', 'cerrar',
  ];
  const valor = (lng: 'es' | 'en', clave: string): unknown =>
    clave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], leerJson(lng).reporte);

  for (const lng of ['es', 'en'] as const) {
    it(`(${lng}) cada clave existe, no está vacía, sin guion largo${lng === 'es' ? ' ni voseo' : ''}`, () => {
      for (const clave of CLAVES) {
        const v = valor(lng, clave);
        expect(typeof v, `${lng} ${clave}`).toBe('string');
        expect((v as string).trim(), `${lng} ${clave}`).not.toBe('');
        expect(v as string, `${lng} ${clave}`).not.toContain('\u2014');
        if (lng === 'es') expect(v as string, clave).not.toMatch(/\bvos\b|podés|tenés|querés|escribís/i);
      }
    });

    it(`(${lng}) los marcadores están`, () => {
      const v = (clave: string) => valor(lng, clave) as string;
      expect(v('titulo')).toContain('{{nombre}}');
      expect(v('contador')).toContain('{{n}}');
      expect(v('contador')).toContain('{{max}}');
      expect(v('correoTexto')).toContain('{{correo}}');
      expect(v('parteRelevancia')).toContain('{{n}}');
      expect(v('parteFuente')).toContain('{{n}}');
      const asunto = v('correo.asunto');
      for (const m of ['[Maysa Brain]', '{{tipo}}', '{{id}}', '{{idioma}}', '{{version}}']) expect(asunto).toContain(m);
      expect(asunto).toContain(lng === 'es' ? 'versión' : 'version');
      for (const m of ['{{estructura}}', '{{idioma}}', '{{version}}', '{{parte}}', '{{descripcion}}']) {
        expect(v('correo.cuerpo')).toContain(m);
      }
    });

    it(`(${lng}) el bloque reporte no trae claves fuera de la lista`, () => {
      const hojas = (o: unknown, pre = ''): string[] =>
        Object.entries(o as Record<string, unknown>).flatMap(([k, x]) =>
          typeof x === 'object' && x !== null ? hojas(x, `${pre}${k}.`) : [`${pre}${k}`],
        );
      expect(hojas(leerJson(lng).reporte).sort()).toEqual([...CLAVES].sort());
    });
  }
});
