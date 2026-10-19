import { describe, expect, it } from 'vitest';
import { fusionarRespuestas, piezasQueSiguen } from '../src/lib/respaldo';
import { claveRespuesta, type Respuesta, type Retiro } from '../src/lib/revision';

const a: Respuesta = { estructura: 'hippocampus', campo: 'ubicacion', idioma: 'es', veredicto: 'correcto', version: '0.1.0', fecha: '2026-10-10T10:00:00.000Z' };
const b: Respuesta = { estructura: 'thalamus', campo: 'que_es', idioma: 'es', veredicto: 'corregir', propuesta: 'Texto', version: '0.1.0', fecha: '2026-10-10T11:00:00.000Z' };
const porClave = (...l: Respuesta[]) => Object.fromEntries(l.map((r) => [claveRespuesta(r), r]));

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

describe('fusionarRespuestas con retiros (#217)', () => {
  const k = claveRespuesta(a);
  const retiro = (fecha: string, campo = a.campo): Retiro => ({ estructura: a.estructura, campo, idioma: 'es', veredicto: '', fecha });
  const conteo = (f: ReturnType<typeof fusionarRespuestas>) => [f.agregadas, f.actualizadas, f.sinCambio];

  it('un veredicto con un retiro local de la misma fecha o más nuevo va a sinCambio y no vuelve', () => {
    for (const fecha of [a.fecha, '2026-10-10T10:00:01.000Z']) {
      const f = fusionarRespuestas({}, [a], { [k]: fecha });
      expect(f.respuestas).toEqual({});
      expect(f.retiradas).toEqual({ [k]: fecha });
      expect(conteo(f)).toEqual([0, 0, 1]);
    }
  });

  it('un veredicto más nuevo que el retiro local entra como agregada y borra el retiro', () => {
    const f = fusionarRespuestas({}, [a], { [k]: '2026-10-10T09:00:00.000Z' });
    expect(f.respuestas[k]).toBe(a);
    expect(f.retiradas).toEqual({});
    expect(conteo(f)).toEqual([1, 0, 0]);
  });

  it('un retiro del canal más nuevo que el veredicto local lo borra y cuenta como actualizada', () => {
    const f = fusionarRespuestas(porClave(a, b), [], {}, [retiro('2026-10-10T10:00:01.000Z')]);
    expect(Object.keys(f.respuestas)).toEqual([claveRespuesta(b)]);
    expect(f.retiradas).toEqual({ [k]: '2026-10-10T10:00:01.000Z' });
    expect(conteo(f)).toEqual([0, 1, 0]);
  });

  it('un retiro del canal más viejo o igual que el veredicto local no lo toca ni se anota', () => {
    for (const fecha of [a.fecha, '2026-10-10T09:00:00.000Z']) {
      const actuales = porClave(a);
      const f = fusionarRespuestas(actuales, [], {}, [retiro(fecha)]);
      expect(f.respuestas[k]).toBe(a);
      expect(f.retiradas).toEqual({});
      expect(conteo(f)).toEqual([0, 0, 0]);
    }
  });

  it('un retiro del canal sin respuesta local queda anotado', () => {
    const f = fusionarRespuestas({}, [], {}, [retiro('2026-10-10T12:00:00.000Z')]);
    expect(f.retiradas).toEqual({ [k]: '2026-10-10T12:00:00.000Z' });
  });

  it('con dos retiros de la misma clave queda el de fecha mayor, sin importar el orden', () => {
    const viejo = retiro('2026-10-10T11:00:00.000Z');
    const nuevo = retiro('2026-10-10T12:00:00.000Z');
    expect(fusionarRespuestas({}, [], {}, [viejo, nuevo]).retiradas).toEqual({ [k]: nuevo.fecha });
    expect(fusionarRespuestas({}, [], {}, [nuevo, viejo]).retiradas).toEqual({ [k]: nuevo.fecha });
    expect(fusionarRespuestas({}, [], { [k]: nuevo.fecha }, [viejo]).retiradas).toEqual({ [k]: nuevo.fecha });
    expect(fusionarRespuestas({}, [], { [k]: viejo.fecha }, [nuevo]).retiradas).toEqual({ [k]: nuevo.fecha });
  });

  it('el idioma distingue la clave: el retiro de es no toca la respuesta en en', () => {
    const en = { ...a, idioma: 'en' as const };
    const f = fusionarRespuestas(porClave(a, en), [], {}, [retiro('2026-10-10T12:00:00.000Z')]);
    expect(Object.keys(f.respuestas)).toEqual([claveRespuesta(en)]);
  });

  it('una clave nunca queda a la vez en respuestas y en retiradas', () => {
    const casos: [Record<string, Respuesta>, Respuesta[], Record<string, string>, Retiro[]][] = [
      [porClave(a), [], {}, [retiro('2026-10-10T12:00:00.000Z')]],
      [porClave(a), [], {}, [retiro('2026-10-10T09:00:00.000Z')]],
      [{}, [a], { [k]: '2026-10-10T09:00:00.000Z' }, []],
      [{}, [a], { [k]: '2026-10-10T12:00:00.000Z' }, []],
    ];
    for (const [actuales, nuevas, ret, retNuevos] of casos) {
      const f = fusionarRespuestas(actuales, nuevas, ret, retNuevos);
      for (const clave of Object.keys(f.retiradas)) expect(Object.hasOwn(f.respuestas, clave)).toBe(false);
    }
  });

  it('no muta las entradas', () => {
    const actuales = porClave(a);
    const ret = { [claveRespuesta(b)]: '2026-10-10T12:00:00.000Z' };
    const copias = structuredClone([actuales, ret]);
    fusionarRespuestas(actuales, [b], ret, [retiro('2026-10-10T12:00:00.000Z')]);
    expect([actuales, ret]).toEqual(copias);
  });

  it('cargar dos veces el mismo lote con retiros es idempotente', () => {
    const lote = { nuevas: [b], retiros: [retiro('2026-10-10T12:00:00.000Z')] };
    const una = fusionarRespuestas(porClave(a), lote.nuevas, {}, lote.retiros);
    const dos = fusionarRespuestas(una.respuestas, lote.nuevas, una.retiradas, lote.retiros);
    expect(dos.respuestas).toEqual(una.respuestas);
    expect(dos.retiradas).toEqual(una.retiradas);
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
