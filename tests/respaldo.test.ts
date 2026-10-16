import { describe, expect, it } from 'vitest';
import { fusionarRespuestas, piezasQueSiguen } from '../src/lib/respaldo';
import { claveRespuesta, type Respuesta } from '../src/lib/revision';

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
