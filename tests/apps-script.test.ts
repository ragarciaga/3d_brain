// Prueba del canal de retorno (spec 03, T2): apps-script/Codigo.js se carga en Node con `node:vm` y
// dobles de Google (tests/fixtures/apps-script/dobles.ts). Los dobles siguen la documentación; el
// oráculo real es la prueba manual del editor (docs/revision-docente.md). Lo que Sheets hace con el
// formato `@` no se puede comprobar aquí.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esRespuestaDelVago, importar, leerEnvios, parsearCsv } from '../scripts/lib/revisiones.ts';
import { VERSION_AUTORIZACION, VERSION_CANAL } from '../src/config/revision';
import { cuerpoGuardar, type TipoErrorCanal } from '../src/lib/canal';
import { armarLotes, estadoInicial, pendientes, porEnviar, retirosPendientes, trasEnvio, type ResultadoEnvio } from '../src/lib/colaGuardado';
import { cargaRevisionV2, claveRespuesta, fechaValida, REVISOR_VALIDO, respuestaValida, retiroValido, type Respuesta, type Retiro } from '../src/lib/revision';
import {
  CABECERAS,
  casosCarga,
  casosCargaRetiro,
  casosFecha,
  casosRespuesta,
  casosRetiro,
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

/** Códigos con la autorización vigente en `Autorizaciones`: los que guardan en las pruebas que no tratan de la autorización. */
const AUTORIZADOS = [CODIGO_ACTIVO, CODIGO_GUION, OTRO_ACTIVO];

const base = { idioma: 'es' as const, version: '0.1.0', fecha: '2026-10-14T09:59:00.000Z' };
const resp = (extra: Partial<Respuesta> = {}): Respuesta => ({ ...base, estructura: 'hippocampus', campo: 'ubicacion', veredicto: 'correcto', ...extra });
const guardarCuerpo = (codigo: string, respuestas: Respuesta[]) => JSON.stringify({ accion: 'guardar', carga: cargaRevisionV2(codigo, respuestas) });
const autorizarCuerpo = (codigo: string, extra: Record<string, unknown> = {}) => JSON.stringify({ accion: 'autorizar', r: codigo, version: VERSION_AUTORIZACION, vago: true, ...extra });
const idForma = (id: unknown) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id);
const isoDe = (env: Entorno) => new Date(env.reloj.ahora).toISOString();
/** Lo que `leer` responde en `respuestas` y en `retiradas` cuando el código no tiene nada. */
const vacia = { v: 2, r: CODIGO_ACTIVO, e: {} };

/** Las tres acciones del POST. El GET ya no lee (#169): se prueba aparte, en el describe (m). */
type Accion = 'guardar' | 'autorizar' | 'leer';
/** Una petición de cada acción con un código dado. */
function pedir(env: Entorno, accion: Accion, codigo: string) {
  if (accion === 'guardar') return env.post(guardarCuerpo(codigo, [resp()]));
  if (accion === 'autorizar') return env.post(autorizarCuerpo(codigo));
  return env.postLeer(codigo);
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
    const res = env.postLeer(CODIGO_ACTIVO);
    // `sí ` con espacio final cuenta (se recortan los espacios); las demás formas no.
    expect(res['ok']).toBe(activo === 'sí ');
  });

  it('la fila 1 del padrón es la cabecera y no activa a nadie', () => {
    const env = crearEntorno({ padron: [] });
    env.hojas.Padrón.filas[0] = [CODIGO_ACTIVO, 'D01', 'sí'];
    expect(env.postLeer(CODIGO_ACTIVO)).toEqual({ ok: false, error: 'codigo_no_activo' });
    env.hojas.Padrón.filas.push([CODIGO_ACTIVO, 'D01', 'sí']);
    // El padrón se guarda 60 s en la caché (S3, #162): la fila nueva cuenta al vencer.
    env.reloj.avanzar(61000);
    expect(env.postLeer(CODIGO_ACTIVO)['ok']).toBe(true);
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
    expect(env.post(JSON.stringify({ accion: 'leer' }))).toEqual({ ok: false, error: 'codigo_no_activo' });
  });
});

describe('(b) tamaño y formato (R6.2)', () => {
  const rellenar = (cuerpo: string, bytes: number) => cuerpo + ' '.repeat(bytes - Buffer.byteLength(cuerpo, 'utf8'));

  it('un cuerpo válido de exactamente 65536 bytes pasa el control de tamaño', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    const respuestas = Array.from({ length: 13 }, (_, i) => resp({ campo: `fuente.${i}`, veredicto: 'corregir', propuesta: 'x'.repeat(4000) }));
    const cuerpo = guardarCuerpo(CODIGO_ACTIVO, respuestas);
    const carga = cargaRevisionV2(CODIGO_ACTIVO, respuestas);
    expect(carga.length).toBeGreaterThan(50000);
    expect(Buffer.byteLength(cuerpo, 'utf8')).toBeLessThanOrEqual(65536);
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'demasiado_grande' });
    expect(env.escritas('Respuestas')).toEqual([]);
  });

  it('una carga de 12 respuestas con propuesta de 4000 cabe en la celda', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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

  it('todas las respuestas salen como JSON por ContentService', () => {
    const env = crearEntorno();
    env.post('no json');
    env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]));
    env.get({ accion: 'leer', r: CODIGO_ACTIVO });
    env.postLeer(CODIGO_AUSENTE);
    env.postLeer(CODIGO_ACTIVO);
    expect(env.salidas).toHaveLength(5);
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

    it('la versión vigente con vago true pasa; una de 40 caracteres tiene forma válida pero da formato (#169)', () => {
      const env = crearEntorno();
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO))).toEqual({ ok: true });
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { version: 'a'.repeat(40) }))).toEqual({ ok: false, error: 'formato' });
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
      // La app no conoce la casilla del vago (S2, #166): la paridad se prueba con la casilla en `sí`.
      const env = crearEntorno({ autorizados: AUTORIZADOS, vago: true });
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
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    // El GET no mira el ritmo: sigue dando formato aun con el ritmo agotado.
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: false, error: 'formato' });
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

  it('el contador y el padrón se guardan en el caché solo 60 s', () => {
    const env = crearEntorno();
    pedir(env, 'guardar', CODIGO_ACTIVO);
    expect(env.puts.map((p) => p.clave.split('|')[0]).sort()).toEqual(['padron', 'ritmo']);
    expect(env.puts.every((p) => p.segundos === 60)).toBe(true);
    expect(env.vidas).toEqual([60, 60]);
  });
});

describe('(d) guardar escribe en Respuestas (R6.4)', () => {
  it('conserva la cabecera y escribe A fecha de recepción, B código, C ids, D carga, todo como texto', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    // Con malla y ramo, la carga es del vago: pasa solo con la casilla en `sí` (S2, #166).
    const env = crearEntorno({ autorizados: AUTORIZADOS, vago: true });
    const respuestas = [resp({ campo: 'posicion', veredicto: 'corregir', posicion: [1, 2.5, -3], malla: 'Vagus_nerve.R', ramo: 'no_se', propuesta: 'p', comentario: 'k', version: 'sin-ficha' })];
    env.post(guardarCuerpo(CODIGO_ACTIVO, respuestas));
    expect(env.escritas('Respuestas')[0]![3]).toBe(cargaRevisionV2(CODIGO_ACTIVO, respuestas));
  });

  it('las claves desconocidas de la carga no se escriben', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
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
    expect(hoja.filas[1]).toEqual([CODIGO_ACTIVO, isoDe(env), VERSION_AUTORIZACION, texto]);
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
    const res = env.postLeer(CODIGO_ACTIVO);
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
    expect(env.postLeer(CODIGO_ACTIVO)['respuestas']).toEqual({ v: 2, r: CODIGO_ACTIVO, e: {} });
    expect(env.postLeer(OTRO_ACTIVO)['respuestas']).toEqual({ v: 2, r: OTRO_ACTIVO, e: {} });
  });

  it('separa por idioma: es y en de un mismo campo son claves distintas', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ i: 'es' }), el({ i: 'en', d: 'corregir', p: 'x' }), el({ i: undefined })] })));
    const e = (env.postLeer(CODIGO_ACTIVO)['respuestas'] as { e: Record<string, unknown[]> }).e;
    expect(e['hippocampus']).toHaveLength(3);
  });

  it('lo guardado por guardar vuelve igual por leer', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    const respuestas = [resp({ campo: 'relaciones', idioma: undefined, veredicto: 'corregir', propuesta: 'p' }), resp({ estructura: 'm-periaqueductal-grey', campo: 'posicion', veredicto: 'corregir', posicion: [1, 2, 3], version: 'sin-ficha' })];
    env.post(guardarCuerpo(CODIGO_ACTIVO, respuestas));
    expect((env.postLeer(CODIGO_ACTIVO) as { respuestas: unknown }).respuestas).toEqual(JSON.parse(cargaRevisionV2(CODIGO_ACTIVO, respuestas)));
  });

  it('las filas con carga inválida o con un id raro se saltan', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(
      fila(CODIGO_ACTIVO, 'no es json'),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { '../x': [el()] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el({ d: 'aprobado' })] })),
      fila(CODIGO_ACTIVO, cargaDe(CODIGO_ACTIVO, { hippocampus: [el()] })),
    );
    expect((env.postLeer(CODIGO_ACTIVO)['respuestas'] as { e: object }).e).toEqual({ hippocampus: [el()] });
  });

  it('la última autorización de ese código manda y la de otro código no cuenta', () => {
    const env = crearEntorno();
    env.hojas.Autorizaciones.filas.push(
      [CODIGO_ACTIVO, '2026-10-14T09:00:00.000Z', '0', 'sí'],
      [CODIGO_ACTIVO, '2026-10-14T09:30:00.000Z', '1', 'no'],
      [OTRO_ACTIVO, '2026-10-14T09:45:00.000Z', '2', 'sí'],
    );
    expect(env.postLeer(CODIGO_ACTIVO)['autorizacion']).toEqual({ version: '1', vago: false });
    expect(env.postLeer(OTRO_ACTIVO)['autorizacion']).toEqual({ version: '2', vago: true });
  });

  it('un código sin filas recibe respuestas vacías y autorizacion null', () => {
    const env = crearEntorno();
    env.hojas.Respuestas.filas.push(fila(OTRO_ACTIVO, cargaDe(OTRO_ACTIVO, { hippocampus: [el()] })));
    env.hojas.Autorizaciones.filas.push([OTRO_ACTIVO, '2026-10-14T09:00:00.000Z', '1', 'sí']);
    expect(env.postLeer(CODIGO_ACTIVO)).toEqual({ ok: true, canal: VERSION_CANAL, respuestas: vacia, retiradas: vacia, autorizacion: null });
  });

  it('autorizar y luego leer devuelve la autorización escrita', () => {
    const env = crearEntorno();
    env.post(autorizarCuerpo(CODIGO_ACTIVO, { vago: true }));
    expect(env.postLeer(CODIGO_ACTIVO)['autorizacion']).toEqual({ version: VERSION_AUTORIZACION, vago: true });
  });
});

describe('(g) bloqueo y fallos de escritura (R6.4)', () => {
  it.each(['guardar', 'autorizar'] as const)('%s toma el bloqueo una vez con espera de 10 s y lo libera', (accion) => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    expect(pedir(env, accion, CODIGO_ACTIVO)['ok']).toBe(true);
    expect(env.candado.esperas).toEqual([10000]);
    expect(env.candado.liberaciones).toBe(1);
    expect(env.candado.escriturasSinCandado).toBe(0);
    expect(env.candado.tomado).toBe(false);
    expect(env.flushes()).toBe(1);
  });

  it.each(['guardar', 'autorizar'] as const)('%s sin bloqueo da interno y no escribe', (accion) => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    const antes = conteoFilas(env);
    env.candado.obtener = false;
    expect(pedir(env, accion, CODIGO_ACTIVO)).toEqual({ ok: false, error: 'interno' });
    expect(env.candado.esperas).toEqual([10000]);
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues).toBe(0);
  });

  it.each(['guardar', 'autorizar'] as const)('%s con la escritura fallida da interno, libera el bloqueo y no deja filas ni el mensaje de la excepción', (accion) => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    const antes = conteoFilas(env);
    env.hojas.Respuestas.falla = true;
    env.hojas.Autorizaciones.falla = true;
    const res = pedir(env, accion, CODIGO_ACTIVO);
    expect(res).toEqual({ ok: false, error: 'interno' });
    expect(JSON.stringify(res)).not.toContain('falla simulada');
    expect(env.candado.liberaciones).toBe(1);
    expect(conteoFilas(env)).toEqual(antes);
  });

  it('si falta la pestaña Respuestas, guardar da interno; si falta Autorizaciones, autorizar', () => {
    const a = crearEntorno({ sinPestana: 'Respuestas', autorizados: AUTORIZADOS });
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
    expect(crearEntorno({ sinPestana: 'Respuestas' }).postLeer(CODIGO_ACTIVO)).toEqual({ ok: false, error: 'interno' });
    expect(crearEntorno({ sinPestana: 'Autorizaciones' }).postLeer(CODIGO_ACTIVO)).toEqual({ ok: false, error: 'interno' });
  });

  it('leer no toma el bloqueo ni escribe', () => {
    const env = crearEntorno();
    expect(env.postLeer(CODIGO_ACTIVO)['ok']).toBe(true);
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

describe('(i) guardar exige la autorización vigente (S1, #157)', () => {
  const SIN_AUT = { ok: false, error: 'sin_autorizacion' };
  const guardarDe = (env: Entorno, codigo = CODIGO_ACTIVO) => env.post(guardarCuerpo(codigo, [resp()]));
  const fila = (codigo: string, version: string, vago: 'sí' | 'no', t = '2026-10-14T09:00:00.000Z'): Celda[] => [codigo, t, version, vago];

  it('sin ninguna fila en Autorizaciones da sin_autorizacion y no escribe ni toma el bloqueo', () => {
    const env = crearEntorno();
    expect(guardarDe(env)).toEqual(SIN_AUT);
    expect(env.escritas('Respuestas')).toEqual([]);
    expect(env.hojas.Respuestas.llamadasSetValues).toBe(0);
    expect(env.candado.esperas).toEqual([]);
  });

  it('con la fila de otro código solo, el código sin fila da sin_autorizacion y el otro guarda', () => {
    const env = crearEntorno({ autorizados: [OTRO_ACTIVO] });
    expect(guardarDe(env)).toEqual(SIN_AUT);
    expect(env.escritas('Respuestas')).toEqual([]);
    expect(env.hojas.Respuestas.llamadasSetValues).toBe(0);
    expect(env.candado.esperas).toEqual([]);
    expect(guardarDe(env, OTRO_ACTIVO)['ok']).toBe(true);
    expect(env.escritas('Respuestas')).toHaveLength(1);
  });

  it('la versión del script es la de la app: con la de la app guarda y con otra da sin_autorizacion', () => {
    const bien = crearEntorno();
    bien.hojas.Autorizaciones.filas.push(fila(CODIGO_ACTIVO, VERSION_AUTORIZACION, 'no'));
    expect(guardarDe(bien)['ok']).toBe(true);
    expect(bien.escritas('Respuestas')).toHaveLength(1);

    const vieja = crearEntorno();
    vieja.hojas.Autorizaciones.filas.push(fila(CODIGO_ACTIVO, `${VERSION_AUTORIZACION}-anterior`, 'no'));
    expect(guardarDe(vieja)).toEqual(SIN_AUT);
    expect(vieja.escritas('Respuestas')).toEqual([]);
    expect(vieja.hojas.Respuestas.llamadasSetValues).toBe(0);
    expect(vieja.candado.esperas).toEqual([]);
  });

  it('manda la última fila del código: versión vigente tras una vieja guarda, y al revés no', () => {
    const vigenteAlFinal = crearEntorno();
    vigenteAlFinal.hojas.Autorizaciones.filas.push(fila(CODIGO_ACTIVO, '0', 'sí', 't1'), fila(CODIGO_ACTIVO, VERSION_AUTORIZACION, 'no', 't2'));
    expect(guardarDe(vigenteAlFinal)['ok']).toBe(true);

    const viejaAlFinal = crearEntorno();
    viejaAlFinal.hojas.Autorizaciones.filas.push(fila(CODIGO_ACTIVO, VERSION_AUTORIZACION, 'no', 't1'), fila(CODIGO_ACTIVO, '0', 'sí', 't2'));
    expect(guardarDe(viejaAlFinal)).toEqual(SIN_AUT);
    expect(viejaAlFinal.escritas('Respuestas')).toEqual([]);
  });

  it('autorizar y luego guardar por POST guarda una fila', () => {
    const env = crearEntorno();
    expect(guardarDe(env)).toEqual(SIN_AUT);
    expect(env.post(JSON.stringify({ accion: 'autorizar', r: CODIGO_ACTIVO, version: VERSION_AUTORIZACION, vago: false }))).toEqual({ ok: true });
    expect(guardarDe(env)['ok']).toBe(true);
    expect(env.escritas('Respuestas')).toHaveLength(1);
  });

  it('supresión: al borrar la fila del código, el siguiente guardar da sin_autorizacion', () => {
    const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
    expect(guardarDe(env)['ok']).toBe(true);
    env.hojas.Autorizaciones.filas.splice(1);
    expect(guardarDe(env)).toEqual(SIN_AUT);
    expect(env.escritas('Respuestas')).toHaveLength(1);
  });

  it('con dos filas válidas del código, borrar solo la última no quita la autorización (hay que borrar todas)', () => {
    const env = crearEntorno();
    env.hojas.Autorizaciones.filas.push(fila(CODIGO_ACTIVO, VERSION_AUTORIZACION, 'no', 't1'), fila(CODIGO_ACTIVO, VERSION_AUTORIZACION, 'sí', 't2'));
    env.hojas.Autorizaciones.filas.pop();
    expect(guardarDe(env)['ok']).toBe(true);
    env.hojas.Autorizaciones.filas.pop();
    expect(guardarDe(env)).toEqual(SIN_AUT);
  });

  describe('orden de las comprobaciones', () => {
    it('un código inactivo sin autorización da codigo_no_activo', () => {
      const env = crearEntorno();
      expect(guardarDe(env, CODIGO_INACTIVO)).toEqual({ ok: false, error: 'codigo_no_activo' });
    });

    it('una carga mal formada de un código sin autorización da sin_autorizacion, no formato', () => {
      const env = crearEntorno();
      const malformada = casosCarga.find(([n]) => n === 'e es un arreglo')![1];
      expect(env.post(JSON.stringify({ accion: 'guardar', carga: malformada }))).toEqual(SIN_AUT);
      expect(env.escritas('Respuestas')).toEqual([]);
    });

    it('un guardar sin autorización cuenta para el ritmo: 120 dan sin_autorizacion y el 121 demasiadas_peticiones', () => {
      const env = crearEntorno();
      for (let i = 1; i <= 120; i++) expect(guardarDe(env)).toEqual(SIN_AUT);
      expect(guardarDe(env)).toEqual({ ok: false, error: 'demasiadas_peticiones' });
    });

    it('leer sin autorización sigue dando ok con autorizacion null y autorizar no la exige', () => {
      const env = crearEntorno();
      expect(env.postLeer(CODIGO_ACTIVO)).toEqual({ ok: true, canal: VERSION_CANAL, respuestas: vacia, retiradas: vacia, autorizacion: null });
      expect(env.post(autorizarCuerpo(CODIGO_ACTIVO))).toEqual({ ok: true });
    });
  });
});

describe('(j) leer por POST (S4, #162)', () => {
  const rellenar = (cuerpo: string, bytes: number) => cuerpo + ' '.repeat(bytes - Buffer.byteLength(cuerpo, 'utf8'));
  const leerCuerpo = (extra: Record<string, unknown> = {}) => JSON.stringify({ accion: 'leer', r: CODIGO_ACTIVO, ...extra });
  const carga = (r: string) => JSON.stringify({ v: 2, r, e: { hippocampus: [{ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0', f: '2026-10-14T09:00:00.000Z' }] } });

  const poblar = (env: Entorno) => {
    env.hojas.Respuestas.filas.push(
      ['2026-10-14T10:00:00.000Z', OTRO_ACTIVO, 'hippocampus', carga(OTRO_ACTIVO)],
      ['2026-10-14T10:00:01.000Z', CODIGO_ACTIVO, 'hippocampus', carga(CODIGO_ACTIVO)],
    );
    env.hojas.Autorizaciones.filas.push(
      [CODIGO_ACTIVO, '2026-10-14T09:00:00.000Z', VERSION_AUTORIZACION, 'sí'],
      [OTRO_ACTIVO, '2026-10-14T09:10:00.000Z', '1', 'no'],
    );
  };

  it('el POST con las hojas pobladas devuelve solo lo del código', () => {
    const env = crearEntorno();
    poblar(env);
    const porPost = env.postLeer(CODIGO_ACTIVO);
    expect(porPost['ok']).toBe(true);
    expect(porPost['autorizacion']).toEqual({ version: VERSION_AUTORIZACION, vago: true });
    expect(JSON.stringify(porPost['respuestas'])).toContain('ubicacion');
    expect(JSON.stringify(porPost)).not.toContain(OTRO_ACTIVO);
  });

  it('el GET con las mismas hojas da formato y no lee ninguna pestaña (#169)', () => {
    const env = crearEntorno();
    poblar(env);
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual({ ok: false, error: 'formato' });
    expect(env.hojas.Respuestas.lecturas + env.hojas.Autorizaciones.lecturas + env.hojas.Padrón.lecturas).toBe(0);
  });

  it.each([
    ['sin r', JSON.stringify({ accion: 'leer' })],
    ['con r numérico', JSON.stringify({ accion: 'leer', r: 7 })],
    ['con r nulo', JSON.stringify({ accion: 'leer', r: null })],
    ['con r de otra forma', JSON.stringify({ accion: 'leer', r: ['x'] })],
  ])('un POST leer %s da codigo_no_activo', (_n, cuerpo) => {
    const env = crearEntorno();
    expect(env.post(cuerpo)).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it('un POST leer de 65536 bytes pasa y de 65537 da demasiado_grande, aunque el código no esté activo', () => {
    const env = crearEntorno();
    expect(env.post(rellenar(leerCuerpo(), 65536))['ok']).toBe(true);
    expect(env.post(rellenar(leerCuerpo(), 65537))).toEqual({ ok: false, error: 'demasiado_grande' });
    expect(env.post(rellenar(leerCuerpo({ r: CODIGO_INACTIVO }), 65537))).toEqual({ ok: false, error: 'demasiado_grande' });
  });

  it('el orden es tamaño, JSON, acción, código en el padrón y ritmo', () => {
    const env = crearEntorno();
    expect(env.post('{"accion":"leer"')).toEqual({ ok: false, error: 'formato' });
    expect(env.post(JSON.stringify({ accion: 'leerr', r: CODIGO_ACTIVO }))).toEqual({ ok: false, error: 'formato' });
    expect(env.post(leerCuerpo({ r: CODIGO_INACTIVO }))).toEqual({ ok: false, error: 'codigo_no_activo' });
    for (let i = 1; i <= 120; i++) expect(env.post(leerCuerpo())['ok']).toBe(true);
    expect(env.post(leerCuerpo())).toEqual({ ok: false, error: 'demasiadas_peticiones' });
    // Ya sin ritmo, un código inactivo sigue dando codigo_no_activo (el padrón va antes que el ritmo).
    expect(env.post(leerCuerpo({ r: CODIGO_INACTIVO }))).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it('no toma el bloqueo ni escribe', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    const antes = conteoFilas(env);
    expect(env.postLeer(CODIGO_ACTIVO)['ok']).toBe(true);
    expect(env.candado.esperas).toEqual([]);
    expect(env.candado.liberaciones).toBe(0);
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues + env.hojas.Padrón.llamadasSetValues).toBe(0);
    expect(env.flushes()).toBe(0);
    expect(conteoFilas(env)).toEqual(antes);
  });

  it('si falta una pestaña de lectura, el POST leer da interno sin el mensaje de la excepción', () => {
    for (const sinPestana of ['Respuestas', 'Autorizaciones'] as const) {
      const res = crearEntorno({ sinPestana }).postLeer(CODIGO_ACTIVO);
      expect(res).toEqual({ ok: false, error: 'interno' });
    }
  });
});

describe('(k) caché del padrón (S3, #162)', () => {
  const lecturasPadron = (env: Entorno) => env.hojas.Padrón.lecturas;
  const leer = (env: Entorno, codigo = CODIGO_ACTIVO) => env.postLeer(codigo);

  it('ninguna, una o muchas peticiones del mismo minuto leen el padrón una sola vez', () => {
    const env = crearEntorno();
    expect(lecturasPadron(env)).toBe(0);
    expect(leer(env)['ok']).toBe(true);
    expect(lecturasPadron(env)).toBe(1);
    expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { version: VERSION_AUTORIZACION }))).toEqual({ ok: true });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))['ok']).toBe(true);
    expect(leer(env)['ok']).toBe(true);
    expect(lecturasPadron(env)).toBe(1);
  });

  it('50 códigos inventados con formato válido dan codigo_no_activo con una lectura, un put y ninguna escritura', () => {
    const env = crearEntorno();
    const antes = conteoFilas(env);
    for (let i = 0; i < 50; i++) expect(leer(env, `INVENTADO${i}`)).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(lecturasPadron(env)).toBe(1);
    expect(env.puts.map((p) => p.clave)).toEqual(['padron']);
    expect(conteoFilas(env)).toEqual(antes);
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues).toBe(0);
  });

  it('a los 30 s sigue en una lectura y a los 61 s la petición siguiente lee otra vez', () => {
    const env = crearEntorno();
    leer(env);
    env.reloj.avanzar(30000);
    leer(env);
    expect(lecturasPadron(env)).toBe(1);
    env.reloj.avanzar(31000);
    leer(env);
    expect(lecturasPadron(env)).toBe(2);
  });

  it('un código pasado a no sigue valiendo dentro de la ventana y a los 61 s da codigo_no_activo', () => {
    const env = crearEntorno();
    expect(leer(env)['ok']).toBe(true);
    env.hojas.Padrón.filas[1]![2] = 'no';
    env.reloj.avanzar(30000);
    expect(leer(env)['ok']).toBe(true);
    env.reloj.avanzar(31000);
    expect(leer(env)).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it('un código nuevo con sí da codigo_no_activo dentro de la ventana y ok a los 61 s', () => {
    const env = crearEntorno();
    expect(leer(env)['ok']).toBe(true);
    env.hojas.Padrón.filas.push([CODIGO_AUSENTE, 'D09', 'sí']);
    expect(leer(env, CODIGO_AUSENTE)).toEqual({ ok: false, error: 'codigo_no_activo' });
    env.reloj.avanzar(61000);
    expect(leer(env, CODIGO_AUSENTE)['ok']).toBe(true);
  });

  it('si el put del padrón falla, cada petición responde bien y lee la hoja', () => {
    const env = crearEntorno({ putFalla: (clave) => clave === 'padron' });
    for (let i = 1; i <= 5; i++) {
      expect(leer(env)['ok']).toBe(true);
      expect(lecturasPadron(env)).toBe(i);
    }
    expect(env.puts.some((p) => p.clave === 'padron')).toBe(false);
    expect(leer(env, CODIGO_AUSENTE)).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it.each(['no json', '{"a":1}', '[1,2]', '{"a":1,"length":1}', '"texto"', 'null'])('un valor sembrado %j en la clave del padrón se ignora y se lee la hoja', (malo) => {
    const env = crearEntorno();
    env.sembrarCache('padron', malo, 60);
    expect(leer(env)['ok']).toBe(true);
    expect(lecturasPadron(env)).toBe(1);
    expect(leer(env, CODIGO_AUSENTE)).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it('un valor sembrado válido se usa sin leer la hoja', () => {
    const env = crearEntorno({ padron: [] });
    env.sembrarCache('padron', JSON.stringify([CODIGO_ACTIVO]), 60);
    expect(leer(env)['ok']).toBe(true);
    expect(leer(env, OTRO_ACTIVO)).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(lecturasPadron(env)).toBe(0);
  });

  it('sin la pestaña Padrón la respuesta es interno y no queda ningún put del padrón', () => {
    const env = crearEntorno({ sinPestana: 'Padrón' });
    expect(leer(env)).toEqual({ ok: false, error: 'interno' });
    expect(env.puts.some((p) => p.clave === 'padron')).toBe(false);
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'length'])('el código %s da codigo_no_activo también con la caché llena', (codigo) => {
    const env = crearEntorno();
    expect(leer(env)['ok']).toBe(true);
    expect(env.puts.some((p) => p.clave === 'padron')).toBe(true);
    for (const a of ACCIONES) expect(pedir(env, a, codigo)).toEqual({ ok: false, error: 'codigo_no_activo' });
  });

  it('ninguna salida contiene otro código ni un alias del padrón', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    for (const a of ACCIONES) pedir(env, a, CODIGO_ACTIVO);
    for (const c of [CODIGO_AUSENTE, CODIGO_INACTIVO, 'constructor']) for (const a of ACCIONES) pedir(env, a, c);
    env.post('no json');
    for (let i = 0; i < 130; i++) env.postLeer(CODIGO_ACTIVO); // pasa del ritmo: salen demasiadas_peticiones
    const roto = crearEntorno({ sinPestana: 'Respuestas' });
    roto.postLeer(CODIGO_ACTIVO);
    for (const s of [...env.salidas, ...roto.salidas]) {
      for (const otro of [OTRO_ACTIVO, CODIGO_GUION, CODIGO_INACTIVO, CODIGO_AUSENTE]) expect(s.contenido).not.toContain(otro);
      expect(s.contenido).not.toMatch(/\bD0\d\b/);
    }
    expect(env.salidas.some((s) => s.contenido.includes('demasiadas_peticiones'))).toBe(true);
    expect(roto.salidas.some((s) => s.contenido.includes('interno'))).toBe(true);
  });
});

describe('(l) versión de la autorización (A2, #162, #168)', () => {
  it('la constante del script es la de la app y es la 3', () => {
    const delScript = /const VERSION_AUTORIZACION = '([^']+)';/.exec(readFileSync(RUTA_SCRIPT, 'utf8'))?.[1];
    expect(delScript).toBe(VERSION_AUTORIZACION);
    expect(VERSION_AUTORIZACION).toBe('3');
  });

  it('las filas de las versiones 1 y 2 ya no dejan guardar y la de la versión 3 sí', () => {
    const env = crearEntorno();
    env.hojas.Autorizaciones.filas.push([CODIGO_ACTIVO, '2026-10-14T09:00:00.000Z', '1', 'no']);
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))).toEqual({ ok: false, error: 'sin_autorizacion' });
    env.hojas.Autorizaciones.filas.push([CODIGO_ACTIVO, '2026-10-14T09:01:00.000Z', '2', 'no']);
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))).toEqual({ ok: false, error: 'sin_autorizacion' });
    env.hojas.Autorizaciones.filas.push([CODIGO_ACTIVO, '2026-10-14T09:02:00.000Z', '3', 'no']);
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))['ok']).toBe(true);
  });
});

describe('(m) el GET ya no lee (S4, #169)', () => {
  const GET_CASOS: [string, Record<string, string>][] = [
    ['sin parámetros', {}],
    ['leer con un código activo', { accion: 'leer', r: CODIGO_ACTIVO }],
    ['leer con un código inactivo', { accion: 'leer', r: CODIGO_INACTIVO }],
    ['leer con un código ausente', { accion: 'leer', r: CODIGO_AUSENTE }],
    ['leer sin r', { accion: 'leer' }],
    ['otra acción', { accion: 'guardar', r: CODIGO_ACTIVO }],
  ];
  const FORMATO = { ok: false, error: 'formato' };
  type DoGet = (e?: unknown) => { getContent(): string };

  it.each(GET_CASOS)('un GET %s da formato', (_n, parametros) => {
    const env = crearEntorno({ autorizados: AUTORIZADOS });
    expect(env.get(parametros)).toEqual(FORMATO);
  });

  it('un GET sin evento o con un evento vacío también da formato', () => {
    const env = crearEntorno();
    const doGet = env.fn<DoGet>('doGet');
    expect(JSON.parse(doGet(undefined).getContent())).toEqual(FORMATO);
    expect(JSON.parse(doGet({}).getContent())).toEqual(FORMATO);
  });

  it('ningún GET lee una pestaña, toca la caché, toma el bloqueo ni escribe, y todas las salidas son JSON sin el código', () => {
    const env = crearEntorno({ autorizados: AUTORIZADOS, vago: true });
    for (const [, parametros] of GET_CASOS) env.get(parametros);
    expect(env.hojas.Padrón.lecturas).toBe(0);
    expect(env.hojas.Respuestas.lecturas).toBe(0);
    expect(env.hojas.Autorizaciones.lecturas).toBe(0);
    expect(env.puts).toEqual([]);
    expect(env.candado.esperas).toEqual([]);
    expect(env.candado.liberaciones).toBe(0);
    expect(env.hojas.Respuestas.llamadasSetValues + env.hojas.Autorizaciones.llamadasSetValues + env.hojas.Padrón.llamadasSetValues).toBe(0);
    expect(env.salidas).toHaveLength(GET_CASOS.length);
    for (const s of env.salidas) {
      expect(s.mime).toBe(MIME_JSON);
      expect(s.contenido).not.toContain(CODIGO_ACTIVO);
    }
  });

  it('sin la pestaña Padrón el GET da formato y no interno', () => {
    const env = crearEntorno({ sinPestana: 'Padrón' });
    expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual(FORMATO);
    expect(env.hojas.Padrón.lecturas).toBe(0);
  });

  it('130 GET con un código activo no gastan el ritmo: después 120 POST leer siguen pasando', () => {
    const env = crearEntorno();
    for (let i = 0; i < 130; i++) expect(env.get({ accion: 'leer', r: CODIGO_ACTIVO })).toEqual(FORMATO);
    for (let i = 0; i < 120; i++) expect(env.postLeer(CODIGO_ACTIVO)['ok']).toBe(true);
  });
});

describe('(n) autorizar solo con la versión vigente (#169)', () => {
  it.each([true, false])('con la versión vigente y vago %s escribe la fila', (vago) => {
    const env = crearEntorno();
    expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { vago }))).toEqual({ ok: true });
    expect(env.escritas('Autorizaciones')).toEqual([[CODIGO_ACTIVO, isoDe(env), VERSION_AUTORIZACION, vago ? 'sí' : 'no']]);
  });

  it.each([`${VERSION_AUTORIZACION}-anterior`, `0${VERSION_AUTORIZACION}`, 'vieja', 'a'.repeat(40)])('la versión %j, de forma válida pero no vigente, da formato sin escribir ni tomar el bloqueo', (version) => {
    const env = crearEntorno();
    expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { version }))).toEqual({ ok: false, error: 'formato' });
    expect(env.escritas('Autorizaciones')).toEqual([]);
    expect(env.hojas.Autorizaciones.llamadasSetValues).toBe(0);
    expect(env.candado.esperas).toEqual([]);
  });

  it('un autorizar rechazado por la versión no habilita guardar', () => {
    const env = crearEntorno();
    expect(env.post(autorizarCuerpo(CODIGO_ACTIVO, { version: 'vieja' }))).toEqual({ ok: false, error: 'formato' });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp()]))).toEqual({ ok: false, error: 'sin_autorizacion' });
    expect(env.escritas('Respuestas')).toEqual([]);
  });

  it('un código inactivo con versión vieja da codigo_no_activo: el padrón va primero', () => {
    const env = crearEntorno();
    expect(env.post(autorizarCuerpo(CODIGO_INACTIVO, { version: 'vieja' }))).toEqual({ ok: false, error: 'codigo_no_activo' });
    expect(env.escritas('Autorizaciones')).toEqual([]);
  });
});

describe('(o) guardar y la casilla del vago (S2, #166)', () => {
  const VAGO = 'vagus-nerve-x';
  const FORMATO = { ok: false, error: 'formato' };
  const SIN_AUT = { ok: false, error: 'sin_autorizacion' };
  const ruta = resp({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R#t01' });
  const aut = (vago: 'sí' | 'no' | 'sí ', t: string): Celda[] => [CODIGO_ACTIVO, t, VERSION_AUTORIZACION, vago];
  const filasRespuestas = (env: Entorno) => env.escritas('Respuestas');

  /** [nombre, elemento corto, ¿del vago?] */
  const CASOS_VAGO: [string, Record<string, unknown>, boolean][] = [
    ['campo trazo:', { c: 'trazo:Vagus_nerve.R#t01' }, true],
    ['campo trazado_', { c: 'trazado_derecho' }, true],
    ['campo trazado_ largo', { c: 'trazado_vago_toracico_derecho' }, true],
    ['malla', { c: 'nombre', m: 'm' }, true],
    ['ramo', { c: 'nombre', a: 'no_se' }, true],
    ['ficha normal', { c: 'nombre' }, false],
    ['posicion', { c: 'posicion' }, false],
    ['relevancia.0', { c: 'relevancia.0' }, false],
    ['trazado sin guion bajo', { c: 'trazado' }, false],
    ['prefijo en medio', { c: 'xtrazo:a' }, false],
  ];

  it.each(CASOS_VAGO)('esRespuestaDelVago del script y del importador coinciden: %s', (_n, el, esperado) => {
    const env = crearEntorno();
    const delScript = env.fn<(e: unknown) => boolean>('esRespuestaDelVago')(el);
    const delImportador = esRespuestaDelVago({ campo: el['c'] as string, malla: el['m'] as string | undefined, ramo: el['a'] as string | undefined });
    expect(delScript).toBe(delImportador);
    expect(delScript).toBe(esperado);
  });

  const CONDICIONES: [string, Respuesta][] = [
    ['un campo que empieza por trazo:', resp({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R#t01' })],
    ['un campo que empieza por trazado_', resp({ estructura: VAGO, campo: 'trazado_derecho' })],
    ['una malla', resp({ estructura: VAGO, campo: 'nombre', malla: 'm' })],
    ['un ramo', resp({ estructura: VAGO, campo: 'nombre', ramo: 'no_se' })],
  ];

  it.each(CONDICIONES)('con la casilla en no, %s rechaza la carga con formato, sin escribir ni tomar el bloqueo', (_n, r) => {
    const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [r]))).toEqual(FORMATO);
    expect(filasRespuestas(env)).toEqual([]);
    expect(env.hojas.Respuestas.llamadasSetValues).toBe(0);
    expect(env.candado.esperas).toEqual([]);
  });

  it.each(CONDICIONES)('con la casilla en sí, %s se guarda', (_n, r) => {
    const env = crearEntorno({ autorizados: [CODIGO_ACTIVO], vago: true });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [r]))['ok']).toBe(true);
    expect(filasRespuestas(env)).toHaveLength(1);
  });

  it('una carga mixta (una normal y una del vago) con la casilla en no se rechaza entera', () => {
    const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp(), ruta]))).toEqual(FORMATO);
    expect(filasRespuestas(env)).toEqual([]);
  });

  it('una carga sin respuestas del vago, incluida una ficha de vagus-nerve-x, se guarda con la casilla en no', () => {
    const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
    expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [resp(), resp({ estructura: VAGO, campo: 'nombre' })]))['ok']).toBe(true);
    expect(filasRespuestas(env)).toHaveLength(1);
  });

  it('manda la última fila: sí y después no rechaza; no y después sí guarda; sí con espacio final cuenta como sí', () => {
    const siLuegoNo = crearEntorno();
    siLuegoNo.hojas.Autorizaciones.filas.push(aut('sí', 't1'), aut('no', 't2'));
    expect(siLuegoNo.post(guardarCuerpo(CODIGO_ACTIVO, [ruta]))).toEqual(FORMATO);

    const noLuegoSi = crearEntorno();
    noLuegoSi.hojas.Autorizaciones.filas.push(aut('no', 't1'), aut('sí', 't2'));
    expect(noLuegoSi.post(guardarCuerpo(CODIGO_ACTIVO, [ruta]))['ok']).toBe(true);

    const conEspacio = crearEntorno();
    conEspacio.hojas.Autorizaciones.filas.push(aut('sí ', 't1'));
    expect(conEspacio.post(guardarCuerpo(CODIGO_ACTIVO, [ruta]))['ok']).toBe(true);
  });

  describe('orden de las comprobaciones', () => {
    it('sin autorización y con un trazo da sin_autorizacion', () => {
      const env = crearEntorno();
      expect(env.post(guardarCuerpo(CODIGO_ACTIVO, [ruta]))).toEqual(SIN_AUT);
    });

    it('con la casilla en no, una carga mal formada con un trazo da formato y no escribe', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      const carga = JSON.stringify({ v: 2, r: CODIGO_ACTIVO, e: { [VAGO]: [{ c: 'trazo:Vagus_nerve.R', i: 'es', d: 'aprobado', s: 'sin-ficha' }] } });
      expect(env.post(JSON.stringify({ accion: 'guardar', carga }))).toEqual(FORMATO);
      expect(filasRespuestas(env)).toEqual([]);
    });

    const grande = [
      ...Array.from({ length: 12 }, (_, i) => resp({ campo: `fuente.${i}`, veredicto: 'corregir', propuesta: 'x'.repeat(4000) })),
      resp({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R', veredicto: 'corregir', propuesta: 'x'.repeat(4000) }),
    ];

    it('con la casilla en sí, 13 respuestas de 4000 caracteres con un trazo dan demasiado_grande', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO], vago: true });
      expect(cargaRevisionV2(CODIGO_ACTIVO, grande).length).toBeGreaterThan(50000);
      expect(env.post(guardarCuerpo(CODIGO_ACTIVO, grande))).toEqual({ ok: false, error: 'demasiado_grande' });
    });

    it('con la casilla en no, esa misma carga da formato: el vago va antes del tamaño de la celda', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      expect(env.post(guardarCuerpo(CODIGO_ACTIVO, grande))).toEqual(FORMATO);
    });
  });

  describe('con la cola real de la app', () => {
    const fecha = '2026-10-14T09:59:00.000Z';
    const normales = [resp({ campo: 'ubicacion', fecha }), resp({ campo: 'que_es', fecha }), resp({ campo: 'nombre', fecha })];
    const trazo = resp({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R', fecha });

    /** Envía la cola como el panel: lote a lote, hasta que no queda nada por enviar o la cola se detiene. */
    function enviarTodo(env: Entorno) {
      const lista = [...normales, trazo];
      let estado = estadoInicial();
      let guardados = 0;
      for (let vuelta = 0; vuelta < 20; vuelta++) {
        const lote = armarLotes(CODIGO_ACTIVO, porEnviar(lista, estado.confirmadas, estado.rechazadas), estado.tope)[0];
        if (!lote) break;
        const res = env.post(cuerpoGuardar(CODIGO_ACTIVO, lote));
        guardados++;
        const resultado: ResultadoEnvio = res['ok'] ? { ok: true, recibidas: new Set(res['recibidas'] as string[]) } : { ok: false, error: res['error'] as TipoErrorCanal };
        const sig = trasEnvio(estado, lote, resultado, Date.parse(fecha));
        estado = sig.estado;
        if (sig.espera === null) break;
      }
      return { estado, guardados, lista };
    }

    it('con la casilla en no termina sin bucle en 5 guardar: confirma las 3 normales y deja el trazo rechazado y pendiente', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      const { estado, guardados, lista } = enviarTodo(env);
      expect(guardados).toBe(5);
      for (const n of normales) expect(estado.confirmadas[claveRespuesta(n)]).toBe(fecha);
      expect(Object.keys(estado.confirmadas)).toHaveLength(3);
      expect(estado.rechazadas[claveRespuesta(trazo)]).toBe(fecha);
      expect(pendientes(lista, estado.confirmadas).map(claveRespuesta)).toEqual([claveRespuesta(trazo)]);
      expect(porEnviar(lista, estado.confirmadas, estado.rechazadas)).toEqual([]);
      // Las 3 normales quedaron en las filas que sí se escribieron (la partición las separó en dos) y ninguna es un trazo.
      const escritas = filasRespuestas(env).flatMap((f) => Object.values((JSON.parse(String(f[3])) as { e: Record<string, unknown[]> }).e).flat());
      expect(escritas).toHaveLength(3);
      for (const f of filasRespuestas(env)) expect(String(f[3])).not.toContain('trazo:');
    });

    it('con la casilla en sí, un solo guardar confirma las 4', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO], vago: true });
      const { estado, guardados, lista } = enviarTodo(env);
      expect(guardados).toBe(1);
      expect(Object.keys(estado.confirmadas)).toHaveLength(4);
      expect(pendientes(lista, estado.confirmadas)).toEqual([]);
      expect(filasRespuestas(env)).toHaveLength(1);
    });
  });
});

describe('(p) retiros: quitar una marca se guarda (#217)', () => {
  const FORMATO = { ok: false, error: 'formato' };
  const FECHA = '2026-10-14T09:59:00.000Z';
  const RETIRO_FECHA = '2026-10-14T10:05:00.000Z';
  const VAGO = 'vagus-nerve-x';
  const retiro = (extra: Partial<Retiro> = {}): Retiro => ({ estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: '', fecha: RETIRO_FECHA, ...extra });
  const guardarRetiros = (codigo: string, items: (Respuesta | Retiro)[]) => JSON.stringify({ accion: 'guardar', carga: cargaRevisionV2(codigo, items) });
  const filaDe = (b: string, e: unknown): Celda[] => ['2026-10-14T10:00:00.000Z', b, 'hippocampus', JSON.stringify({ v: 2, r: b, e })];
  const corto = (extra: Record<string, unknown> = {}) => ({ c: 'ubicacion', i: 'es', d: 'correcto', s: '0.1.0', f: FECHA, ...extra });
  const ret = (extra: Record<string, unknown> = {}) => ({ c: 'ubicacion', i: 'es', d: '', f: RETIRO_FECHA, ...extra });

  it('la versión del canal del script es la de la app y es la 2', () => {
    const delScript = /const VERSION_CANAL = (\d+);/.exec(readFileSync(RUTA_SCRIPT, 'utf8'))?.[1];
    expect(Number(delScript)).toBe(VERSION_CANAL);
    expect(VERSION_CANAL).toBe(2);
  });

  describe('guardar (D1)', () => {
    it('escribe una fila en Respuestas con formato de texto y devuelve id|c|i|f en recibidas', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      const res = env.post(guardarRetiros(CODIGO_ACTIVO, [retiro()]));
      expect(res).toEqual({ ok: true, recibidas: [`hippocampus|ubicacion|es|${RETIRO_FECHA}`] });
      const filas = env.escritas('Respuestas');
      expect(filas).toHaveLength(1);
      expect(filas[0]![1]).toBe(CODIGO_ACTIVO);
      expect(filas[0]![2]).toBe('hippocampus');
      expect(JSON.parse(String(filas[0]![3]))).toEqual({ v: 2, r: CODIGO_ACTIVO, e: { hippocampus: [{ c: 'ubicacion', i: 'es', d: '', f: RETIRO_FECHA }] } });
      for (let c = 1; c <= 4; c++) expect(env.hojas.Respuestas.formatos.get(`2,${c}`)).toBe('@');
      expect(env.hojas.Respuestas.formulas.size).toBe(0);
    });

    it('el retiro sin idioma devuelve una clave con el idioma vacío', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      const res = env.post(guardarRetiros(CODIGO_ACTIVO, [retiro({ idioma: undefined, campo: 'posicion' })]));
      expect(res).toEqual({ ok: true, recibidas: [`hippocampus|posicion||${RETIRO_FECHA}`] });
    });

    it('un retiro y un veredicto en la misma carga se guardan en una sola fila', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      const res = env.post(guardarRetiros(CODIGO_ACTIVO, [resp({ campo: 'que_es' }), retiro()]));
      expect(res['ok']).toBe(true);
      expect(env.escritas('Respuestas')).toHaveLength(1);
    });
  });

  describe('forma del retiro (D2)', () => {
    it.each(casosRetiro)('retiroValido del script y de la app coinciden con %s', (_n, r, vale) => {
      const env = crearEntorno();
      const delScript = env.fn<(r: unknown, idOk: (id: unknown) => boolean) => boolean>('retiroValido')(r, idForma);
      expect(delScript).toBe(retiroValido(r, idForma));
      expect(delScript).toBe(vale);
    });

    it.each(casosCargaRetiro)('la carga con %s tiene el mismo veredicto en el script y en el importador', (_n, carga, vale) => {
      // El importador solo acepta retiros en filas con la forma de la pestaña Respuestas: A ISO, B el código, D la carga.
      const env = crearEntorno({ autorizados: AUTORIZADOS, vago: true });
      const res = env.post(JSON.stringify({ accion: 'guardar', carga }));
      const filaHoja = ['2026-10-14T10:00:00.000Z', CODIGO_ACTIVO, 'x', carga];
      const { envios, invalidas } = leerEnvios([['Recibido', 'Código', 'Estructuras', 'Carga'], filaHoja]);
      const laApp = invalidas === 0 && envios.length > 0;
      expect(res['ok']).toBe(laApp);
      expect(laApp).toBe(vale);
      if (res['ok']) expect(env.escritas('Respuestas')).toHaveLength(1);
      else {
        expect(res['error']).toBe('formato');
        expect(env.escritas('Respuestas')).toEqual([]);
        expect(env.hojas.Respuestas.llamadasSetValues).toBe(0);
        expect(env.candado.esperas).toEqual([]);
      }
    });

    it('el código de otro revisor en la carga de un retiro da codigo_no_activo, igual que un veredicto', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      const carga = cargaRevisionV2(CODIGO_AUSENTE, [retiro()]);
      expect(env.post(JSON.stringify({ accion: 'guardar', carga }))).toEqual({ ok: false, error: 'codigo_no_activo' });
      expect(env.escritas('Respuestas')).toEqual([]);
    });
  });

  describe('la casilla del vago (D3)', () => {
    const retiroTrazo = retiro({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R#t01' });
    const trazo = resp({ estructura: VAGO, campo: 'trazo:Vagus_nerve.R#t01' });

    it('con la casilla en no, el retiro de un trazo se guarda y el veredicto del mismo trazo da formato', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      expect(env.post(guardarRetiros(CODIGO_ACTIVO, [trazo]))).toEqual(FORMATO);
      expect(env.escritas('Respuestas')).toEqual([]);
      expect(env.post(guardarRetiros(CODIGO_ACTIVO, [retiroTrazo]))).toEqual({ ok: true, recibidas: [`${VAGO}|trazo:Vagus_nerve.R#t01|es|${RETIRO_FECHA}`] });
      expect(env.escritas('Respuestas')).toHaveLength(1);
    });

    it('con la casilla en no, un retiro de un trazado_ también se guarda', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      expect(env.post(guardarRetiros(CODIGO_ACTIVO, [retiro({ estructura: VAGO, campo: 'trazado_derecho', idioma: undefined })]))['ok']).toBe(true);
    });

    it('con la casilla en no, un retiro y un veredicto del vago en la misma carga siguen dando formato', () => {
      const env = crearEntorno({ autorizados: [CODIGO_ACTIVO] });
      expect(env.post(guardarRetiros(CODIGO_ACTIVO, [retiroTrazo, resp({ estructura: VAGO, campo: 'trazo:otro' })]))).toEqual(FORMATO);
      expect(env.escritas('Respuestas')).toEqual([]);
    });
  });

  describe('leer (D4)', () => {
    it('responde canal igual a VERSION_CANAL y retiradas vacías cuando no hay retiros', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(filaDe(CODIGO_ACTIVO, { hippocampus: [corto()] }));
      const res = env.postLeer(CODIGO_ACTIVO);
      expect(res['canal']).toBe(VERSION_CANAL);
      expect(res['retiradas']).toEqual({ v: 2, r: CODIGO_ACTIVO, e: {} });
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto()] });
    });

    it('una clave retirada falta en respuestas y está en retiradas; las demás siguen', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto(), corto({ c: 'que_es' })] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret()] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto({ c: 'que_es' })] });
      expect((res['retiradas'] as { e: object }).e).toEqual({ hippocampus: [ret()] });
    });

    it('un veredicto posterior al retiro gana: está en respuestas y no en retiradas', () => {
      const env = crearEntorno();
      const nuevo = corto({ d: 'corregir', p: 'nueva', f: '2026-10-14T10:10:00.000Z' });
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto()] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret()] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [nuevo] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [nuevo] });
      expect((res['retiradas'] as { e: object }).e).toEqual({});
    });

    it('un retiro posterior a un veredicto que a su vez seguía a otro retiro deja solo el último retiro', () => {
      const env = crearEntorno();
      const segundo = ret({ f: '2026-10-14T10:20:00.000Z' });
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret()] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto({ f: '2026-10-14T10:10:00.000Z' })] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [segundo] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({});
      expect((res['retiradas'] as { e: object }).e).toEqual({ hippocampus: [segundo] });
    });

    it('el retiro y el veredicto se separan por idioma: retirar es no quita en', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto(), corto({ i: 'en' }), corto({ i: undefined })] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret()] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto({ i: 'en' }), corto({ i: undefined })] });
    });

    it('un retiro sin idioma solo quita la respuesta sin idioma: la clave con idioma vacío no es la de es', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto({ i: undefined }), corto({ c: 'que_es', i: undefined }), corto({ c: 'que_es' })] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret({ i: undefined }), ret({ c: 'que_es' })] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      // Quedan `que_es` sin idioma (el retiro era de es) y nada de `ubicacion` sin idioma ni de `que_es` en es.
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto({ c: 'que_es', i: undefined })] });
      expect((res['retiradas'] as { e: object }).e).toEqual({ hippocampus: [ret({ i: undefined }), ret({ c: 'que_es' })] });
    });

    it('las filas de otro código no cuentan: ni un retiro de otro código ni uno cuya carga declara otro código', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto()] }),
        filaDe(OTRO_ACTIVO, { hippocampus: [ret()] }),
        // B es el código pedido, pero la carga declara otro código.
        ['2026-10-14T10:00:00.000Z', CODIGO_ACTIVO, 'hippocampus', JSON.stringify({ v: 2, r: OTRO_ACTIVO, e: { hippocampus: [ret()] } })],
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto()] });
      expect((res['retiradas'] as { e: object }).e).toEqual({});
      expect((env.postLeer(OTRO_ACTIVO)['retiradas'] as { e: object }).e).toEqual({ hippocampus: [ret()] });
      expect((env.postLeer(OTRO_ACTIVO)['respuestas'] as { e: object }).e).toEqual({});
    });

    it('una fila con la misma clave como retiro y como veredicto es inválida y se salta', () => {
      const env = crearEntorno();
      env.hojas.Respuestas.filas.push(
        filaDe(CODIGO_ACTIVO, { hippocampus: [corto()] }),
        filaDe(CODIGO_ACTIVO, { hippocampus: [ret(), corto({ f: '2026-10-14T10:10:00.000Z' })] }),
      );
      const res = env.postLeer(CODIGO_ACTIVO);
      expect((res['respuestas'] as { e: object }).e).toEqual({ hippocampus: [corto()] });
      expect((res['retiradas'] as { e: object }).e).toEqual({});
    });

    it('lo que guardar escribió vuelve por leer: veredicto, retiro y veredicto otra vez', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      env.post(guardarRetiros(CODIGO_ACTIVO, [resp({ fecha: FECHA })]));
      env.post(guardarRetiros(CODIGO_ACTIVO, [retiro()]));
      const tras = env.postLeer(CODIGO_ACTIVO);
      expect((tras['respuestas'] as { e: object }).e).toEqual({});
      expect((tras['retiradas'] as { e: object }).e).toEqual({ hippocampus: [{ c: 'ubicacion', i: 'es', d: '', f: RETIRO_FECHA }] });
      env.post(guardarRetiros(CODIGO_ACTIVO, [resp({ fecha: '2026-10-14T10:30:00.000Z' })]));
      const final = env.postLeer(CODIGO_ACTIVO);
      expect((final['respuestas'] as { e: Record<string, unknown[]> }).e['hippocampus']).toHaveLength(1);
      expect((final['retiradas'] as { e: object }).e).toEqual({});
    });
  });

  describe('lo que escribe el script se importa', () => {
    const csvDe = (filas: Celda[][]) => filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const estructuras = { hippocampus: { ficha: { version: '0.1.0' } } };
    const padron = { [CODIGO_ACTIVO]: 'D01' };

    it('las filas de retiro, exportadas a CSV, se importan sin inválidas y quitan la marca anterior', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      env.post(guardarRetiros(CODIGO_ACTIVO, [resp({ fecha: FECHA, campo: 'que_es' }), resp({ fecha: FECHA, propuesta: 'texto único' })]));
      env.post(guardarRetiros(CODIGO_ACTIVO, [retiro()]));
      const resultado = importar(`${csvDe(env.hojas.Respuestas.filas)}\n`, estructuras, padron);
      expect(resultado.invalidas).toBe(0);
      expect(resultado.retiradas).toBe(1);
      const md = resultado.archivos.get('hippocampus.md')!;
      expect(md).toContain('que_es');
      expect(md).not.toContain('ubicacion');
    });
  });

  describe('con la cola real de la app', () => {
    it('la cola manda el retiro que arma retirosPendientes y lo confirma con la clave que devuelve el script', () => {
      const env = crearEntorno({ autorizados: AUTORIZADOS });
      const retiradas = { [claveRespuesta({ estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es' })]: RETIRO_FECHA };
      const lista = porEnviar([], {}, {}, retirosPendientes(retiradas, {}));
      const lote = armarLotes(CODIGO_ACTIVO, lista)[0]!;
      const res = env.post(cuerpoGuardar(CODIGO_ACTIVO, lote));
      expect(res['ok']).toBe(true);
      const { estado } = trasEnvio(estadoInicial(), lote, { ok: true, recibidas: new Set(res['recibidas'] as string[]) }, Date.parse(RETIRO_FECHA));
      expect(estado.confirmadas).toEqual(retiradas);
      expect(retirosPendientes(retiradas, estado.confirmadas)).toEqual([]);
    });

    it('respuestaValida no admite el veredicto vacío: un retiro no es una respuesta', () => {
      const env = crearEntorno();
      expect(env.fn<(r: unknown, idOk: (id: unknown) => boolean) => boolean>('respuestaValida')(retiro(), idForma)).toBe(false);
      expect(respuestaValida(retiro(), idForma)).toBe(false);
    });
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
