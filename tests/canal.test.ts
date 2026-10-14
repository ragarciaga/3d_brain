import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configRevision, VERSION_AUTORIZACION } from '../src/config/revision';
import { estructuras } from '../src/data/atlas';
import { autorizacionVigente, autorizar, canalConfigurado, ErrorCanal, guardar, leer, TIEMPO_CANAL_MS, type TipoErrorCanal } from '../src/lib/canal';
import { cargaRevisionV2, type Respuesta } from '../src/lib/revision';

const idOk = (id: unknown) => typeof id === 'string' && Object.hasOwn(estructuras, id);
const URL_PRUEBA = 'https://canal.prueba/exec';
const CODIGO = 'D03-ok_1';
const a: Respuesta = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-10T10:00:00.000Z' };
const b: Respuesta = { estructura: 'thalamus', campo: 'que_es', idioma: 'es', veredicto: 'corregir', propuesta: 'Texto', version: '0.1.0', fecha: '2026-10-10T11:00:00.000Z' };
const AUTORIZACION = { version: VERSION_AUTORIZACION, vago: true };

const json = (x: unknown, init?: ResponseInit) => new Response(JSON.stringify(x), init);
const simular = (impl: (url: URL, init: RequestInit | undefined) => Promise<Response>) => {
  const f = vi.fn(impl);
  vi.stubGlobal('fetch', f);
  return f;
};
const responder = (x: unknown) => simular(async () => json(x));
const llamada = (f: ReturnType<typeof simular>) => {
  const [url, init] = f.mock.calls[0]!;
  return { url: new URL(String(url)), init: init };
};
const cuerpo = (f: ReturnType<typeof simular>) => JSON.parse(String(llamada(f).init?.body)) as Record<string, unknown>;
/** Carga `{v:2, r, e}` con una respuesta válida (la de `a`) y los elementos extra dados. */
const cargaCon = (extra: unknown, id = 'thalamus') => ({
  v: 2,
  r: CODIGO,
  e: { hippocampus: [{ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0', f: a.fecha }], [id]: extra },
});
const buena = { c: 'que_es', i: 'es', d: 'corregir', p: 'Texto', s: '0.1.0', f: b.fecha };

let urlOriginal: string;
beforeEach(() => {
  urlOriginal = configRevision.urlCanal;
  configRevision.urlCanal = URL_PRUEBA;
});
afterEach(() => {
  configRevision.urlCanal = urlOriginal;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('guardar', () => {
  it('hace una sola llamada POST con text/plain y sin otras cabeceras', async () => {
    const f = responder({ ok: true, recibidas: [] });
    await guardar(CODIGO, [a, b]);
    expect(f).toHaveBeenCalledTimes(1);
    const { url, init } = llamada(f);
    expect(url.origin + url.pathname).toBe(URL_PRUEBA);
    expect(init?.method).toBe('POST');
    const cabeceras = new Headers(init?.headers);
    expect([...cabeceras.keys()]).toEqual(['content-type']);
    expect(cabeceras.get('content-type')).toMatch(/^text\/plain(;|$)/);
  });

  it('manda accion guardar con la carga v:2 como texto, con la fecha', async () => {
    const f = responder({ ok: true, recibidas: [] });
    await guardar(CODIGO, [a, b]);
    const c = cuerpo(f);
    expect(c['accion']).toBe('guardar');
    expect(typeof c['carga']).toBe('string');
    expect(JSON.parse(c['carga'] as string)).toEqual(JSON.parse(cargaRevisionV2(CODIGO, [a, b])));
    expect(JSON.parse(c['carga'] as string).e.hippocampus[0].f).toBe(a.fecha);
  });

  it('devuelve el Set de recibidas e ignora lo que no es texto', async () => {
    responder({ ok: true, recibidas: ['x|y||f', 7, null, { z: 1 }, 'otra'] });
    expect(await guardar(CODIGO, [a])).toEqual(new Set(['x|y||f', 'otra']));
  });

  it.each([[{ ok: true }], [{ ok: true, recibidas: 'abc' }], [{ ok: true, recibidas: { 0: 'x' } }]])('da un Set vacío si recibidas no es un array (%j)', async (res) => {
    responder(res);
    expect(await guardar(CODIGO, [a])).toEqual(new Set());
  });
});

describe('leer', () => {
  it('usa GET sin cuerpo, con accion=leer y r=<código>', async () => {
    const f = responder({ ok: true, respuestas: null, autorizacion: null });
    await leer(CODIGO, idOk);
    const { url, init } = llamada(f);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
    expect(url.searchParams.get('accion')).toBe('leer');
    expect(url.searchParams.get('r')).toBe(CODIGO);
    expect(url.origin + url.pathname).toBe(URL_PRUEBA);
  });
});

describe('autorizar', () => {
  it.each([true, false])('manda accion autorizar con la versión vigente y vago=%s, y resuelve undefined', async (vago) => {
    const f = responder({ ok: true });
    await expect(autorizar(CODIGO, { version: VERSION_AUTORIZACION, vago })).resolves.toBeUndefined();
    expect(cuerpo(f)).toEqual({ accion: 'autorizar', r: CODIGO, version: VERSION_AUTORIZACION, vago });
    const { init } = llamada(f);
    expect(init?.method).toBe('POST');
    const cabeceras = new Headers(init?.headers);
    expect([...cabeceras.keys()]).toEqual(['content-type']);
    expect(cabeceras.get('content-type')).toMatch(/^text\/plain(;|$)/);
  });
});

const ACCIONES: [string, () => Promise<unknown>][] = [
  ['guardar', () => guardar(CODIGO, [a])],
  ['autorizar', () => autorizar(CODIGO, AUTORIZACION)],
  ['leer', () => leer(CODIGO, idOk)],
];

describe('errores del contrato', () => {
  const codigos: TipoErrorCanal[] = ['codigo_no_activo', 'demasiado_grande', 'formato', 'demasiadas_peticiones', 'interno'];
  const casos = ACCIONES.flatMap(([n, f]) => codigos.map((c) => [n, f, c] as const));
  it.each(casos)('%s: {ok:false, error:%s} lanza ErrorCanal con ese tipo', async (_n, hacer, codigo) => {
    responder({ ok: false, error: codigo });
    const e = await hacer().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorCanal);
    expect((e as ErrorCanal).tipo).toBe(codigo);
  });

  it.each(ACCIONES)('%s: un error desconocido o ausente da interno', async (_n, hacer) => {
    responder({ ok: false, error: 'otro' });
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('interno');
    responder({ ok: false });
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('interno');
    responder({ ok: false, error: { tipo: 'formato' } });
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('interno');
  });
});

describe('red', () => {
  it.each(ACCIONES)('%s: fetch que rechaza con TypeError da red', async (_n, hacer) => {
    simular(async () => {
      throw new TypeError('Failed to fetch');
    });
    const e = await hacer().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorCanal);
    expect((e as ErrorCanal).tipo).toBe('red');
  });

  it.each(ACCIONES)('%s: HTTP 500 da red', async (_n, hacer) => {
    simular(async () => json({ ok: true }, { status: 500 }));
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('red');
  });

  it.each(ACCIONES)('%s: un cuerpo <html> da red', async (_n, hacer) => {
    simular(async () => new Response('<html>Error</html>'));
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('red');
  });

  it.each([[{}], [[]], [null], ['ok'], [{ ok: 'si' }], [{ ok: 1 }]])('%j sin ok booleano da red', async (res) => {
    responder(res);
    for (const [, hacer] of ACCIONES) expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('red');
  });

  it.each(ACCIONES)('%s: con urlCanal vacía da red y no llama a fetch', async (_n, hacer) => {
    configRevision.urlCanal = '';
    const f = responder({ ok: true });
    expect(((await hacer().catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('red');
    expect(f).not.toHaveBeenCalled();
  });

  it('una URL que no es válida da red', async () => {
    configRevision.urlCanal = 'no es una url';
    const f = responder({ ok: true });
    expect(((await guardar(CODIGO, [a]).catch((x: unknown) => x)) as ErrorCanal).tipo).toBe('red');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('tiempo agotado', () => {
  it.each(ACCIONES)('%s: a los 10 s sin respuesta da red y aborta la señal', async (_n, hacer) => {
    vi.useFakeTimers();
    let senal: AbortSignal | undefined;
    simular(
      (_u, init) =>
        new Promise<Response>((_ok, no) => {
          senal = init?.signal ?? undefined;
          senal?.addEventListener('abort', () => no(new DOMException('abortado', 'AbortError')));
        }),
    );
    let resultado: unknown = 'pendiente';
    const p = hacer().catch((x: unknown) => {
      resultado = x;
    });
    await vi.advanceTimersByTimeAsync(TIEMPO_CANAL_MS - 1);
    expect(resultado).toBe('pendiente');
    expect(senal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(TIEMPO_CANAL_MS).toBe(10_000);
    expect(resultado).toBeInstanceOf(ErrorCanal);
    expect((resultado as ErrorCanal).tipo).toBe('red');
    expect(senal?.aborted).toBe(true);
  });

  it('una respuesta a tiempo no deja el temporizador pendiente', async () => {
    vi.useFakeTimers();
    responder({ ok: true, recibidas: [] });
    await guardar(CODIGO, [a]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('leer valida lo que vuelve (R6.6)', () => {
  const casos: [string, unknown, string?][] = [
    ['id desconocido', [buena], 'no-existe'],
    ['veredicto fuera del conjunto', [{ ...buena, d: 'quizas' }]],
    ['idioma fr', [{ ...buena, i: 'fr' }]],
    ['campo con barra vertical', [{ ...buena, c: 'que|es' }]],
    ['versión v1', [{ ...buena, s: 'v1' }]],
    ['propuesta de 4001 caracteres', [{ ...buena, p: 'x'.repeat(4001) }]],
    ['malla de 201 caracteres', [{ ...buena, m: 'x'.repeat(201) }]],
    ['posición de 2 números', [{ ...buena, x: [1, 2] }]],
    ['sin f', [{ c: 'que_es', i: 'es', d: 'corregir', p: 'Texto', s: '0.1.0' }]],
    ['f ilegible', [{ ...buena, f: 'ayer' }]],
    ['f de 41 caracteres', [{ ...buena, f: `2026-10-10T10:00:00.${'0'.repeat(20)}Z` }]],
    ['f que no es texto', [{ ...buena, f: 7 }]],
    ['clave extra z', [{ ...buena, z: 1 }]],
    ['elemento que no es objeto', ['texto']],
    ['elemento null', [null]],
    ['lista que no es array', { 0: buena }],
  ];

  it.each(casos)('descarta y conserva la válida: %s', async (_n, mala, id) => {
    responder({ ok: true, respuestas: cargaCon(mala, id), autorizacion: null });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await leer(CODIGO, idOk);
    expect(r.respuestas).toEqual([a]);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String(aviso.mock.calls[0]?.[0])).not.toContain(CODIGO);
    expect(String(aviso.mock.calls[0]?.[0])).toMatch(/\d/);
  });

  it('"__proto__" en el texto JSON descarta la respuesta y no contamina nada', async () => {
    const texto = `{"ok":true,"respuestas":{"v":2,"r":"${CODIGO}","e":{"hippocampus":[{"c":"ubicacion","i":"es","d":"correcto","s":"0.1.0","f":"${a.fecha}"}],"thalamus":[{"c":"que_es","d":"correcto","s":"0.1.0","f":"${b.fecha}","__proto__":{"veredicto":"corregir","estructura":"otra"}}]}},"autorizacion":null}`;
    simular(async () => new Response(texto));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await leer(CODIGO, idOk);
    expect(r.respuestas).toEqual([a]);
    expect(({} as Record<string, unknown>)['veredicto']).toBeUndefined();
  });

  it('"__proto__" como id de estructura se descarta', async () => {
    const texto = `{"ok":true,"respuestas":{"v":2,"r":"${CODIGO}","e":{"__proto__":[{"c":"que_es","d":"correcto","s":"0.1.0","f":"${b.fecha}"}]}},"autorizacion":null}`;
    simular(async () => new Response(texto));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await leer(CODIGO, idOk)).respuestas).toEqual([]);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['de otro código', { ...cargaCon([]), r: 'OTRO-01' }],
    ['v:1', { ...cargaCon([]), v: 1 }],
    ['e que es un array', { ...cargaCon([]), e: [] }],
    ['e que es null', { ...cargaCon([]), e: null }],
    ['un texto', 'hola'],
    ['un array', []],
  ])('una carga %s da cero respuestas', async (_n, carga) => {
    responder({ ok: true, respuestas: carga, autorizacion: null });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await leer(CODIGO, idOk)).respuestas).toEqual([]);
  });

  it('sin respuestas da [] y no avisa', async () => {
    responder({ ok: true, autorizacion: null });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await leer(CODIGO, idOk)).respuestas).toEqual([]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('ida y vuelta: lo que produce cargaRevisionV2 vuelve igual, con la fecha original y sin avisos', async () => {
    responder({ ok: true, respuestas: JSON.parse(cargaRevisionV2(CODIGO, [a, b])), autorizacion: null });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await leer(CODIGO, idOk);
    expect(r.respuestas).toEqual([a, b]);
    expect(r.respuestas.map((x) => x.fecha)).toEqual([a.fecha, b.fecha]);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('el objeto que devuelve es nuevo: no comparte referencias con la carga recibida', async () => {
    const carga = JSON.parse(cargaRevisionV2(CODIGO, [{ ...b, posicion: [1, 2, 3] }]));
    responder({ ok: true, respuestas: carga, autorizacion: null });
    const r = await leer(CODIGO, idOk);
    expect(r.respuestas[0]?.posicion).toEqual([1, 2, 3]);
  });
});

describe('autorización vigente (R2.5)', () => {
  it('la versión vigente da {version, vago} sin copiar claves extra', () => {
    expect(autorizacionVigente({ version: VERSION_AUTORIZACION, vago: false, extra: 1, nombre: 'X' })).toEqual({ version: VERSION_AUTORIZACION, vago: false });
    expect(Object.keys(autorizacionVigente({ version: VERSION_AUTORIZACION, vago: true, extra: 1 })!).sort()).toEqual(['vago', 'version']);
  });

  it.each([
    ['otra versión', { version: `${VERSION_AUTORIZACION}0`, vago: true }],
    ['sin versión', { vago: true }],
    ['versión que no es texto', { version: 1, vago: true }],
    ['vago texto', { version: VERSION_AUTORIZACION, vago: 'sí' }],
    ['sin vago', { version: VERSION_AUTORIZACION }],
    ['ausente', undefined],
    ['null', null],
    ['un array', []],
    ['un texto', VERSION_AUTORIZACION],
  ])('%s da null', (_n, a) => {
    expect(autorizacionVigente(a)).toBeNull();
  });

  it('leer devuelve la autorización vigente', async () => {
    responder({ ok: true, respuestas: null, autorizacion: { ...AUTORIZACION, extra: 1 } });
    expect((await leer(CODIGO, idOk)).autorizacion).toEqual(AUTORIZACION);
  });

  it.each([
    ['otra versión', { version: 'vieja', vago: true }],
    ['ausente', undefined],
    ['null', null],
    ['mal formada', { version: VERSION_AUTORIZACION, vago: 'sí' }],
  ])('leer da autorizacion null con %s', async (_n, aut) => {
    responder({ ok: true, respuestas: null, autorizacion: aut });
    expect((await leer(CODIGO, idOk)).autorizacion).toBeNull();
  });
});

describe('canalConfigurado', () => {
  it('es falso con urlCanal vacía y verdadero con una URL', () => {
    configRevision.urlCanal = '';
    expect(canalConfigurado()).toBe(false);
    configRevision.urlCanal = URL_PRUEBA;
    expect(canalConfigurado()).toBe(true);
  });
});
