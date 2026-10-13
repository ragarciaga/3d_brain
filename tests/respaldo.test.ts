import { describe, expect, it } from 'vitest';
import { estructuras } from '../src/data/atlas';
import { crearRespaldo, FORMATO_RESPALDO, fusionarRespuestas, leerRespaldo, MAX_RESPALDO_CARACTERES, MAX_RESPALDO_RESPUESTAS, piezasQueSiguen } from '../src/lib/respaldo';
import { claveRespuesta, type Respuesta } from '../src/lib/revision';

const idOk = (id: unknown) => typeof id === 'string' && Object.hasOwn(estructuras, id);
const REV = 'RESPALDO1';
const a: Respuesta = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-10T10:00:00.000Z' };
const b: Respuesta = { estructura: 'thalamus', campo: 'que_es', idioma: 'es', veredicto: 'corregir', propuesta: 'Texto', version: '0.1.0', fecha: '2026-10-10T11:00:00.000Z' };
const porClave = (...l: Respuesta[]) => Object.fromEntries(l.map((r) => [claveRespuesta(r), r]));
const archivo = (extra: Record<string, unknown> = {}, respuestas: unknown[] = [a, b]) =>
  JSON.stringify({ formato: FORMATO_RESPALDO, v: 1, revisor: REV, exportado: '2026-10-11T00:00:00.000Z', respuestas, ...extra });
const leer = (texto: string) => leerRespaldo(texto, { revisor: REV, idOk });

describe('crearRespaldo', () => {
  it('sin respuestas lleva una lista vacía', () => {
    expect(JSON.parse(crearRespaldo(REV, {})).respuestas).toEqual([]);
  });

  it('lleva formato, versión, revisor, fecha de exportación y todas las respuestas, sin estado de envío', () => {
    const d = JSON.parse(crearRespaldo(REV, porClave(a, b), new Date('2026-10-11T12:00:00Z')));
    expect(d).toEqual({ formato: 'atlas-revision-respaldo', v: 1, revisor: REV, exportado: '2026-10-11T12:00:00.000Z', respuestas: [a, b] });
  });

  it('ida y vuelta: lo que se descarga se carga igual y sin descartes', () => {
    expect(leer(crearRespaldo(REV, porClave(a, b)))).toEqual({ ok: true, respuestas: [a, b], descartadas: 0 });
  });
});

describe('leerRespaldo: el archivo es entrada externa', () => {
  it.each([
    ['texto que no es JSON', 'esto no es json', 'json'],
    ['un array JSON', '[]', 'formato'],
    ['sin formato', archivo({ formato: undefined }), 'formato'],
    ['otro formato', archivo({ formato: 'otro' }), 'formato'],
    ['respuestas que no es un array', archivo({ respuestas: {} }), 'formato'],
    ['otra versión', archivo({ v: 2 }), 'version'],
    ['revisor con espacio', archivo({ revisor: 'A B' }), 'formato'],
    ['revisor de 41 caracteres', archivo({ revisor: 'A'.repeat(41) }), 'formato'],
    ['revisor que no es texto', archivo({ revisor: 7 }), 'formato'],
    ['otro revisor válido', archivo({ revisor: 'OTRO01' }), 'otroRevisor'],
    ['demasiado texto', 'x'.repeat(MAX_RESPALDO_CARACTERES + 1), 'grande'],
    ['demasiadas respuestas', archivo({}, new Array(MAX_RESPALDO_RESPUESTAS + 1).fill(0)), 'grande'],
  ])('rechaza entero: %s', (_n, texto, error) => {
    expect(leer(texto)).toEqual({ ok: false, error });
  });

  it.each<[string, Record<string, unknown>]>([
    ['estructura desconocida', { estructura: 'no-existe' }],
    ['veredicto fuera del conjunto', { veredicto: 'quizas' }],
    ['idioma fr', { idioma: 'fr' }],
    ['campo con barra vertical', { campo: 'que|es' }],
    ['versión v1', { version: 'v1' }],
    ['propuesta de 4001 caracteres', { propuesta: 'x'.repeat(4001) }],
    ['malla de 201 caracteres', { malla: 'x'.repeat(201) }],
    ['posición de 2 números', { posicion: [1, 2] }],
    ['posición con null', { posicion: [1, 2, null] }],
    ['sin fecha', { fecha: undefined }],
    ['fecha ilegible', { fecha: 'ayer' }],
    ['fecha legible de 41 caracteres', { fecha: `2026-10-10T10:00:00.${'0'.repeat(20)}Z` }],
  ])('omite y cuenta la respuesta con %s', (_n, cambio) => {
    expect(leer(archivo({}, [a, { ...b, ...cambio }]))).toEqual({ ok: true, respuestas: [a], descartadas: 1 });
  });

  it('no copia claves desconocidas', () => {
    const l = leer(archivo({}, [{ ...a, extra: 'x' }]));
    expect(l.ok && Object.hasOwn(l.respuestas[0]!, 'extra')).toBe(false);
    expect(l).toEqual({ ok: true, respuestas: [a], descartadas: 0 });
  });

  it('un __proto__ dentro de una respuesta no contamina nada ni se copia', () => {
    const crudo = archivo({}, [a]).replace('"estructura"', '"__proto__": {"polucion": 1}, "estructura"');
    expect(crudo).toContain('"__proto__"');
    const l = leer(crudo);
    expect((({}) as Record<string, unknown>)['polucion']).toBeUndefined();
    expect(l.ok && (l.respuestas[0] as unknown as Record<string, unknown>)['polucion']).toBeFalsy();
    expect(l).toEqual({ ok: true, respuestas: [a], descartadas: 0 });
  });
});

describe('fusionarRespuestas', () => {
  const nuevaFecha = (r: Respuesta, fecha: string): Respuesta => ({ ...r, fecha, veredicto: 'no_es_mi_area' });

  it.each<[string, Record<string, Respuesta>, Respuesta[], [number, number, number]]>([
    ['nada que importar', porClave(a), [], [0, 0, 0]],
    ['clave nueva', porClave(a), [b], [1, 0, 0]],
    ['importada más nueva', porClave(a), [nuevaFecha(a, '2026-10-10T10:00:01.000Z')], [0, 1, 0]],
    ['importada más vieja', porClave(a), [nuevaFecha(a, '2026-10-10T09:00:00.000Z')], [0, 0, 1]],
    ['misma fecha', porClave(a), [nuevaFecha(a, a.fecha)], [0, 0, 1]],
    ['fecha local ilegible', porClave({ ...a, fecha: 'ayer' }), [a], [0, 1, 0]],
    ['lote mixto', porClave(a, b), [nuevaFecha(a, '2026-10-11T00:00:00.000Z'), nuevaFecha(b, '2026-10-01T00:00:00.000Z'), { ...a, campo: 'que_es' }], [1, 1, 1]],
  ])('%s', (_n, actuales, nuevas, [agregadas, actualizadas, sinCambio]) => {
    const f = fusionarRespuestas(actuales, nuevas);
    expect([f.agregadas, f.actualizadas, f.sinCambio]).toEqual([agregadas, actualizadas, sinCambio]);
    expect(Object.keys(f.respuestas)).toHaveLength(Object.keys(actuales).length + agregadas);
  });

  it('la más nueva reemplaza; la más vieja o igual deja la misma referencia local', () => {
    const nueva = nuevaFecha(a, '2026-10-10T10:00:01.000Z');
    expect(fusionarRespuestas(porClave(a), [nueva]).respuestas[claveRespuesta(a)]).toBe(nueva);
    const actuales = porClave(a);
    for (const f of [a.fecha, '2026-10-10T09:00:00.000Z']) {
      expect(fusionarRespuestas(actuales, [nuevaFecha(a, f)]).respuestas[claveRespuesta(a)]).toBe(a);
    }
  });

  it('cargar dos veces el mismo lote es idempotente y no muta lo actual', () => {
    const actuales = porClave(a);
    const copia = structuredClone(actuales);
    const lote = [b, nuevaFecha(a, '2026-10-12T00:00:00.000Z')];
    const una = fusionarRespuestas(actuales, lote);
    const dos = fusionarRespuestas(una.respuestas, lote);
    expect(actuales).toEqual(copia);
    expect(dos.respuestas).toEqual(una.respuestas);
    expect([dos.agregadas, dos.actualizadas, dos.sinCambio]).toEqual([0, 0, 2]);
  });
});

describe('piezasQueSiguen', () => {
  const M = 'm-periaqueductal-grey';
  const pos: Respuesta = { estructura: M, campo: 'posicion', veredicto: 'corregir', posicion: [1, 2, 3], version: 'sin-ficha', fecha: a.fecha };
  const k = claveRespuesta(pos);

  it.each<[string, Record<string, string>, Record<string, Respuesta>, Record<string, Respuesta>, Record<string, string>]>([
    ['la posición no cambió', { [M]: 'stomach' }, { [k]: pos }, { [k]: pos }, { [M]: 'stomach' }],
    ['la posición fue reemplazada', { [M]: 'stomach' }, { [k]: pos }, { [k]: { ...pos, posicion: [4, 5, 6] } }, {}],
    ['ya no hay posición', { [M]: 'stomach' }, { [k]: pos }, {}, {}],
    ['no hay piezas', {}, { [k]: pos }, { [k]: pos }, {}],
  ])('%s', (_n, piezas, antes, despues, esperado) => {
    expect(piezasQueSiguen(piezas, antes, despues)).toEqual(esperado);
  });
});
