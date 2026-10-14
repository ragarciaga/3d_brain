// Prueba del canal de retorno (spec 03, T2): apps-script/Codigo.js se carga en Node con `node:vm` y
// dobles de Google (tests/fixtures/apps-script/dobles.ts). Los dobles siguen la documentación; el
// oráculo real es la prueba manual del editor (docs/revision-docente.md). Lo que Sheets hace con el
// formato `@` no se puede comprobar aquí.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importar, leerEnvios, parsearCsv } from '../scripts/lib/revisiones.ts';
import { cargaRevisionV2, fechaValida, REVISOR_VALIDO, respuestaValida, type Respuesta } from '../src/lib/revision';
import {
  CABECERAS,
  casosCarga,
  casosFecha,
  casosRespuesta,
  CODIGO_ACTIVO,
  CODIGO_AUSENTE,
  CODIGO_GUION,
  CODIGO_INACTIVO,
  conteoFilas,
  crearEntorno,
  MIME_JSON,
  OTRO_ACTIVO,
  PADRON_PRUEBA,
  RUTA_SCRIPT,
  type Celda,
  type Entorno,
} from './fixtures/apps-script/dobles';

const base = { idioma: 'es' as const, version: '0.1.0', fecha: '2026-10-14T09:59:00.000Z' };
const resp = (extra: Partial<Respuesta> = {}): Respuesta => ({ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto', ...extra });
const guardarCuerpo = (codigo: string, respuestas: Respuesta[]) => JSON.stringify({ accion: 'guardar', carga: cargaRevisionV2(codigo, respuestas) });
const autorizarCuerpo = (codigo: string, extra: Record<string, unknown> = {}) => JSON.stringify({ accion: 'autorizar', r: codigo, version: '1', vago: true, ...extra });
const idForma = (id: unknown) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id);
const isoDe = (env: Entorno) => new Date(env.reloj.ahora).toISOString();

type Accion = 'guardar' | 'autorizar' | 'leer';
/** Una petición de cada acción con un código dado. */
function pedir(env: Entorno, accion: Accion, codigo: string) {
  if (accion === 'guardar') return env.post(guardarCuerpo(codigo, [resp()]));
  if (accion === 'autorizar') return env.post(autorizarCuerpo(codigo));
  return env.get({ accion: 'leer', r: codigo });
}
const ACCIONES: Accion[] = ['guardar', 'autorizar', 'leer'];

describe('(a) código fuera del padrón, inactivo o inválido (R6.1)', () => {
  const codigos = [
    ['fuera del padrón', CODIGO_AUSENTE],
    ['con no en Activo', CODIGO_INACTIVO],
    ['que no cumple REVISOR_VALIDO', 'ANA.PEREZ'],
  ] as const;

  it.each(ACCIONES.flatMap((a) => codigos.map(([n, c]) => [a, n, c] as const)))('%s con un código %s da codigo_no_activo y no escribe', (accion, _n, codigo) => {
    const env = crearEntorno();
    const antes = conteoFilas(env);
    const res = pedir(env, accion, codigo);
    expect(res).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues).toBe(0);
  });

  it('un código inactivo con carga válida y en el cuerpo de guardar no escribe nada', () => {
    const env = crearEntorno();
    expect(env.post(guardarCuerpo(CODIGO_INACTIVO, [resp()]))).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(env.escritas('Respuestas')).toEqual([]);
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('el código %s no se toma por una propiedad del padrón', (codigo) => {
    const env = crearEntorno();
    for (const a of ACCIONES) expect(pedir(env, a, codigo)).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(conteoFilas(env)).toEqual({ Respuestas: 1, Autorizaciones: 1, Padrón: 1 + PADRON_PRUEBA.length });
  });

  it.each(['Sí', 'si', 'SÍ', 'sí '])('Activo con %j: solo cuenta sí exacto sin espacios sobrantes', (activo) => {
    const env = crearEntorno({ padron: [[CODIGO_ACTIVO, 'D01', activo]] });
    const res = env.get({ accion: 'leer', r: CODIGO_ACTIVO });
    // `sí ` con espacio final cuenta (se recortan los espacios); las demás formas no.
    expect(res['ok']).toBe(activo === 'sí ');
  });

  it('la fila 1 del padrón es la cabecera y no activa a nadie', () => {
    const env = crearEntorno({ padron: [] });
    env.hojas.Padrón.filas[0] = [CODIGO_ACTIVO, 'D01', 'sí'];
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: false, error: 'codigo_no_activo' });
    env.hojas.Padrón.filas.push([CODIGO_ACTIVO, 'D01', 'sí']);
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })['ok']).toBe(true);
  });

  it('un código que no cumple REVISOR_VALIDO se rechaza aunque alguien lo haya puesto como activo en el padrón', () => {
    const env = crearEntorno({ padron: [['ANA.PEREZ', 'D05', 'sí'], ['ñandú', 'D06', 'sí']] });
    for (const c of ['ANA.PEREZ', 'ñandú']) for (const a of ACCIONES) expect(pedir(env, a, c)).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(env.escritas('Respuestas')).toEqual([]);
    expect(env.escritas('Autorizaciones')).toEqual([]);
  });

  it('un código sin texto (r ausente o no texto) da codigo_no_activo', () => {
    const env = crearEntorno();
    expect(env.post(JSON.stringify({ accion: 'autorizar', version: '1', vago: true }))).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(env.post(JSON.stringify({ accion: 'autorizar', r: 7, version: '1', vago: true }))).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(env.get({ accion: 'leer' })).toEqual({ ok: false, error: 'codigo_no_activo' });
  });
});

describe('(b) tamaño y formato (R6.2)', () => {
  const rellenar = (cuerpo: string, bytes: number) => cuerpo + ' '.repeat(bytes - Buffer.byteLength(cuerpo, 'utf8'));

  it('un cuerpo válido de exactamente 65536 bytes pasa el control de tamaño', () => {
    const env = crearEntorno();
    const cuerpo = rellenar(guardarCuerpo(CODIGO_ACTIVO, [resp()]), 65536);
    expect(Buffer.byteLength(cuerpo, 'utf8')).toBe(65536);
    expect(env.post(cuerpo)['ok']).toBe(true);
    expect(env.escritas('Respuestas')).toHaveLength(1);
  });

  it('un cuerpo de 65537 bytes da demasiado_grande y no escribe', () => {
    const env = crearEntorno();
    const cuerpo = rellenar(guardarCuerpo(CODIGO_ACTIVO, [resp()]), 65537);
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'demasiado_grande' });
    expect(conteoFilas(env)).toEqual({ Respuestas: 1, Autorizaciones: 1, Padrón: 1 + PADRON_PRUEBA.length });
  });

  it('se cuentan bytes y no caracteres: 33000 ñ pasan de 64 KB', () => {
    const env = crearEntorno();
    const cuerpo = JSON.stringify({ accion: 'autorizar', r: CODIGO_ACTIVO, version: '1', vago: true, relleno: 'ñ'.repeat(33000) });
    expect(cuerpo.length).toBeLessThan(65536);
    expect(Buffer.byteLength(cuerpo, 'utf8')).toBeGreaterThan(65536);
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'demasiado_grande' });
    expect(env.escritas('Autorizaciones')).toEqual([]);
  });

  it('un par sustituto cuenta 4 bytes y una unidad de 3 bytes cuenta 3', () => {
    const env = crearEntorno();
    const bytes = env.fn<(t: string) => number>('bytesUtf8');
    for (const t of ['', 'a', 'ñ', '€', '😀', 'a😀ñ€', '\ud800', '\udc00a', '\ud800𐀀']) expect(bytes(t)).toBe(Buffer.byteLength(t, 'utf8'));
  });

  it('una carga válida cuyo texto pasa de 50000 caracteres da demasiado_grande sin filas', () => {
    const env = crearEntorno();
    const respuestas = Array.from({ length: 13 }, (_, i) => resp({ campo: `fuente.${i}`, veredicto: 'corregir', propuesta: 'x'.repeat(4000) }));
    const cuerpo = guardarCuerpo(CODIGO_ACTIVO, respuestas);
    const carga = cargaRevisionV2(CODIGO_ACTIVO, respuestas);
    expect(carga.length).toBeGreaterThan(50000);
    expect(Buffer.byteLength(cuerpo, 'utf8')).toBeLessThanOrEqual(65536);
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'demasiado_grande' });
    expect(env.escritas('Respuestas')).toEqual([]);
  });

  it('una carga de 12 respuestas con propuesta de 4000 cabe en la celda', () => {
    const env = crearEntorno();
    const respuestas = Array.from({ length: 12 }, (_, i) => resp({ campo: `fuente.${i}`, veredicto: 'corregir', propuesta: 'x'.repeat(4000) }));
    const carga = cargaRevisionV2(CODIGO_ACTIVO, respuestas);
    expect(carga.length).toBeLessThanOrEqual(50000);
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, respuestas))['ok']).toBe(true);
    expect(env.escritas('Respuestas')[0]![3]).toBe(carga);
  });

  it.each([
    ['un cuerpo que no es JSON', 'esto no es json'],
    ['un cuerpo que es un arreglo', '[1,2]'],
    ['un cuerpo que es null', 'null'],
    ['una acción desconocida', JSON.stringify({ accion: 'borrar', r: CODIGO_ACTIVO })],
    ['una acción ausente', JSON.stringify({ r: CODIGO_ACTIVO, carga: cargaRevisionV2(CODIGO_ACTIVO, [resp()]) })],
    ['una acción que no es texto', JSON.stringify({ accion: ['guardar'], r: CODIGO_ACTIVO })],
    ['la acción leer por POST', JSON.stringify({ accion: 'leer', r: CODIGO_ACTIVO })],
    ['una carga que es un objeto', JSON.stringify({ accion: 'guardar', carga: JSON.parse(cargaRevisionV2(CODIGO_ACTIVO, [resp()])) })],
    ['una carga que no es JSON', JSON.stringify({ accion: 'guardar', carga: 'no es json' })],
    ['una carga que es un arreglo', JSON.stringify({ accion: 'guardar', carga: '[1]' })],
    ['una carga ausente', JSON.stringify({ accion: 'guardar' })],
  ])('%s da formato y no escribe', (_n, cuerpo) => {
    const env = crearEntorno();
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'formato' });
    expect(conteoFilas(env)).toEqual({ Respuestas: 1, Autorizaciones: 1, Padrón: 1 + PADRON_PRUEBA.length });
  });

  it('un POST sin cuerpo da formato', () => {
    const env = crearEntorno();
    expect(env.postSinCuerpo()).toEqual({ ok: false, error: 'formato' });
    expect(env.post('')).toEqual({ ok: false, error: 'formato' });
  });

  it.each([
    ['sin accion', {}],
    ['con otra accion', { accion: 'guardar', r: CODIGO_ACTIVO }],
  ])('un GET %s da formato', (_n, parametros) => {
    const env = crearEntorno();
    expect(env.get(parametros as Record<string, string>)).toEqual({ ok: false, error: 'formato' });
  });

  it('todas las respuestas salen como JSON por ContentService', () => {
    const env = crearEntorno();
    env.post('no json');
    env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]));
    env.get({ accion: 'leer', r: CODIGO_ACTIVO });
    env.get({ accion: 'leer', r: CODIGO_AUSENTE });
    expect(env.salidas).toHaveLength(4);
    for (const s of env.salidas) {
      expect(s.mime).toBe(MIME_JSON);
      expect(() => JSON.parse(s.contenido)).not.toThrow();
    }
  });

  describe('autorizar malformado', () => {
    it.each<[string, Record<string, unknown>]>([
      ['version ausente', { version: undefined }],
      ['version numérica', { version: 1 }],
      ['version vacía', { version: '' }],
      ['version de 41 caracteres', { version: 'a'.repeat(41) }],
      ['version con espacio', { version: 'a b' }],
      ['version con signo igual', { version: '=1' }],
      ['version null', { version: null }],
      ['vago como texto sí', { vago: 'sí' }],
      ['vago numérico', { vago: 1 }],
      ['vago null', { vago: null }],
      ['vago ausente', { vago: undefined }],
    ])('%s da formato y no escribe', (_n, extra) => {
      const env = crearEntorno();
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, extra))).toEqual({ ok: false, error: 'formato' });
      expect(env.escritas('Autorizaciones')).toEqual([]);
    });

    it('version 1 con vago true pasa; 40 caracteres también', () => {
      const env = crearEntorno();
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO))).toEqual({ ok: true });
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { version: 'a'.repeat(40) }))).toEqual({ ok: true });
    });
  });

  describe('paridad con la app', () => {
    it.each(casosRespuesta)('respuestaValida con %s', (_n, r, vale) => {
      const env = crearEntorno();
      const delScript = env.fn<(r: unknown, idOk: (id: unknown) => boolean) => boolean>('respuestaValida')(r, idForma);
      expect(delScript).toBe(respuestaValida(r, idForma));
      expect(delScript).toBe(vale);
    });

    it.each(casosFecha)('fechaValida con %s', (_n, f, vale) => {
      const env = crearEntorno();
      const delScript = env.fn<(f: unknown) => boolean>('fechaValida')(f);
      expect(delScript).toBe(fechaValida(f));
      expect(delScript).toBe(vale);
    });

    it.each(casosCarga)('la carga con %s', (_n, carga, vale) => {
      const env = crearEntorno();
      const res = env.post(JSON.stringify({ accion: 'guardar', carga }));
      const { envios, invalidas } = leerEnvios([['Recibido', 'Código', 'Estructuras', 'Carga'], ['t', 'x', 'y', carga]]);
      const laApp = invalidas === 0 && envios.length > 0;
      expect(res['ok']).toBe(laApp);
      expect(laApp).toBe(vale);
      if (res['ok']) {
        expect(env.escritas('Respuestas')).toHaveLength(1);
      } else {
        // Una carga que ni siquiera es JSON es formato; si es un objeto, manda el código que declara.
        let esperado = 'formato';
        try {
          const r = (JSON.parse(carga) as { r?: unknown }).r;
          if (!(typeof r === 'string' && REVISOR_VALIDO.test(r))) esperado = 'codigo_no_activo';
        } catch {
          // queda formato
        }
        expect(res['error']).toBe(esperado);
        expect(env.escritas('Respuestas')).toEqual([]);
      }
    });
  });
});

describe('(c) ritmo por código (R6.3)', () => {
  it.each(ACCIONES)('%s: las peticiones 1 a 120 pasan, la 121 no y a los 60 s vuelve a pasar', (accion) => {
    const env = crearEntorno();
    for (let i = 1; i <= 120; i++) expect(pedir(env, accion, CODIGO_ACTIVO)['ok']).toBe(true);
    const filas = env.hojas.Respuestas.filas.length + env.hojas.Autorizaciones.filas.length;
    expect(pedir(env, accion, CODIGO_ACTIVO)).toEqual({ ok: false, error: 'demasiadas_peticiones' });
    expect(env.hojas.Respuestas.filas.length + env.hojas.Autorizaciones.filas.length).toBe(filas);
    if (accion === 'guardar') expect(env.hojas.Respuestas.filas).toHaveLength(1 + 120);
    // Otro código en el mismo minuto no queda bloqueado.
    expect(pedir(env, accion, OTRO_ACTIVO)['ok']).toBe(true);
    env.reloj.avanzar(60000);
    expect(pedir(env, accion, CODIGO_ACTIVO)['ok']).toBe(true);
  });

  it('el ritmo se comparte entre las tres acciones del mismo código', () => {
    const env = crearEntorno();
    for (let i = 0; i < 40; i++) for (const a of ACCIONES) pedir(env, a, CODIGO_ACTIVO);
    expect(pedir(env, 'leer', CODIGO_ACTIVO)).toEqual({ ok: false, error: 'demasiadas_peticiones' });
  });

  it('un código inactivo no gasta el ritmo ni lo cuenta', () => {
    const env = crearEntorno();
    for (let i = 0; i < 130; i++) expect(pedir(env, 'leer', CODIGO_INACTIVO)['error']).toBe('codigo_no_activo');
    expect(pedir(env, 'leer', CODIGO_ACTIVO)['ok']).toBe(true);
  });

  it('la ventana cambia con el minuto del reloj, no a los 60 s de la primera petición', () => {
    const env = crearEntorno({ ahora: Date.parse('2026-10-14T10:00:30.000Z') });
    for (let i = 0; i < 120; i++) pedir(env, 'leer', CODIGO_ACTIVO);
    expect(pedir(env, 'leer', CODIGO_ACTIVO)['error']).toBe('demasiadas_peticiones');
    env.reloj.avanzar(29999);
    expect(pedir(env, 'leer', CODIGO_ACTIVO)['error']).toBe('demasiadas_peticiones');
    env.reloj.avanzar(1);
    expect(pedir(env, 'leer', CODIGO_ACTIVO)['ok']).toBe(true);
  });

  it('el contador se guarda en el caché solo 60 s', () => {
    const env = crearEntorno();
    pedir(env, 'guardar', CODIGO_ACTIVO);
    expect(env.vidas).toEqual([60]);
  });
});

describe('(d) guardar escribe en Respuestas (R6.4)', () => {
  it('conserva la cabecera y escribe A fecha de recepción, B código, C ids, D carga, todo como texto', () => {
    const env = crearEntorno();
    env.reloj.avanzar(5000);
    const respuestas = [
      resp({ idioma: undefined, campo: 'relaciones', veredicto: 'corregir', propuesta: 'Agregar el subículo' }),
      resp({ campo: 'ubicacion', fecha: '' }),
      resp({ estructura: '-x', campo: 'que_es' }),
      resp({ campo: 'que_es', idioma: 'en' }),
    ];
    const carga = cargaRevisionV2(CODIGO_ACTIVO, respuestas);
    const res = env.post(JSON.stringify({ accion: 'guardar', carga }));
    const hoja = env.hojas.Respuestas;
    expect(hoja.filas[0]).toEqual([...CABECERAS.Respuestas]);
    expect(hoja.filas).toHaveLength(2);
    expect(hoja.filas[1]).toEqual([new Date(env.reloj.ahora).toISOString(), CODIGO_ACTIVO, 'hippocampus,-x', carga]);
    for (let c = 1; c <= 4; c++) expect(hoja.formatos.get(`2,${c}`)).toBe('@');
    expect(hoja.formulas.size).toBe(0);
    expect(res).toEqual({
      ok: true,
      recibidas: [
        'hippocampus|relaciones||2026-10-14T09:59:00.000Z',
        'hippocampus|ubicacion|es|',
        'hippocampus|que_es|en|2026-10-14T09:59:00.000Z',
        '-x|que_es|es|2026-10-14T09:59:00.000Z',
      ],
    });
  });

  it('cada guardar aceptado va en la fila siguiente', () => {
    const env = crearEntorno();
    env.post(guardarCuerpo(CODIGO_ACTIVO, [resp({ campo: 'nombre' })]));
    env.reloj.avanzar(1000);
    env.post(guardarCuerpo(OTRO_ACTIVO, [resp({ campo: 'latin' })]));
    const filas = env.hojas.Respuestas.filas;
    expect(filas).toHaveLength(3);
    expect(filas[1]![1]).toBe(CODIGO_ACTIVO);
    expect(filas[2]![1]).toBe(OTRO_ACTIVO);
    expect(filas[2]![0]).toBe(isoDe(env));
    expect(env.hojas.Respuestas.formatos.get('3,4')).toBe('@');
  });

  it('un código con guion inicial y una propuesta que empieza con = quedan como texto, nunca como fórmula', () => {
    const env = crearEntorno();
    const res = env.post(guardarCuerpo(CODIGO_GUION, [resp({ campo: 'relaciones', veredicto: 'corregir', propuesta: '=HYPERLINK("x")' }), resp({ estructura: '-x', campo: 'nombre', veredicto: 'corregir', propuesta: '+1', comentario: '@SUMA(1)' })]));
    expect(res['ok']).toBe(true);
    const hoja = env.hojas.Respuestas;
    expect(hoja.filas[1]![1]).toBe(CODIGO_GUION);
    expect(hoja.filas[1]![2]).toBe('hippocampus,-x');
    expect(String(hoja.filas[1]![3])).toContain('"p":"=HYPERLINK(\\"x\\")"');
    expect(hoja.formulas.size).toBe(0);
  });

  it('el doble de Sheets sí toma como fórmula lo que empieza con = sin formato de texto', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.getRange(2, 2, 1, 1).setValues([['-K7Q2']]);
    expect([...env.hojas.Respuestas.formulas]).toEqual(['2,2']);
  });

  it('las filas que escribió el script, exportadas a CSV, se importan sin inválidas', () => {
    const env = crearEntorno();
    env.post(guardarCuerpo(CODIGO_GUION, [resp({ campo: 'relaciones', veredicto: 'corregir', propuesta: 'Texto, con coma y "comillas"\ny salto' })]));
    env.post(guardarCuerpo(CODIGO_ACTIVO, [resp({ campo: 'que_es', idioma: 'en' }), resp({ estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [0.00123, 1.61234, -0.01987], version: 'sin-ficha' })]));
    env.post(autorizarCuerpo(CODIGO_ACTIVO));
    const csvDe = (filas: Celda[][]) => filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const estructuras = { hippocampus: { ficha: { version: '0.1.0' } }, 'm-periaqueductal-grey': { ficha: null } };
    const padron = { [CODIGO_ACTIVO]: 'D01', [CODIGO_GUION]: 'D02' };
    const csv = `${csvDe(env.hojas.Respuestas.filas)}\n`;
    const resultado = importar(csv, estructuras, padron);
    expect(resultado.invalidas).toBe(0);
    expect(resultado.validos).toBe(3);
    expect(resultado.desconocidos).toBe(0);
    // Las filas de Autorizaciones, con la cabecera, tampoco cuentan como inválidas.
    const mezclado = importar(`${csv}${csvDe(env.hojas.Autorizaciones.filas.slice(1))}\n`, estructuras, padron);
    expect(mezclado.invalidas).toBe(0);
    expect(mezclado.validos).toBe(3);
    expect(parsearCsv(csv)).toHaveLength(3);
  });

  it('la carga se escribe idéntica a la de la app (las claves cortas no se reordenan ni se pierden)', () => {
    const env = crearEntorno();
    const respuestas = [resp({ campo: 'posicion', veredicto: 'corregir', posicion: [1, 2.5, -3], malla: 'Vagus_nerve.R', ramo: 'no_se', propuesta: 'p', comentario: 'k', version: 'sin-ficha' })];
    env.post(guardarCuerpo(CODIGO_ACTIVO, respuestas));
    expect(env.escritas('Respuestas')[0]![3]).toBe(cargaRevisionV2(CODIGO_ACTIVO, respuestas));
  });

  it('las claves desconocidas de la carga no se escriben', () => {
    const env = crearEntorno();
    const carga = JSON.stringify({ v: 2, r: CODIGO_ACTIVO, extra: 1, e: { hippocampus: [{ c: 'a', d: 'correcto', s: '0.1.0', zzz: 'x', estructura: 'otra' }] } });
    expect(env.post(JSON.stringify({ accion: 'guardar', carga }))).toEqual({ ok: true, recibidas: ['hippocampus|a||'] });
    expect(env.escritas('Respuestas')[0]![3]).toBe(JSON.stringify({ v: 2, r: CODIGO_ACTIVO, e: { hippocampus: [{ c: 'a', d: 'correcto', s: '0.1.0' }] } }));
  });
});

describe('(e) autorizar escribe en Autorizaciones (R2.3)', () => {
  it.each([
    [true, 'sí'],
    [false, 'no'],
  ])('con vago %s escribe la fila con %s, con formato de texto', (vago, texto) => {
    const env = crearEntorno();
    env.reloj.avanzar(7000);
    const res = env.post(autorizarCuerpo(CODIGO_ACTIVO, { vago }));
    expect(res).toEqual({ ok: true });
    const hoja = env.hojas.Autorizaciones;
    expect(hoja.filas[0]).toEqual([...CABECERAS.Autorizaciones]);
    expect(hoja.filas).toHaveLength(2);
    expect(hoja.filas[1]).toEqual([CODIGO_ACTIVO, isoDe(env), '1', texto]);
    for (let c = 1; c <= 4; c++) expect(hoja.formatos.get(`2,${c}`)).toBe('@');
    expect(env.escritas('Respuestas')).toEqual([]);
  });

  it('un código con guion inicial queda como texto', () => {
    const env = crearEntorno();
    expect(env.post(autorizarCuerpo(CODIGO_GUION))).toEqual({ ok: true });
    expect(env.hojas.Autorizaciones.filas[1]![0]).toBe(CODIGO_GUION);
    expect(env.hojas.Autorizaciones.formulas.size).toBe(0);
  });

  it('la fila escrita tiene la forma que el importador ignora en la pestaña de otro tipo', () => {
    const env = crearEntorno();
    env.post(autorizarCuerpo(CODIGO_ACTIVO));
    const fila = env.escritas('Autorizaciones')[0]!;
    const csv = `${CABECERAS.Respuestas.join(',')}\n${fila.map((c) => `"${String(c)}"`).join(',')}\n`;
    expect(leerEnvios(parsearCsv(csv)).invalidas).toBe(0);
  });
});

describe('(f) leer devuelve solo lo del código (R4.3)', () => {
  const cargaDe = (r: string, e: unknown) => JSON.stringify({ v: 2, r, e });
  const el = (extra: Record<string, unknown> = {}) => ({ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0', f: '2026-10-14T09:00:00.000Z', ...extra });
  const fila = (b: string, carga: string, c = 'hippocampus'): Celda[] => ['2026-10-14T10:00:00.000Z', b, c, carga];

  it('solo las respuestas de ese código, una por clave (la última) y sin duplicados', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(
      fila(OTRO_ACTIVO, cargaDe(OTRO_ACTIVO, { hippocampus: [el({ p: 'secreto de otro' })], 'm-periaqueductal-grey': [el({ c: 'nombre' })] })),
      // B es el código pero la carga declara otro código.
      fila(CODIGO_ACTIVO, cargaDe(OTRO_ACTIVO, { hippocampus: [el({ c: 'robada', p: 'secreto de otro' })] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ d: 'corregir', p: 'vieja', f: '2026-10-14T09:00:01.000Z' }), el({ c: 'que_es' })] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ d: 'corregir', p: 'nueva', f: '2026-10-14T09:00:02.000Z' })] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ c: 'que_es' })] })),
      fila(OTRO_ACTIVO, cargaDe(OTRO_ACTIVO, { hippocampus: [el({ c: 'otra' })] })),
    );
    const antes = JSON.stringify(env.hojas.Respuestas.filas);
    const res = env.get({ accion: 'leer', r: CODIGO_ACTIVO });
    expect(res['ok']).toBe(true);
    expect(res['respuestas']).toEqual({
      v: 2,
      r: CODIGO_ACTIVO,
      e: {
        hippocampus: [el({ d: 'corregir', p: 'nueva', f: '2026-10-14T09:00:02.000Z' }), el({ c: 'que_es' })],
      },
    });
    expect(JSON.stringify(res)).not.toContain(OTRO_ACTIVO);
    expect(JSON.stringify(res)).not.toContain('secreto de otro');
    expect(JSON.stringify(env.hojas.Respuestas.filas)).toBe(antes);
  });

  it('una fila con otro código en B no se devuelve aunque su carga diga el código pedido', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(fila(OTRO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ c: 'ajena' })] })));
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })['respuestas']).toEqual({ v: 2, r: CODIGO_ACTIVO, e: {} });
    expect(env.get({ accion: 'leer', r: OTRO_ACTIVO })['respuestas']).toEqual({ v: 2, r: OTRO_ACTIVO, e: {} });
  });

  it('separa por idioma: es y en de un mismo campo son claves distintas', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ i: 'es' }), el({ i: 'en', d: 'corregir', p: 'x' }), el({ i: undefined })] })));
    const e = (env.get({ accion: 'leer', r: CODIGO_ACTIVO })['respuestas'] as { e: Record<string, unknown[]> }).e;
    expect(e['hippocampus']).toHaveLength(3);
  });

  it('lo guardado por guardar vuelve igual por leer', () => {
    const env = crearEntorno();
    const respuestas = [resp({ campo: 'relaciones', idioma: undefined, veredicto: 'corregir', propuesta: 'p' }), resp({ estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [1, 2, 3], version: 'sin-ficha' })];
    env.post(guardarCuerpo(CODIGO_ACTIVO, respuestas));
    expect((env.get({ accion: 'leer', r: CODIGO_ACTIVO }) as { respuestas: unknown }).respuestas).toEqual(JSON.parse(cargaRevisionV2(CODIGO_ACTIVO, respuestas)));
  });

  it('las filas con carga inválida o con un id raro se saltan', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(
      fila(CODIGO_ACTIVO, 'no es json'),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { '../x': [el()] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ d: 'aprobado' })] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el()] })),
    );
    expect((env.get({ accion: 'leer', r: CODIGO_ACTIVO })['respuestas'] as { e: object }).e).toEqual({ hippocampus: [el()] });
  });

  it('la última autorización de ese código manda y la de otro código no cuenta', () => {
    const env = crearEntorno();
    env.hojas.Autorizaciones.filas.push(
      [CODIGO_ACTIVO, '2026-10-14T09:00:00.000Z', '0', 'sí'],
      [CODIGO_ACTIVO, '2026-10-14T09:30:00.000Z', '1', 'no'],
      [OTRO_ACTIVO, '2026-10-14T09:45:00.000Z', '2', 'sí'],
    );
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })['autorizacion']).toEqual({ version: '1', vago: false });
    expect(env.get({ accion: 'leer', r: OTRO_ACTIVO })['autorizacion']).toEqual({ version: '2', vago: true });
  });

  it('un código sin filas recibe respuestas vacías y autorizacion null', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(fila(OTRO_ACTIVO, cargaDe(OTRO_ACTIVO, { hippocampus: [el()] })));
    env.hojas.Autorizaciones.filas.push([OTRO_ACTIVO, '2026-10-14T09:00:00.000Z', '1', 'sí']);
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: true, respuestas: { v: 2, r: CODIGO_ACTIVO, e: {} }, autorizacion: null });
  });

  it('autorizar y luego leer devuelve la autorización escrita', () => {
    const env = crearEntorno();
    env.post(autorizarCuerpo(CODIGO_ACTIVO, { vago: true }));
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })['autorizacion']).toEqual({ version: '1', vago: true });
  });
});

describe('(g) bloqueo y fallos de escritura (R6.4)', () => {
  it.each(['guardar', 'autorizar'] as const)('%s toma el bloqueo una vez con espera de 10 s y lo libera', (accion) => {
    const env = crearEntorno();
    expect(pedir(env, accion, CODIGO_ACTIVO)['ok']).toBe(true);
    expect(env.candado.esperas).toEqual([10000]);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.candado.escriturasSinCandado).toBe(0);
    expect(env.candado.tomado).toBe(false);
    expect(env.flushes()).toBe(1);
  });

  it.each(['guardar', 'autorizar'] as const)('%s sin bloqueo da interno y no escribe', (accion) => {
    const env = crearEntorno();
    env.candado.obtener = false;
    expect(pedir(env, accion, CODIGO_ACTIVO)).toEqual({ ok: false, error: 'interno' });
    expect(env.candado.esperas).toEqual([10000]);
    expect(conteoFilas(env)).toEqual({ Respuestas: 1, Autorizaciones: 1, Padrón: 1 + PADRON_PRUEBA.length });
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues).toBe(0);
  });

  it.each(['guardar', 'autorizar'] as const)('%s con la escritura fallida da interno, libera el bloqueo y no deja filas ni el mensaje de la excepción', (accion) => {
    const env = crearEntorno();
    env.hojas.Respuestas.falla = true;
    env.hojas.Autorizaciones.falla = true;
    const res = pedir(env, accion, CODIGO_ACTIVO);
    expect(res).toEqual({ ok: false, error: 'interno' });
    expect(JSON.stringify(res)).not.toContain('falla simulada');
    expect(env.candado.liberaciones).toBe(1);
    expect(conteoFilas(env)).toEqual({ Respuestas: 1, Autorizaciones: 1, Padrón: 1 + PADRON_PRUEBA.length });
  });

  it('si falta la pestaña Respuestas, guardar da interno; si falta Autorizaciones, autorizar', () => {
    const a = crearEntorno({ sinPestana: 'Respuestas' });
    expect(a.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))).toEqual({ ok: false, error: 'interno' });
    expect(a.candado.liberaciones).toBe(1);
    const b = crearEntorno({ sinPestana: 'Autorizaciones' });
    expect(b.post(autorizarCuerpo(CODIGO_ACTIVO))).toEqual({ ok: false, error: 'interno' });
    expect(b.candado.liberaciones).toBe(1);
    expect(b.escritas('Respuestas')).toEqual([]);
  });

  it('si falta la pestaña Padrón, todas las acciones dan interno', () => {
    const env = crearEntorno({ sinPestana: 'Padrón' });
    for (const a of ACCIONES) expect(pedir(env, a, CODIGO_ACTIVO)).toEqual({ ok: false, error: 'interno' });
  });

  it('si falta la pestaña de lectura, leer da interno', () => {
    expect(crearEntorno({ sinPestana: 'Respuestas' }).get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: false, error: 'interno' });
    expect(crearEntorno({ sinPestana: 'Autorizaciones' }).get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: false, error: 'interno' });
  });

  it('leer no toma el bloqueo ni escribe', () => {
    const env = crearEntorno();
    env.get({ accion: 'leer', r: CODIGO_ACTIVO });
    expect(env.candado.esperas).toEqual([]);
    expect(env.candado.liberaciones).toBe(0);
    expect(env.hojas.Respuestas.llamadasSetValues).toBe(0);
  });

  it('el doble cuenta como escritura sin bloqueo la que no pasó por tryLock', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.getRange(2, 1, 1, 1).setValues([['x']]);
    expect(env.candado.escriturasSinCandado).toBe(1);
  });

  it('el doble de Sheets rechaza una celda de más de 50000 caracteres', () => {
    const env = crearEntorno();
    expect(() => env.hojas.Respuestas.getRange(2, 1, 1, 1).setValues([['x'.repeat(50001)]])).toThrow();
    expect(() => env.hojas.Respuestas.getRange(2, 1, 1, 1).setValues([['x'.repeat(50000)]])).not.toThrow();
  });
});

describe('(h) el archivo no lleva datos (R6.5)', () => {
  const fuente = readFileSync(RUTA_SCRIPT, 'utf8');

  it('no tiene correos ni alias', () => {
    expect(fuente).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(fuente).not.toMatch(/\bD\d{2}\b/);
  });

  it('no tiene ningún código del padrón de prueba', () => {
    for (const [codigo] of PADRON_PRUEBA) expect(fuente).not.toContain(codigo!);
    for (const c of [CODIGO_AUSENTE, OTRO_ACTIVO]) expect(fuente).not.toContain(c);
  });

  it('no tiene direcciones ni abre hojas por id o por dirección', () => {
    expect(fuente).not.toContain('https://');
    expect(fuente).not.toContain('http://');
    expect(fuente).not.toContain('openById');
    expect(fuente).not.toContain('openByUrl');
  });

  it('limita el acceso a la hoja vinculada y es un script clásico', () => {
    expect(fuente).toContain('@OnlyCurrentDoc');
    expect(fuente).not.toMatch(/\bimport /);
    expect(fuente).not.toMatch(/\bexport /);
  });

  it('no usa sintaxis que el runtime de Apps Script no garantice', () => {
    expect(fuente).not.toContain('?.');
    expect(fuente).not.toContain('??');
    expect(fuente).not.toContain('Object.hasOwn');
  });
});
