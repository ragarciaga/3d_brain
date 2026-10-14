// Prueba del canal de retorno (T1, #87): el script mínimo de Apps Script y la página del editor se
// cargan en Node con `node:vm` y dobles. Los dobles siguen la documentación de Google; el oráculo
// real es la prueba manual del editor (docs/revision-docente.md).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const RUTA_SCRIPT = 'apps-script/prueba-canal.js';
const RUTA_PAGINA = 'public/probar-canal.html';
const MIME_JSON = 'application/json-doble';

type Fila = unknown[];
type Evento = Record<string, unknown>;
interface Salida {
  getContent(): string;
  getMimeType(): string;
}
interface Contexto {
  doGet(e: Evento): Salida;
  doPost(e: Evento): Salida;
}

function cargarScript(filasIniciales?: Fila[]) {
  const hojas = new Map<string, Fila[]>();
  if (filasIniciales) hojas.set('Prueba', filasIniciales);
  const insertadas: string[] = [];
  const ContentService = {
    MimeType: { JSON: MIME_JSON },
    createTextOutput(texto: string) {
      let mime = '';
      const salida = {
        setMimeType(m: string) {
          mime = m;
          return salida;
        },
        getContent: () => texto,
        getMimeType: () => mime,
      };
      return salida;
    },
  };
  const hojaDoble = (filas: Fila[]) => ({
    appendRow(fila: Fila) {
      filas.push(fila);
    },
    // Como Sheets: una hoja vacía devuelve una sola celda vacía.
    getDataRange: () => ({ getValues: () => (filas.length ? filas.map((f) => [...f]) : [['']]) }),
  });
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (n: string) => (hojas.has(n) ? hojaDoble(hojas.get(n)!) : null),
      insertSheet(n: string) {
        insertadas.push(n);
        const filas: Fila[] = [];
        hojas.set(n, filas);
        return hojaDoble(filas);
      },
    }),
  };
  const contexto = vm.createContext({ ContentService, SpreadsheetApp });
  vm.runInContext(readFileSync(RUTA_SCRIPT, 'utf8'), contexto, { filename: RUTA_SCRIPT });
  return { contexto: contexto as unknown as Contexto, hojas, insertadas };
}

const contenido = (s: Salida) => JSON.parse(s.getContent()) as Record<string, unknown>;
const postCon = (cuerpo: unknown): Evento => ({
  postData: { type: 'text/plain', contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) },
});
const filasPrueba = (hojas: Map<string, Fila[]>) => hojas.get('Prueba') ?? [];

describe('apps-script/prueba-canal.js', () => {
  it('doPost válido agrega una fila [fecha, marca] y responde ok en JSON', () => {
    const { contexto, hojas, insertadas } = cargarScript();
    const salida = contexto.doPost(postCon({ accion: 'probar', marca: 'prueba-abc123' }));
    expect(contenido(salida)).toEqual({ ok: true, marca: 'prueba-abc123' });
    expect(salida.getMimeType()).toBe(MIME_JSON);
    expect(insertadas).toEqual(['Prueba']);
    const filas = filasPrueba(hojas);
    expect(filas).toHaveLength(1);
    // La fecha viene de otro realm: toBeInstanceOf(Date) no sirve.
    expect(Object.prototype.toString.call(filas[0]![0])).toBe('[object Date]');
    expect(filas[0]![1]).toBe('prueba-abc123');
    expect(filas[0]).toHaveLength(2);
  });

  it('dos doPost válidos crean la pestaña una sola vez y dejan dos filas', () => {
    const { contexto, hojas, insertadas } = cargarScript();
    contexto.doPost(postCon({ accion: 'probar', marca: 'prueba-uno1' }));
    contexto.doPost(postCon({ accion: 'probar', marca: 'prueba-dos2' }));
    expect(insertadas).toEqual(['Prueba']);
    expect(filasPrueba(hojas)).toHaveLength(2);
  });

  it('doPost reutiliza la pestaña Prueba si ya existe', () => {
    const { contexto, hojas, insertadas } = cargarScript([]);
    contexto.doPost(postCon({ accion: 'probar', marca: 'prueba-abc123' }));
    expect(insertadas).toEqual([]);
    expect(filasPrueba(hojas)).toHaveLength(1);
  });

  const invalidos: [string, Evento][] = [
    ['cuerpo que no es JSON', postCon('hola')],
    ['evento sin postData', {}],
    ['acción distinta de probar', postCon({ accion: 'guardar', marca: 'prueba-abc123' })],
    ['marca que parece fórmula', postCon({ accion: 'probar', marca: '=1+1' })],
    ['marca demasiado larga', postCon({ accion: 'probar', marca: 'prueba-' + 'a'.repeat(33) })],
    ['marca demasiado corta', postCon({ accion: 'probar', marca: 'prueba-abc' })],
    ['marca no textual', postCon({ accion: 'probar', marca: 123 })],
    ['cuerpo null', postCon('null')],
  ];
  for (const [nombre, evento] of invalidos) {
    it(`doPost con ${nombre} responde formato, sin filas ni pestaña`, () => {
      const { contexto, hojas, insertadas } = cargarScript();
      const salida = contexto.doPost(evento);
      expect(contenido(salida)).toEqual({ ok: false, error: 'formato' });
      expect(salida.getMimeType()).toBe(MIME_JSON);
      expect(filasPrueba(hojas)).toHaveLength(0);
      expect(insertadas).toEqual([]);
    });
  }

  it('doGet sin parámetros responde formato en JSON', () => {
    const { contexto } = cargarScript();
    const salida = contexto.doGet({ parameter: {} });
    expect(contenido(salida)).toEqual({ ok: false, error: 'formato' });
    expect(salida.getMimeType()).toBe(MIME_JSON);
  });

  it('doGet sin evento responde formato', () => {
    const { contexto } = cargarScript();
    expect(contenido(contexto.doGet({}))).toEqual({ ok: false, error: 'formato' });
  });

  it('doGet leer con marca inválida responde formato aunque la fila exista', () => {
    const { contexto } = cargarScript([[new Date(), '=1+1']]);
    const salida = contexto.doGet({ parameter: { accion: 'leer', marca: '=1+1' } });
    expect(contenido(salida)).toEqual({ ok: false, error: 'formato' });
  });

  it('doGet con otra acción responde formato', () => {
    const { contexto } = cargarScript([[new Date(), 'prueba-abc123']]);
    const salida = contexto.doGet({ parameter: { accion: 'borrar', marca: 'prueba-abc123' } });
    expect(contenido(salida)).toEqual({ ok: false, error: 'formato' });
  });

  const leer = (marca: string) => ({ parameter: { accion: 'leer', marca } });

  it('doGet sin pestaña Prueba responde encontrada false y no la crea', () => {
    const { contexto, hojas, insertadas } = cargarScript();
    const salida = contexto.doGet(leer('prueba-abc123'));
    expect(contenido(salida)).toEqual({ ok: true, encontrada: false });
    expect(salida.getMimeType()).toBe(MIME_JSON);
    expect(insertadas).toEqual([]);
    expect(hojas.has('Prueba')).toBe(false);
  });

  it('doGet con la pestaña vacía responde encontrada false', () => {
    const { contexto } = cargarScript([]);
    expect(contenido(contexto.doGet(leer('prueba-abc123')))).toEqual({ ok: true, encontrada: false });
  });

  it('doGet con una fila igual a la marca responde encontrada true', () => {
    const { contexto } = cargarScript([[new Date(), 'prueba-abc123']]);
    expect(contenido(contexto.doGet(leer('prueba-abc123')))).toEqual({ ok: true, encontrada: true });
  });

  it('doGet con varias filas y la marca en la última responde true', () => {
    const { contexto } = cargarScript([
      [new Date(), 'prueba-uno1'],
      [new Date(), 'prueba-dos2'],
      [new Date(), 'prueba-abc123'],
    ]);
    expect(contenido(contexto.doGet(leer('prueba-abc123')))).toEqual({ ok: true, encontrada: true });
  });

  it('doGet con varias filas sin la marca responde false', () => {
    const { contexto } = cargarScript([
      [new Date(), 'prueba-uno1'],
      [new Date(), 'prueba-dos2'],
    ]);
    expect(contenido(contexto.doGet(leer('prueba-abc123')))).toEqual({ ok: true, encontrada: false });
  });

  it('doGet solo compara la columna B', () => {
    const { contexto } = cargarScript([['prueba-abc123', 'otra']]);
    expect(contenido(contexto.doGet(leer('prueba-abc123')))).toEqual({ ok: true, encontrada: false });
  });

  it('el archivo no trae identificadores, correos ni sintaxis de módulo', () => {
    const texto = readFileSync(RUTA_SCRIPT, 'utf8');
    expect(texto).not.toContain('openById');
    expect(texto).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(texto).not.toMatch(/^import /m);
    expect(texto).not.toMatch(/^export /m);
  });
});

interface Resultado {
  escritura: string;
  lectura: string;
  detalle: string;
}
type Pedir = (url: string, opciones?: Record<string, unknown>) => Promise<unknown>;
interface Pagina {
  urlValida(t: string): boolean;
  nuevaMarca(): string;
  probarCanal(url: string, marca: string, pedir: Pedir): Promise<Resultado>;
}

const html = () => readFileSync(RUTA_PAGINA, 'utf8');

function cargarPagina(): Pagina {
  const scripts = [...html().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  const contexto = vm.createContext({
    document: { addEventListener() {} },
    AbortSignal,
    URLSearchParams,
    encodeURIComponent,
  });
  vm.runInContext(scripts[0]![1]!, contexto, { filename: RUTA_PAGINA });
  return contexto as unknown as Pagina;
}

/** Imita `fetch`: resuelve con ok, status y json() (que rechaza con SyntaxError si no es JSON). */
function respuesta(status: number, texto: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(texto) as unknown,
  };
}
const caida = () => Promise.reject(new TypeError('Failed to fetch'));

const URL_OK = 'https://script.google.com/macros/s/AKfy_x-1/exec';
const MARCA = 'prueba-abc123';

/** Corre probarCanal con un doble de fetch que registra el orden de las llamadas. */
async function correr(post: () => Promise<unknown>, get: () => Promise<unknown>) {
  const pagina = cargarPagina();
  const registro: string[] = [];
  const llamadas: { url: string; opciones?: Record<string, unknown> }[] = [];
  const pedir: Pedir = async (url, opciones) => {
    llamadas.push({ url, opciones });
    const esPost = opciones?.method === 'POST';
    registro.push(esPost ? 'POST inicio' : 'GET inicio');
    try {
      return await (esPost ? post() : get());
    } finally {
      registro.push(esPost ? 'POST fin' : 'GET fin');
    }
  };
  const bruto = await pagina.probarCanal(URL_OK, MARCA, pedir);
  const resultado = JSON.parse(JSON.stringify(bruto)) as Resultado;
  return { resultado, registro, llamadas };
}

const postOk = () => Promise.resolve(respuesta(200, JSON.stringify({ ok: true, marca: MARCA })));
const getOk = () => Promise.resolve(respuesta(200, JSON.stringify({ ok: true, encontrada: true })));

describe('public/probar-canal.html', () => {
  it('tiene un solo script en línea clásico, sin recursos externos y con los cuatro textos', () => {
    const texto = html();
    const etiquetas = [...texto.matchAll(/<script\b([^>]*)>/g)];
    expect(etiquetas).toHaveLength(1);
    expect(etiquetas[0]![1]).not.toMatch(/\bsrc\s*=/);
    expect(etiquetas[0]![1]).not.toMatch(/type\s*=\s*["']?module/);
    expect(texto).not.toMatch(/\b(?:src|href)\s*=\s*["']?\s*https?:\/\//i);
    expect(texto).not.toMatch(/@import|url\(\s*["']?https?:/i);
    for (const t of ['Escritura: ok', 'Escritura: falla', 'Lectura: ok', 'Lectura: falla']) {
      expect(texto).toContain(t);
    }
  });

  it('no usa innerHTML', () => {
    expect(html()).not.toContain('innerHTML');
  });

  it('nuevaMarca cumple el formato que acepta el script', () => {
    const { nuevaMarca } = cargarPagina();
    for (let i = 0; i < 50; i++) {
      expect(nuevaMarca()).toMatch(/^prueba-[a-z0-9]{4,32}$/);
    }
  });

  it('urlValida acepta solo URLs /exec de script.google.com', () => {
    const { urlValida } = cargarPagina();
    expect(urlValida(URL_OK)).toBe(true);
    expect(urlValida('https://script.google.com/a/macros/maysadigital.co/s/AKfy/exec')).toBe(true);
    for (const mala of [
      'http://script.google.com/macros/s/x/exec',
      'https://script.google.com.evil.com/macros/s/x/exec',
      'https://evil.com/macros/s/x/exec',
      'https://script.google.com/macros/s/x/dev',
      'https://script.google.com/macros/s/x/exec?y=1',
      'https://script.google.com/macros/s/x/exec ',
      '',
    ]) {
      expect(urlValida(mala), mala).toBe(false);
    }
  });

  it('con una URL inválida no hace ninguna petición y marca las dos líneas como falla', async () => {
    const pagina = cargarPagina();
    let llamadas = 0;
    const r = JSON.parse(
      JSON.stringify(
        await pagina.probarCanal('https://evil.com/macros/s/x/exec', MARCA, () => {
          llamadas++;
          return postOk();
        }),
      ),
    ) as Resultado;
    expect(llamadas).toBe(0);
    expect(r.escritura).toBe('Escritura: falla');
    expect(r.lectura).toBe('Lectura: falla');
  });

  it('POST ok y GET ok: las dos líneas en ok, con la forma de la petición del diseño', async () => {
    const { resultado, registro, llamadas } = await correr(postOk, getOk);
    expect(resultado.escritura).toBe('Escritura: ok');
    expect(resultado.lectura).toBe('Lectura: ok');
    expect(resultado.detalle).toContain(MARCA);
    expect(llamadas).toHaveLength(2);
    const [primera, segunda] = llamadas;
    expect(primera!.url).toBe(URL_OK);
    expect(primera!.opciones!.method).toBe('POST');
    const cabeceras = primera!.opciones!.headers as Record<string, string>;
    expect(cabeceras['Content-Type']).toMatch(/^text\/plain/);
    expect(primera!.opciones!.body).toBe(JSON.stringify({ accion: 'probar', marca: MARCA }));
    expect(primera!.opciones!.signal).toBeDefined();
    expect(segunda!.url).toBe(`${URL_OK}?accion=leer&marca=${MARCA}`);
    expect(segunda!.opciones!.signal).toBeDefined();
    expect(registro).toEqual(['POST inicio', 'POST fin', 'GET inicio', 'GET fin']);
  });

  it('escritura bloqueada (TypeError) y lectura ok: es el plan B y el GET se hace igual', async () => {
    const { resultado, registro } = await correr(caida, getOk);
    expect(resultado.escritura).toBe('Escritura: falla');
    expect(resultado.lectura).toBe('Lectura: ok');
    expect(resultado.detalle).toContain('Failed to fetch');
    expect(registro).toEqual(['POST inicio', 'POST fin', 'GET inicio', 'GET fin']);
  });

  it('escritura ok y lectura que rechaza: Escritura ok y Lectura falla', async () => {
    const { resultado } = await correr(postOk, caida);
    expect(resultado.escritura).toBe('Escritura: ok');
    expect(resultado.lectura).toBe('Lectura: falla');
  });

  it('las dos rechazan: las dos fallas y el detalle trae la marca', async () => {
    const { resultado } = await correr(caida, caida);
    expect(resultado.escritura).toBe('Escritura: falla');
    expect(resultado.lectura).toBe('Lectura: falla');
    expect(resultado.detalle).toContain(MARCA);
    expect(resultado.detalle).toContain('Escritura: ');
    expect(resultado.detalle).toContain('Lectura: ');
  });

  it('un json() del POST que lanza SyntaxError da Escritura falla', async () => {
    const { resultado } = await correr(() => Promise.resolve(respuesta(200, '<html>no es json')), getOk);
    expect(resultado.escritura).toBe('Escritura: falla');
    expect(resultado.lectura).toBe('Lectura: ok');
    expect(resultado.detalle).toContain('SyntaxError');
  });

  it('POST con ok false del script da Escritura falla', async () => {
    const { resultado } = await correr(
      () => Promise.resolve(respuesta(200, JSON.stringify({ ok: false, marca: MARCA }))),
      getOk,
    );
    expect(resultado.escritura).toBe('Escritura: falla');
  });

  it('GET con ok false del script da Lectura falla aunque diga encontrada', async () => {
    const { resultado } = await correr(
      postOk,
      () => Promise.resolve(respuesta(200, JSON.stringify({ ok: false, encontrada: true }))),
    );
    expect(resultado.escritura).toBe('Escritura: ok');
    expect(resultado.lectura).toBe('Lectura: falla');
  });

  it('POST que confirma otra marca da Escritura falla', async () => {
    const { resultado } = await correr(
      () => Promise.resolve(respuesta(200, JSON.stringify({ ok: true, marca: 'otra' }))),
      getOk,
    );
    expect(resultado.escritura).toBe('Escritura: falla');
  });

  it('POST con estado 500 da Escritura falla aunque el JSON diga ok', async () => {
    const { resultado } = await correr(
      () => Promise.resolve(respuesta(500, JSON.stringify({ ok: true, marca: MARCA }))),
      getOk,
    );
    expect(resultado.escritura).toBe('Escritura: falla');
  });

  it('GET con encontrada false da Lectura falla y lo dice en el detalle', async () => {
    const { resultado } = await correr(
      postOk,
      () => Promise.resolve(respuesta(200, JSON.stringify({ ok: true, encontrada: false }))),
    );
    expect(resultado.escritura).toBe('Escritura: ok');
    expect(resultado.lectura).toBe('Lectura: falla');
    expect(resultado.detalle).toContain('no encontró la fila de esta prueba');
  });

  it('GET con estado 500 da Lectura falla aunque el JSON diga encontrada', async () => {
    const { resultado } = await correr(
      postOk,
      () => Promise.resolve(respuesta(500, JSON.stringify({ ok: true, encontrada: true }))),
    );
    expect(resultado.lectura).toBe('Lectura: falla');
  });
});
